# backend/services/providers/telnyx.py
import httpx
import secrets

BASE = "https://api.telnyx.com"  # per numeri/orders/… (semplificato)

async def purchase_number(api_key, connection_id, country, type_, area_code=None):
    """Pseudocall: in Telnyx serve API Key + Connection ID"""
    # Qui metti l'endpoint reale /phone_numbers/orders (semplificato)
    # Per ora restituiamo un mock
    mock_e164 = f"+49{secrets.token_urlsafe(9)}" if country == "DE" else f"+39{secrets.token_urlsafe(9)}"
    
    return {
        "status": "review",
        "provider_ref": f"ORD{secrets.token_urlsafe(8)}",
        "e164": mock_e164
    }

async def import_number(api_key, connection_id, e164):
    """Hosted/Porting flow starter (semplificato)"""
    return {
        "status": "pending",
        "provider_ref": f"IMP{secrets.token_urlsafe(8)}",
        "e164": e164
    }

async def verify_cli(api_key, connection_id, e164) -> bool:
    """Verifica che il numero sia nel tuo account e 'caller id' validato"""
    # TODO: Implementa chiamata reale a Telnyx API
    return True
