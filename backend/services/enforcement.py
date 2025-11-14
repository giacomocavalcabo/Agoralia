"""Business logic enforcement functions"""
import asyncio
import pytz
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import Request, HTTPException

from models.compliance import DNCEntry, CostEvent
from models.billing import Subscription
from models.campaigns import Lead
from services.settings import get_settings
from services.compliance import get_country_rule, get_country_rule_for_number
from utils.auth import extract_tenant_id
from utils.helpers import country_iso_from_e164
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


def _is_quiet_hours(rule: Dict[str, Any], scheduled_time: Optional[datetime] = None) -> Tuple[bool, Optional[str]]:
    """Check if scheduled_time is within quiet hours for country rule"""
    if not rule.get("quiet_hours_enabled"):
        return (False, None)
    
    check_time = scheduled_time or datetime.now(timezone.utc)
    tz_str = rule.get("timezone", "UTC")
    
    try:
        tz = pytz.timezone(tz_str)
    except Exception:
        tz = pytz.UTC
    
    # Convert to country timezone
    local_time = check_time.astimezone(tz)
    weekday = local_time.weekday()  # 0=Monday, 6=Sunday
    
    # Check quiet hours based on day
    if weekday < 5:  # Monday-Friday
        hours = rule.get("quiet_hours_weekdays")
        if hours and hours != "forbidden":
            start_str, end_str = hours.split("-")
            start_h, start_m = map(int, start_str.split(":"))
            end_h, end_m = map(int, end_str.split(":"))
            now_minutes = local_time.hour * 60 + local_time.minute
            start_minutes = start_h * 60 + start_m
            end_minutes = end_h * 60 + end_m
            # Handle wrap-around (e.g., 21:00-08:00)
            if start_minutes > end_minutes:
                if now_minutes >= start_minutes or now_minutes < end_minutes:
                    return (True, f"Quiet hours: {hours}")
            else:
                if start_minutes <= now_minutes < end_minutes:
                    return (True, f"Quiet hours: {hours}")
    elif weekday == 5:  # Saturday
        hours = rule.get("quiet_hours_saturday")
        if hours == "forbidden":
            return (True, "Saturday calls forbidden")
        elif hours:
            start_str, end_str = hours.split("-")
            start_h, start_m = map(int, start_str.split(":"))
            end_h, end_m = map(int, end_str.split(":"))
            now_minutes = local_time.hour * 60 + local_time.minute
            start_minutes = start_h * 60 + start_m
            end_minutes = end_h * 60 + end_m
            if start_minutes > end_minutes:
                if now_minutes >= start_minutes or now_minutes < end_minutes:
                    return (True, f"Quiet hours: {hours}")
            else:
                if start_minutes <= now_minutes < end_minutes:
                    return (True, f"Quiet hours: {hours}")
    else:  # Sunday
        hours = rule.get("quiet_hours_sunday")
        if hours == "forbidden":
            return (True, "Sunday calls forbidden")
        elif hours:
            start_str, end_str = hours.split("-")
            start_h, start_m = map(int, start_str.split(":"))
            end_h, end_m = map(int, end_str.split(":"))
            now_minutes = local_time.hour * 60 + local_time.minute
            start_minutes = start_h * 60 + start_m
            end_minutes = end_h * 60 + end_m
            if start_minutes > end_minutes:
                if now_minutes >= start_minutes or now_minutes < end_minutes:
                    return (True, f"Quiet hours: {hours}")
            else:
                if start_minutes <= now_minutes < end_minutes:
                    return (True, f"Quiet hours: {hours}")
    
    return (False, None)


