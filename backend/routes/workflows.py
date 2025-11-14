"""Workflow endpoints"""
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config.database import engine
from models.billing import Subscription
from models.workflows import WorkflowUsage, WorkflowEmailEvent
from utils.auth import extract_tenant_id
from utils.redis_client import get_redis
from services.enforcement import enforce_subscription_or_raise

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class WorkflowEmailSend(BaseModel):
    to: str
    template_id: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    workflow_id: Optional[int] = None


# ============================================================================
# Helper Functions
# ============================================================================

def _email_quota_for_plan(plan_code: str) -> Optional[int]:
    """Get email quota for plan"""
    if plan_code == "free":
        return 100
    if plan_code == "core":
        return 1000
    if plan_code == "pro":
        return 5000
    return None  # enterprise/custom


# ============================================================================
# Workflow Endpoints
# ============================================================================

@router.post("/email/send")
async def workflows_email_send(request: Request, body: WorkflowEmailSend) -> Dict[str, Any]:
    """Send workflow email"""
    tenant_id = extract_tenant_id(request)
    # Subscription gating
    with Session(engine) as session:
        enforce_subscription_or_raise(session, request)

    # Rate-limit 60/min with burst ~120
    r = get_redis()
    if r is not None and tenant_id is not None:
        key = f"rl:wfemail:{tenant_id}:{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
        try:
            n = r.incr(key)
            r.expire(key, 120)
            if n > 120:
                raise HTTPException(status_code=429, detail="rate limit")
        except Exception:
            pass

    # Quota check and record usage
    with Session(engine) as session:
        sub = (
            session.query(Subscription)
            .filter(Subscription.tenant_id == (tenant_id or 0))
            .order_by(Subscription.id.desc())
            .first()
        )
        plan = sub.plan_code if sub else "free"
        quota = _email_quota_for_plan(plan)
        month = datetime.now(timezone.utc).strftime("%Y-%m")
        usage = (
            session.query(WorkflowUsage)
            .filter(WorkflowUsage.tenant_id == (tenant_id or 0), WorkflowUsage.month == month)
            .one_or_none()
        )
        if not usage:
            usage = WorkflowUsage(tenant_id=(tenant_id or 0), month=month, emails_sent=0)
            session.add(usage)
            session.commit()
            session.refresh(usage)
        if quota is not None and usage.emails_sent >= quota and plan == "free":
            raise HTTPException(status_code=402, detail="Email quota exceeded for Free plan")
        ev = WorkflowEmailEvent(
            tenant_id=(tenant_id or 0), workflow_id=body.workflow_id, to_email=body.to, template_id=body.template_id
        )
        usage.emails_sent = int((usage.emails_sent or 0) + 1)
        usage.updated_at = datetime.now(timezone.utc)
        session.add(ev)
        session.commit()
    return {"queued": True}


@router.get("/usage")
async def workflows_usage(request: Request) -> Dict[str, Any]:
    """Get workflow usage stats"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        sub = (
            session.query(Subscription)
            .filter(Subscription.tenant_id == (tenant_id or 0))
            .order_by(Subscription.id.desc())
            .first()
        )
        plan = sub.plan_code if sub else "free"
        quota = _email_quota_for_plan(plan)
        month = datetime.now(timezone.utc).strftime("%Y-%m")
        usage = (
            session.query(WorkflowUsage)
            .filter(WorkflowUsage.tenant_id == (tenant_id or 0), WorkflowUsage.month == month)
            .one_or_none()
        )
        sent = int(usage.emails_sent) if usage else 0
        over = max(0, sent - (quota or sent))
        est = round(over * 0.001, 4)
    return {
        "month": month,
        "plan": plan,
        "emails_sent": sent,
        "emails_quota": quota,
        "emails_over_quota_estimate_usd": est
    }

