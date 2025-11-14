"""Helper utility functions"""
import os
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import Request

from models.agents import TenantAgent, PhoneNumber
from models.campaigns import Lead, Campaign


def country_iso_from_e164(e164: Optional[str]) -> Optional[str]:
    """Extract country ISO from E.164 number"""
    if not e164:
        return None
    # Minimal mapping - in production use a proper library like phonenumbers
    mapping = {
        "+39": "IT",
        "+33": "FR",
        "+34": "ES",
        "+49": "DE",
        "+351": "PT",
        "+41": "CH",
        "+44": "GB",
        "+212": "MA",
        "+216": "TN",
        "+213": "DZ",
        "+20": "EG",
        "+1": "US",
        "+91": "IN",
        "+81": "JP",
        "+86": "CN",
        "+7": "RU",
        "+61": "AU",
        "+55": "BR",
        "+52": "MX",
    }
    # Find longest prefix match
    best = None
    for prefix, iso in mapping.items():
        if e164.startswith(prefix) and (best is None or len(prefix) > len(best[0])):
            best = (prefix, iso)
    return best[1] if best else None


def _resolve_lang(session: Session, request: Request, to_number: Optional[str], provided_lang: Optional[str]) -> str:
    """Resolve language for a call"""
    from services.settings import get_settings
    
    # Order: provided -> lead.preferred_lang -> settings.default_lang -> en-US
    if provided_lang:
        return provided_lang
    if to_number:
        lead = session.query(Lead).filter(Lead.phone == to_number).one_or_none()
        if lead and lead.preferred_lang:
            return lead.preferred_lang
    s = get_settings()
    if s.default_lang:
        return s.default_lang
    return "en-US"


def _resolve_agent(session: Session, tenant_id: Optional[int], kind: str, lang: str) -> Tuple[Optional[str], bool]:
    """Resolve agent ID for a call
    
    Returns: (agent_id, is_multi)
    """
    row = (
        session.query(TenantAgent)
        .filter(TenantAgent.tenant_id == (tenant_id or 0), TenantAgent.kind == kind, TenantAgent.lang == lang)
        .one_or_none()
    )
    if row:
        return row.agent_id, bool(row.is_multi)
    # Fallback to any multi for kind
    multi = (
        session.query(TenantAgent)
        .filter(TenantAgent.tenant_id == (tenant_id or 0), TenantAgent.kind == kind, TenantAgent.is_multi == 1)
        .first()
    )
    if multi:
        return multi.agent_id, True
    return None, False


def _resolve_from_number(
    session: Session,
    from_number: Optional[str] = None,
    campaign_id: Optional[int] = None,
    lead_id: Optional[int] = None,
    tenant_id: Optional[int] = None,
) -> Optional[str]:
    """Resolve from_number (caller ID) with priority:
    1. Explicit from_number parameter
    2. Campaign.from_number_id -> PhoneNumber.e164
    3. Settings.default_from_number
    4. DEFAULT_FROM_NUMBER env var
    
    Args:
        session: SQLAlchemy session
        from_number: Explicit from_number (highest priority)
        campaign_id: Campaign ID to resolve from_number_id
        lead_id: Lead ID to get campaign_id from Lead
        tenant_id: Tenant ID for tenant isolation
    
    Returns:
        E.164 phone number string or None
    """
    # 1. Explicit from_number (highest priority)
    if from_number:
        return from_number
    
    # 2. Resolve from campaign (via campaign_id or lead_id)
    resolved_campaign_id = campaign_id
    if not resolved_campaign_id and lead_id:
        lead = session.get(Lead, lead_id)
        if lead and lead.campaign_id:
            resolved_campaign_id = lead.campaign_id
    
    if resolved_campaign_id:
        campaign = session.get(Campaign, resolved_campaign_id)
        if campaign:
            # Check tenant isolation
            if tenant_id is not None and campaign.tenant_id != tenant_id:
                campaign = None
            elif campaign.from_number_id:
                phone = session.get(PhoneNumber, campaign.from_number_id)
                if phone:
                    # Check tenant isolation for phone number
                    if tenant_id is None or phone.tenant_id == tenant_id or phone.tenant_id is None:
                        return phone.e164
    
    # 3. Settings.default_from_number
    try:
        from services.settings import get_settings
        settings = get_settings()
        if settings and settings.default_from_number:
            return settings.default_from_number
    except Exception:
        pass
    
    # 4. Fallback to env var
    return os.getenv("DEFAULT_FROM_NUMBER")

