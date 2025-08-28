from typing import Dict
from sqlalchemy.orm import Session
from backend.models import Number  # e eventuali CallEvent/InboundEvent se li hai

def route_inbound(db: Session, provider: str, payload: Dict):
    """Route inbound call event and log it"""
    # 1) estrai e164 dal payload (twilio/telnyx formati diversi)
    e164 = _extract_e164(provider, payload)
    num = db.query(Number).filter(Number.e164==e164).first()
    
    # 2) logga evento (TODO: salva su InboundEvent)
    import logging
    logging.info(f"Inbound call event: provider={provider}, e164={e164}, number_found={bool(num)}")
    
    # 3) se num.inbound_enabled e inbound_agent_id -> OK (al momento solo log)
    if num and num.inbound_enabled:
        logging.info(f"Inbound routing: {e164} -> agent {num.inbound_agent_id}")
        return {"ok": True, "number_found": True, "routed": True, "agent_id": num.inbound_agent_id}
    
    return {"ok": True, "number_found": bool(num), "routed": False}

def _extract_e164(provider, p):
    """Extract E.164 number from provider-specific payload"""
    if provider == 'twilio':
        return p.get('To')  # Twilio Voice webhook
    if provider == 'telnyx':
        # es: payload['data']['payload']['to'] già in e164
        try: 
            return p['data']['payload']['to']
        except Exception: 
            return None
    return None
