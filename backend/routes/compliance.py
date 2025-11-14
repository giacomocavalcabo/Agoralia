"""Compliance endpoints"""
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config.database import engine
from models.campaigns import Lead
from models.compliance import CountryRule, DNCEntry
from services.compliance import get_country_rule, get_country_rule_for_number
from services.enforcement import check_compliance
from utils.auth import extract_tenant_id
from utils.tenant import tenant_session
from utils.helpers import country_iso_from_e164

router = APIRouter()


# ============================================================================
# Compliance Check Endpoint
# ============================================================================

@router.get("/check")
async def compliance_check(
    request: Request,
    to_number: Optional[str] = Query(None, description="E.164 phone number"),
    country_iso: Optional[str] = Query(None, description="ISO country code (if to_number not provided)"),
    lead_id: Optional[int] = Query(None, description="Lead ID for context"),
    nature: Optional[str] = Query(None, description="Contact nature: 'b2b' or 'b2c'"),
    scheduled_time: Optional[str] = Query(None, description="Scheduled call time (ISO 8601)"),
) -> Dict[str, Any]:
    """
    Get compliance information for a phone number or country.
    Returns indicators and warnings for UI display.
    """
    tenant_id = extract_tenant_id(request)
    
    # Determine country
    country = None
    phone = None
    if to_number:
        phone = to_number
        country = country_iso_from_e164(to_number)
    elif country_iso:
        country = country_iso.upper()
    else:
        raise HTTPException(status_code=400, detail="Either 'to_number' or 'country_iso' must be provided")
    
    if not country:
        raise HTTPException(status_code=400, detail="Could not determine country from phone number")
    
    # Load lead if provided
    lead = None
    if lead_id:
        with Session(engine) as session:
            lead = session.get(Lead, lead_id)
            if lead and tenant_id is not None and lead.tenant_id != tenant_id:
                lead = None
    
    # Use nature from lead if not provided
    if not nature and lead:
        nature = lead.nature or "unknown"
    nature = nature or "unknown"
    
    # Parse scheduled_time
    scheduled_dt = None
    if scheduled_time:
        try:
            scheduled_dt = datetime.fromisoformat(scheduled_time.replace("Z", "+00:00"))
        except Exception:
            pass
    
    # Run compliance check
    with Session(engine) as session:
        result = check_compliance(
            session,
            tenant_id,
            phone or f"+{country}",  # Dummy number if only country provided
            lead,
            scheduled_dt,
            {"nature": nature} if nature != "unknown" else None,
        )
    
    # Get country rule for additional info
    with Session(engine) as session:
        rule = get_country_rule(tenant_id, country, session)
    
    # Generate indicators for UI
    indicators: Dict[str, str] = {}
    indicator_messages: Dict[str, str] = {}
    
    # DNC indicator
    dnc_local = result["checks"].get("dnc_local", {})
    if dnc_local.get("passed") is False:
        indicators["dnc"] = "❌"
        indicator_messages["dnc"] = "Number in DNC list"
    elif rule.get("dnc_check_required"):
        indicators["dnc"] = "⚠️"
        indicator_messages["dnc"] = f"DNC registry check required ({rule.get('dnc_registry_name', 'public registry')})"
    else:
        indicators["dnc"] = "✅"
        indicator_messages["dnc"] = "Not in DNC"
    
    # Quiet hours indicator
    quiet_hours = result["checks"].get("quiet_hours", {})
    if quiet_hours.get("passed") is False:
        indicators["quiet_hours"] = "❌"
        indicator_messages["quiet_hours"] = quiet_hours.get("message", "In quiet hours")
    elif rule.get("quiet_hours_enabled"):
        indicators["quiet_hours"] = "✅"
        indicator_messages["quiet_hours"] = f"Quiet hours: {rule.get('quiet_hours_weekdays', 'N/A')}"
    else:
        indicators["quiet_hours"] = "✅"
        indicator_messages["quiet_hours"] = "No quiet hours restriction"
    
    # Regime indicator
    regime_check = result["checks"].get("regime", {})
    if regime_check.get("passed") is False:
        indicators["regime"] = "❌"
        indicator_messages["regime"] = regime_check.get("message", "Regime check failed")
    else:
        regime = result.get("regime", "opt_out")
        indicators["regime"] = "✅" if regime == "allowed" else "⚠️"
        indicator_messages["regime"] = f"{nature.upper()} regime: {regime}"
    
    # Consent indicator
    if result.get("nature") != "unknown":
        consent_status = lead.consent_status if lead else None
        if consent_status == "granted":
            indicators["consent"] = "✅"
            indicator_messages["consent"] = "Consent granted"
        elif consent_status == "denied":
            indicators["consent"] = "❌"
            indicator_messages["consent"] = "Consent denied"
        else:
            indicators["consent"] = "⚠️"
            indicator_messages["consent"] = "Consent status unknown"
    else:
        indicators["consent"] = "⚠️"
        indicator_messages["consent"] = "Contact nature unknown"
    
    # AI Disclosure indicator
    ai_disclosure = result["checks"].get("ai_disclosure", {})
    if ai_disclosure.get("required"):
        indicators["ai_disclosure"] = "⚠️"
        indicator_messages["ai_disclosure"] = "AI disclosure required"
    else:
        indicators["ai_disclosure"] = "✅"
        indicator_messages["ai_disclosure"] = "AI disclosure not required"
    
    # Overall status
    can_call = result["allowed"] and not any(
        indicators[k] == "❌" for k in ["dnc", "quiet_hours", "regime", "consent"]
    )
    
    return {
        "country_iso": country,
        "nature": nature,
        "can_call": can_call,
        "regime": result.get("regime"),
        "allowed": result["allowed"],
        "checks": result["checks"],
        "warnings": result.get("warnings", []),
        "indicators": indicators,
        "indicator_messages": indicator_messages,
        "block_reason": result.get("block_reason"),
        "rule": {
            "dnc_registry_name": rule.get("dnc_registry_name"),
            "quiet_hours_weekdays": rule.get("quiet_hours_weekdays"),
            "ai_disclosure_required": rule.get("ai_disclosure_required"),
            "recording_basis": rule.get("recording_basis"),
        },
    }


