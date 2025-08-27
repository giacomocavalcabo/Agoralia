# backend/services/telephony.py
import re
from fastapi import HTTPException
from typing import Optional

E164 = re.compile(r"^\+[1-9]\d{6,14}$")

def assert_e164(phone: str):
    """Validate phone number is in E.164 format"""
    if phone and not E164.match(phone):
        raise HTTPException(status_code=422, detail="Phone number must be E.164 (+12125551234)")

def is_hosted(number) -> bool:
    """
    Trattiamo come 'hosted' SOLO i numeri acquistati/portati dentro Retell.
    Adattare in base al tuo modello:
      - se hai number.origin: 'retell'/'retell_imported'/'external_forward'
      - altrimenti usa number.provider: 'retell' vs 'twilio'/'telnyx'/...
    """
    origin = getattr(number, "origin", None)
    provider = getattr(number, "provider", None)

    if origin in ("retell", "retell_imported"):
        return True
    if provider in ("retell", "retell_ai", "retellai"):
        return True
    return False

def enforce_outbound_policy(number, outbound_enabled: bool):
    """Policy corrente: outbound SOLO con caller ID ospitato (Hosted)"""
    if outbound_enabled and not is_hosted(number):
        raise HTTPException(
            status_code=400, 
            detail="Outbound not allowed: caller ID must be Retell-hosted."
        )

def validate_number_binding(number_id: str, workspace_id: str, db) -> "Number":
    """Validate number exists and belongs to workspace"""
    from backend.models import Number
    
    number = db.query(Number).filter(
        Number.id == number_id,
        Number.workspace_id == workspace_id
    ).first()
    
    if not number:
        raise HTTPException(status_code=404, detail="Number not found")
    
    return number
