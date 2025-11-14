"""Business logic enforcement functions"""
import asyncio
from typing import Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import Request, HTTPException

from models.compliance import DNCEntry, CostEvent
from models.billing import Subscription
from services.settings import get_settings
from utils.auth import extract_tenant_id
from utils.websocket import manager as ws_manager


def _is_dnc_number(session: Session, tenant_id: Optional[int], to_number: str) -> bool:
    """Check if number is in DNC list"""
    q = session.query(DNCEntry).filter(DNCEntry.e164 == to_number)
    if tenant_id is not None:
        q = q.filter(DNCEntry.tenant_id == tenant_id)
    return session.query(q.exists()).scalar() or False


def _tenant_monthly_spend_cents(session: Session, tenant_id: Optional[int]) -> int:
    """Calculate tenant monthly spend in cents"""
    try:
        start_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        q = session.query(CostEvent)
        # Note: CostEvent filtering by tenant_id can be added when call_id joins are available
        rows = q.all()
        total = 0
        for r in rows:
            ts = r.ts or datetime.now(timezone.utc)
            if ts >= start_month:
                total += int(r.amount or 0)
        return total
    except Exception:
        return 0


def enforce_compliance_or_raise(session: Session, request: Request, to_number: str, metadata: Optional[dict]) -> None:
    """Enforce compliance rules (DNC, legal review)"""
    tenant_id = extract_tenant_id(request)
    # DNC check
    if _is_dnc_number(session, tenant_id, to_number):
        raise HTTPException(status_code=403, detail="Blocked by DNC list")
    # Legal review requirement
    s = get_settings()
    require_legal = bool(s.require_legal_review or 0)
    if require_legal:
        accepted = bool((metadata or {}).get("legal_accepted", False))
        if not accepted:
            raise HTTPException(status_code=403, detail="Legal review not accepted")


def enforce_budget_or_raise(session: Session, request: Request) -> None:
    """Enforce budget limits"""
    s = get_settings()
    tenant_id = extract_tenant_id(request)
    monthly_cap = int(s.budget_monthly_cents or 0)
    if monthly_cap <= 0:
        return
    spent = _tenant_monthly_spend_cents(session, tenant_id)
    warn_pct = int(s.budget_warn_percent or 80)
    stop_enabled = bool(s.budget_stop_enabled or 0)
    # Broadcast warn if over threshold
    try:
        if spent >= monthly_cap * warn_pct / 100.0:
            # Non-blocking warning event
            asyncio.create_task(ws_manager.broadcast({
                "type": "budget.warn",
                "data": {"spent": spent/100.0, "cap": monthly_cap/100.0}
            }))
    except Exception:
        pass
    if stop_enabled and spent >= monthly_cap:
        raise HTTPException(status_code=403, detail="Budget cap reached for this tenant")


def enforce_subscription_or_raise(session: Session, request: Request) -> None:
    """Enforce subscription status"""
    tenant_id = extract_tenant_id(request)
    if tenant_id is None:
        return
    sub = (
        session.query(Subscription)
        .filter(Subscription.tenant_id == tenant_id)
        .order_by(Subscription.id.desc())
        .first()
    )
    # Bootstrap Free 14-day trial if missing
    if not sub:
        sub = Subscription(tenant_id=tenant_id, plan_code="free", status="trialing")
        session.add(sub)
        session.commit()
        session.refresh(sub)
    status = sub.status or "trialing"
    if status in {"active", "trialing"}:
        # Enforce 14-day trial for Free
        try:
            if (sub.plan_code or "free") == "free" and status == "trialing":
                start = sub.created_at or datetime.now(timezone.utc)
                if datetime.now(timezone.utc) - start > timedelta(days=14):
                    raise HTTPException(status_code=402, detail="Free trial expired. Please upgrade in Billing")
            return
        except HTTPException:
            raise
        except Exception:
            pass
    # Not active or trial expired
    raise HTTPException(status_code=402, detail="Subscription required")

