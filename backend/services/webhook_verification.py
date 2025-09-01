# backend/services/webhook_verification.py
import hmac
import hashlib
import time
import logging
from typing import Optional
from fastapi import HTTPException, Request
from backend.config.settings import settings

logger = logging.getLogger(__name__)

class WebhookVerifier:
    """Verifica firme webhook per Twilio e Telnyx"""
    
    @staticmethod
    def verify_twilio_signature(request: Request, body: bytes, signature: str, timestamp: str) -> bool:
        """Verifica firma webhook Twilio"""
        try:
            # Verifica timestamp (non più vecchio di 5 minuti)
            if timestamp:
                request_time = int(timestamp)
                current_time = int(time.time())
                if current_time - request_time > 300:  # 5 minuti
                    logger.warning("Twilio webhook timestamp too old")
                    return False
            
            # Costruisci la stringa da firmare
            auth_token = settings.TWILIO_AUTH_TOKEN
            if not auth_token:
                logger.error("TWILIO_AUTH_TOKEN not configured")
                return False
            
            # Twilio usa: auth_token + URL + body
            url = str(request.url)
            string_to_sign = auth_token + url + body.decode('utf-8')
            
            # Calcola HMAC-SHA1
            expected_signature = hmac.new(
                auth_token.encode('utf-8'),
                string_to_sign.encode('utf-8'),
                hashlib.sha1
            ).hexdigest()
            
            # Confronta firme (timing-safe)
            return hmac.compare_digest(signature, expected_signature)
            
        except Exception as e:
            logger.exception("Error verifying Twilio signature")
            return False
    
    @staticmethod
    def verify_telnyx_signature(request: Request, body: bytes, signature: str, timestamp: str) -> bool:
        """Verifica firma webhook Telnyx"""
        try:
            # Verifica timestamp (non più vecchio di 5 minuti)
            if timestamp:
                request_time = int(timestamp)
                current_time = int(time.time())
                if current_time - request_time > 300:  # 5 minuti
                    logger.warning("Telnyx webhook timestamp too old")
                    return False
            
            # Telnyx usa: timestamp + body + secret
            telnyx_secret = getattr(settings, 'TELNYX_WEBHOOK_SECRET', None)
            if not telnyx_secret:
                logger.error("TELNYX_WEBHOOK_SECRET not configured")
                return False
            
            # Costruisci la stringa da firmare
            string_to_sign = timestamp + "." + body.decode('utf-8')
            
            # Calcola HMAC-SHA256
            expected_signature = hmac.new(
                telnyx_secret.encode('utf-8'),
                string_to_sign.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            # Confronta firme (timing-safe)
            return hmac.compare_digest(signature, expected_signature)
            
        except Exception as e:
            logger.exception("Error verifying Telnyx signature")
            return False
    
    @staticmethod
    def verify_webhook(request: Request, body: bytes, provider: str) -> bool:
        """Verifica webhook per provider specifico"""
        # Estrai headers di firma
        if provider == "twilio":
            signature = request.headers.get("X-Twilio-Signature")
            timestamp = request.headers.get("X-Twilio-Timestamp")
            
            if not signature:
                logger.warning("Missing X-Twilio-Signature header")
                return False
            
            return WebhookVerifier.verify_twilio_signature(request, body, signature, timestamp)
            
        elif provider == "telnyx":
            signature = request.headers.get("Telnyx-Signature-Ed25519")
            timestamp = request.headers.get("Telnyx-Timestamp")
            
            if not signature:
                logger.warning("Missing Telnyx-Signature-Ed25519 header")
                return False
            
            return WebhookVerifier.verify_telnyx_signature(request, body, signature, timestamp)
        
        else:
            logger.error(f"Unknown provider for webhook verification: {provider}")
            return False

# Funzione helper per dependency injection
def require_valid_webhook_signature(provider: str):
    """Dependency per verificare firma webhook"""
    async def verify_signature(request: Request):
        # Leggi il body
        body = await request.body()
        
        if not WebhookVerifier.verify_webhook(request, body, provider):
            logger.warning(f"Invalid webhook signature for {provider}")
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "invalid_signature",
                    "message": "Webhook signature verification failed"
                }
            )
        
        return True
    
    return verify_signature