# ============================================================================
# Country Rules Management
# ============================================================================

@router.get("/rules")
async def list_country_rules(
    request: Request,
    country_iso: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """List country rules (tenant overrides or defaults from JSON)"""
    from services.compliance import _load_compliance_json
    tenant_id = extract_tenant_id(request)
    
    # Always return list from JSON, not just DB rules
    json_data = _load_compliance_json()
    items = []
    
    # Get DB rules for tenant overrides
    with tenant_session(request) as session:
        db_rules = {}
        query = session.query(CountryRule)
        if tenant_id is not None:
            query = query.filter(
                (CountryRule.tenant_id == tenant_id) | (CountryRule.tenant_id.is_(None))
            )
        if country_iso:
            query = query.filter(CountryRule.country_iso == country_iso.upper())
        
        for r in query.all():
            db_rules[r.country_iso] = r
        
        # Include all countries from JSON
        for iso, json_rule in json_data.items():
            if country_iso and iso.upper() != country_iso.upper():
                continue
            
            # Check if tenant has override
            rule_data = get_country_rule(tenant_id, iso, session)
            
            items.append({
                "id": None,  # JSON rules don't have DB ID
                "tenant_id": None,  # JSON rules are global
                "country_iso": iso,
                "regime_b2b": rule_data.get("regime_b2b"),
                "regime_b2c": rule_data.get("regime_b2c"),
                "dnc_registry_enabled": rule_data.get("dnc_registry_enabled"),
                "dnc_registry_name": rule_data.get("dnc_registry_name"),
                "quiet_hours_enabled": rule_data.get("quiet_hours_enabled"),
                "quiet_hours_weekdays": rule_data.get("quiet_hours_weekdays"),
                "ai_disclosure_required": rule_data.get("ai_disclosure_required"),
            })
        
        # Sort by country_iso
        items.sort(key=lambda x: x.get("country_iso", ""))
        
        return {"items": items}


@router.get("/rules/{country_iso}")
async def get_country_rule_endpoint(
    request: Request,
    country_iso: str,
) -> Dict[str, Any]:
    """Get country rule for specific country"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        rule = get_country_rule(tenant_id, country_iso.upper(), session)
        return rule or {"error": "Country rule not found"}

