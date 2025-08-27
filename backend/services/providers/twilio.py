# backend/services/providers/twilio.py
import httpx
import secrets

BASE = "https://api.twilio.com"  # per numeri/addresses/… (semplificato)

async def purchase_number(api_key, account_sid, country, type_, area_code=None):
    """Pseudocall: in Twilio serve Account SID + Auth Token (usiamo api_key come token)"""
    # Qui metti l'endpoint reale /IncomingPhoneNumbers (semplificato)
    # Per ora restituiamo un mock
    mock_e164 = f"+1{secrets.token_urlsafe(9)}" if country == "US" else f"+39{secrets.token_urlsafe(9)}"
    
    return {
        "status": "pending",
        "provider_ref": f"PN{secrets.token_urlsafe(8)}",
        "e164": mock_e164
    }

async def import_number(api_key, account_sid, e164):
    """Hosted/Porting flow starter (semplificato)"""
    return {
        "status": "pending",
        "provider_ref": f"PRT{secrets.token_urlsafe(8)}",
        "e164": e164
    }

async def verify_cli(api_key, account_sid, e164) -> bool:
    """Verifica che il numero sia nel tuo account e 'caller id' validato"""
    # TODO: Implementa chiamata reale a Twilio API
    return True
