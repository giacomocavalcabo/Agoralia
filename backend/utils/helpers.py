"""Helper utility functions"""
import os
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import Request

from models.agents import TenantAgent, PhoneNumber
from models.campaigns import Lead, Campaign


def normalize_e164(phone: Optional[str]) -> Optional[str]:
    """Normalize phone number to valid E.164 format
    
    Handles common cases:
    - Italian numbers with leading 0: 08994869 -> +3908994869
    - Italian numbers with wrong prefix: +3408994869 -> +3908994869
    - Already E.164: +3908994869 -> +3908994869
    - Numbers without +: 3908994869 -> +3908994869
    """
    if not phone:
        return None
    
    # Remove whitespace
    s = str(phone).strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if not s:
        return None
    
    # If already starts with +, validate format
    if s.startswith("+"):
        # Remove + to work with digits
        digits = s[1:]
        if not digits.isdigit():
            return None
        
        # Fix common Italian number errors: +3408994869 -> +3908994869
        # Italian area codes start with 0 (089, 02, 011, etc.)
        # If we see +34 followed by a number starting with 0, it's likely Italian
        if s.startswith("+34") and len(digits) > 3 and digits[3] == "0":
            # Convert +34 + 0 + rest -> +39 + rest (without leading 0)
            italian_digits = digits[3:]  # Remove +34 prefix
            if italian_digits.startswith("0"):
                italian_digits = italian_digits[1:]  # Remove leading 0
            return f"+39{italian_digits}"
        
        # Check if it's a malformed Italian number: +30... or other wrong prefixes
        # Italian mobile: 3XX, landline: 0XX
        # If we have +3 followed by 2 digits starting with 0, it's likely Italian
        if len(digits) >= 3:
            if digits[0] == "3" and len(digits) > 3 and digits[3] == "0":
                # Could be +30X or +34X followed by 0, convert to Italian
                rest = digits[3:]
                if rest.startswith("0"):
                    rest = rest[1:]
                return f"+39{rest}"
        
        return s  # Already valid E.164
    
    # If no +, assume Italian if starts with 0, otherwise add +
    if s.startswith("0"):
        # Italian number with leading 0: 08994869 -> +3908994869
        s = s[1:]  # Remove leading 0
        return f"+39{s}"
    
    # If all digits, add +
    if s.isdigit():
        # Check if it looks like Italian (10 digits starting with 3 or 0X)
        if len(s) == 10:
            if s[0] == "3":
                # Mobile: 38994869 -> +3938994869
                return f"+39{s}"
            elif s[0] == "0":
                # Landline: 08994869 -> +3908994869 (already removed 0 above)
                return f"+39{s[1:]}"
        return f"+{s}"
    
    return None


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
    from utils.auth import extract_tenant_id
    
    # Order: provided -> lead.preferred_lang -> settings.default_lang -> en-US
    if provided_lang:
        return provided_lang
    if to_number:
        # Use first() instead of one_or_none() since there might be multiple leads with same phone
        # Filter by tenant_id if available for better isolation
        tenant_id = extract_tenant_id(request)
        query = session.query(Lead).filter(Lead.phone == to_number)
        if tenant_id is not None:
            query = query.filter(Lead.tenant_id == tenant_id)
        lead = query.order_by(Lead.id.desc()).first()  # Get most recent lead
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

