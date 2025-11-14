"""Helper utility functions"""
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import Request

from models.agents import TenantAgent
from models.campaigns import Lead


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

