"""Encryption utilities for sensitive data (API keys, secrets)"""
import os
import base64
from typing import Optional
from cryptography.fernet import Fernet


def _get_encryption_key() -> bytes:
    """Get encryption key from env, generate if not exists (dev only)"""
    key_str = os.getenv("ENCRYPTION_KEY")
    if not key_str:
        # In production, ENCRYPTION_KEY must be set
        # In dev, generate a key (but warn)
        import warnings
        warnings.warn("ENCRYPTION_KEY not set, using dev key. Set it in production!")
        # Generate a key for dev (not secure, but works for development)
        key = Fernet.generate_key()
        return key
    # Key should be base64-encoded 32-byte key
    try:
        return base64.urlsafe_b64decode(key_str + "==")
    except Exception:
        # If not base64, try to use it directly (might be hex or raw)
        if len(key_str) == 44:  # Base64 Fernet key length
            return base64.urlsafe_b64decode(key_str)
        # Otherwise, derive a key from the string (not ideal, but works)
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"agoralia_encryption_salt",  # Fixed salt for dev (not secure)
            iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(key_str.encode()))


_fernet = None


def _get_fernet() -> Fernet:
    """Get Fernet instance (singleton)"""
    global _fernet
    if _fernet is None:
        key = _get_encryption_key()
        _fernet = Fernet(key)
    return _fernet


def encrypt_value(value: str) -> Optional[str]:
    """Encrypt a string value"""
    if not value:
        return None
    try:
        fernet = _get_fernet()
        encrypted = fernet.encrypt(value.encode("utf-8"))
        return base64.urlsafe_b64encode(encrypted).decode("ascii")
    except Exception as e:
        import logging
        logging.error(f"Encryption failed: {e}")
        return None


def decrypt_value(encrypted_value: Optional[str]) -> Optional[str]:
    """Decrypt an encrypted string value"""
    if not encrypted_value:
        return None
    try:
        fernet = _get_fernet()
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_value.encode("ascii"))
        decrypted = fernet.decrypt(encrypted_bytes)
        return decrypted.decode("utf-8")
    except Exception as e:
        import logging
        logging.error(f"Decryption failed: {e}")
        return None