def check_compliance(
    session: Session,
    tenant_id: Optional[int],
    to_number: str,
    lead: Optional[Lead] = None,
    scheduled_time: Optional[datetime] = None,
    metadata: Optional[dict] = None,
) -> Dict[str, Any]:
    """
    Comprehensive compliance check for a call.
    Returns dict with check results and warnings.
    """
    from models.campaigns import Campaign
    from models.settings import AppSettings
    
    country_iso = country_iso_from_e164(to_number)
    if not country_iso:
        # No country detected - allow with warning
        return {
            "allowed": True,
            "country_iso": None,
            "warnings": ["Country could not be detected from phone number"],
            "checks": {},
        }
    
    # Load country rule
    rule = get_country_rule(tenant_id, country_iso, session)
    
    # Load campaign if available (from lead or metadata)
    campaign = None
    if lead and lead.campaign_id:
        campaign = session.get(Campaign, lead.campaign_id)
        if campaign and tenant_id is not None and campaign.tenant_id != tenant_id:
            campaign = None
    elif metadata and metadata.get("campaign_id"):
        campaign = session.get(Campaign, metadata.get("campaign_id"))
        if campaign and tenant_id is not None and campaign.tenant_id != tenant_id:
            campaign = None
    
    nature = (lead.nature if lead and lead.nature else (metadata or {}).get("nature", "unknown")) or "unknown"
    regime = rule.get("regime_b2c") if nature == "b2c" else rule.get("regime_b2b", "opt_out")
    
    checks: Dict[str, Any] = {}
    warnings: list[str] = []
    blocked = False
    block_reason: Optional[str] = None
    
    # 1. DNC Check (local)
    if _is_dnc_number(session, tenant_id, to_number):
        checks["dnc_local"] = {"passed": False, "message": "Number in local DNC list"}
        blocked = True
        block_reason = "DNC"
    else:
        checks["dnc_local"] = {"passed": True, "message": "Not in local DNC"}
        
        # DNC Registry check (if required)
        if rule.get("dnc_check_required") and rule.get("dnc_registry_enabled"):
            # TODO: Integrate with public DNC registry API
            checks["dnc_registry"] = {"passed": None, "message": "Public DNC check not yet implemented"}
            warnings.append(f"DNC registry check required for {country_iso} but API not implemented")
    
    # 2. Quiet Hours Check - Priority: Campaign > Default Settings > Country
    quiet_hours_rule: Dict[str, Any] = {}
    settings = get_settings()  # Load settings once for priority check
    settings_qh_enabled = bool(settings.quiet_hours_enabled or 0) if settings else False
    
    # Check campaign quiet hours first (highest priority)
    if campaign and campaign.quiet_hours_enabled is not None:
        if campaign.quiet_hours_enabled == 1:
            quiet_hours_rule = {
                "quiet_hours_enabled": True,
                "quiet_hours_weekdays": campaign.quiet_hours_weekdays,
                "quiet_hours_saturday": campaign.quiet_hours_saturday,
                "quiet_hours_sunday": campaign.quiet_hours_sunday,
                "timezone": campaign.quiet_hours_timezone or campaign.timezone or "UTC",
            }
        else:
            # Campaign explicitly disabled quiet hours
            quiet_hours_rule = {"quiet_hours_enabled": False}
    # Check default settings (second priority)
    elif settings_qh_enabled:
        quiet_hours_rule = {
            "quiet_hours_enabled": True,
            "quiet_hours_weekdays": settings.quiet_hours_weekdays,
            "quiet_hours_saturday": settings.quiet_hours_saturday,
            "quiet_hours_sunday": settings.quiet_hours_sunday,
            "timezone": settings.quiet_hours_timezone or "UTC",
        }
    # Check country rule (lowest priority)
    elif rule.get("quiet_hours_enabled"):
        quiet_hours_rule = {
            "quiet_hours_enabled": True,
            "quiet_hours_weekdays": rule.get("quiet_hours_weekdays"),
            "quiet_hours_saturday": rule.get("quiet_hours_saturday"),
            "quiet_hours_sunday": rule.get("quiet_hours_sunday"),
            "timezone": rule.get("timezone", "UTC"),
        }
    else:
        quiet_hours_rule = {"quiet_hours_enabled": False}
    
    # Determine source for quiet hours (for reporting)
    if campaign and campaign.quiet_hours_enabled == 1:
        quiet_hours_source = "campaign"
    elif settings_qh_enabled:
        quiet_hours_source = "default"
    elif rule.get("quiet_hours_enabled"):
        quiet_hours_source = "country"
    else:
        quiet_hours_source = "none"
    
    # Apply quiet hours check
    if quiet_hours_rule.get("quiet_hours_enabled"):
        in_quiet, reason = _is_quiet_hours(quiet_hours_rule, scheduled_time)
        if in_quiet:
            checks["quiet_hours"] = {"passed": False, "message": reason or "In quiet hours", "source": quiet_hours_source}
            blocked = True
            block_reason = block_reason or "Quiet hours"
        else:
            checks["quiet_hours"] = {"passed": True, "message": "Within allowed hours", "source": quiet_hours_source}
    else:
        checks["quiet_hours"] = {"passed": True, "message": "Quiet hours not configured"}
    
    # 3. Regime Check (B2B/B2C)
    if regime == "opt_in":
        # Opt-in: requires explicit consent
        if lead and lead.consent_status == "granted":
            checks["regime"] = {"passed": True, "message": f"Consent granted (regime: {regime})"}
        else:
            checks["regime"] = {"passed": False, "message": f"Opt-in regime requires explicit consent (regime: {regime})"}
            blocked = True
            block_reason = block_reason or "No consent (opt-in)"
    elif regime == "opt_out":
        # Opt-out: allowed unless explicitly denied
        if lead and lead.consent_status == "denied":
            checks["regime"] = {"passed": False, "message": "Consent explicitly denied"}
            blocked = True
            block_reason = block_reason or "Consent denied"
        else:
            checks["regime"] = {"passed": True, "message": f"Opt-out regime allows call (regime: {regime})"}
    else:  # "allowed"
        checks["regime"] = {"passed": True, "message": f"Calls allowed (regime: {regime})"}
    
    # 4. AI Disclosure Check
    if rule.get("ai_disclosure_required"):
        checks["ai_disclosure"] = {"passed": True, "required": True, "note": rule.get("ai_disclosure_note")}
        warnings.append("AI disclosure required for this country")
    else:
        checks["ai_disclosure"] = {"passed": True, "required": False}
    
    # 5. Legal Review Check (global setting)
    s = get_settings()
    require_legal = bool(s.require_legal_review or 0)
    if require_legal:
        accepted = bool((metadata or {}).get("legal_accepted", False))
        if not accepted:
            checks["legal_review"] = {"passed": False, "message": "Legal review not accepted"}
            blocked = True
            block_reason = block_reason or "Legal review"
        else:
            checks["legal_review"] = {"passed": True, "message": "Legal review accepted"}
    else:
        checks["legal_review"] = {"passed": True, "message": "Legal review not required"}
    
    return {
        "allowed": not blocked,
        "country_iso": country_iso,
        "nature": nature,
        "regime": regime,
        "checks": checks,
        "warnings": warnings,
        "block_reason": block_reason,
        "rule": rule,
    }


def enforce_compliance_or_raise(
    session: Session,
    request: Request,
    to_number: str,
    metadata: Optional[dict] = None,
    lead: Optional[Lead] = None,
    scheduled_time: Optional[datetime] = None,
) -> None:
    """Enforce compliance rules (DNC, quiet hours, regime, legal review) - raises HTTPException if blocked"""
    tenant_id = extract_tenant_id(request)
    result = check_compliance(session, tenant_id, to_number, lead, scheduled_time, metadata)
    
    if not result["allowed"]:
        reason = result.get("block_reason", "Compliance check failed")
        raise HTTPException(status_code=403, detail=f"Blocked: {reason}")


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

