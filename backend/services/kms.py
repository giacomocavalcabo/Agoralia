"""
KMS wrapper for encrypting/decrypting integration secrets
Uses APP_KMS_KEY from settings with Fernet encryption
"""

import base64
import json
from cryptography.fernet import Fernet, InvalidToken
from backend.config.settings import settings

# Simple key derivation from APP_KMS_KEY
_key = base64.urlsafe_b64encode(settings.APP_KMS_KEY.encode("utf-8").ljust(32, b"0")[:32])
_f = Fernet(_key)

def encrypt_str(s: str) -> str:
    """Encrypt a string using Fernet"""
    return _f.encrypt(s.encode("utf-8")).decode("utf-8")

def decrypt_str(s: str) -> str:
    """Decrypt a string using Fernet"""
    try:
        return _f.decrypt(s.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        raise ValueError("Invalid encrypted string")

def encrypt_json(obj: dict) -> str:
    """Encrypt a JSON object"""
    return encrypt_str(json.dumps(obj))

def decrypt_json(s: str) -> dict:
    """Decrypt a JSON object"""
    return json.loads(decrypt_str(s))
