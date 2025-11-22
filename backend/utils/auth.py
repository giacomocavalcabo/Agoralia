"""Authentication and authorization utilities"""
import os
import json
import base64
import hmac
import hashlib
from typing import Dict, Any, Optional, Tuple
from fastapi import Request, HTTPException


def _encode_token(payload: Dict[str, Any]) -> str:
    """Encode JWT-like token"""
    secret = os.getenv("JWT_SECRET", "devsecret")
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    body_b64 = base64.urlsafe_b64encode(body).rstrip(b"=")
    sig = hmac.new(secret.encode("utf-8"), body_b64, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=")
    return f"{body_b64.decode('ascii')}.{sig_b64.decode('ascii')}"


def _decode_token(token: str) -> Dict[str, Any]:
    """Decode and verify JWT-like token"""
    from datetime import datetime, timezone
    
    secret = os.getenv("JWT_SECRET", "devsecret")
    body_b64, sig_b64 = token.split(".")
    body_bytes = base64.urlsafe_b64decode(body_b64 + "==")
    expected_sig = hmac.new(secret.encode("utf-8"), body_b64.encode("ascii"), hashlib.sha256).digest()
    if not hmac.compare_digest(base64.urlsafe_b64encode(expected_sig).rstrip(b"="), sig_b64.encode("ascii")):
        raise HTTPException(status_code=401, detail="invalid token")
    payload = json.loads(body_bytes.decode("utf-8"))
    exp = payload.get("exp")
    if exp and datetime.now(timezone.utc).timestamp() > float(exp):
        raise HTTPException(status_code=401, detail="expired token")
    return payload


def extract_tenant_id(request: Optional[Request]) -> Optional[int]:
    """Extract tenant ID from request (Bearer token or X-Tenant-Id header)"""
    # Try bearer token first
    try:
        if request is not None:
            auth = request.headers.get("Authorization") or ""
            if auth.startswith("Bearer "):
                token = auth[7:]
                payload = _decode_token(token)
                tid = payload.get("tenant_id")
                if tid is not None:
                    return int(tid)
    except Exception:
        pass
    try:
        if request is None:
            return None
        v = request.headers.get("X-Tenant-Id") or request.query_params.get("tenant_id")
        return int(v) if v is not None and str(v).isdigit() else None
    except Exception:
        return None


def extract_user_id(request: Optional[Request]) -> Optional[int]:
    """Extract user ID from request Bearer token"""
    try:
        if request is not None:
            auth = request.headers.get("Authorization") or ""
            if auth.startswith("Bearer "):
                token = auth[7:]
                payload = _decode_token(token)
                user_id = payload.get("sub")
                if user_id is not None:
                    return int(user_id)
    except Exception:
        pass
    return None


def _hash_password(password: str, salt: Optional[bytes] = None) -> Tuple[str, str]:
    """Hash password with PBKDF2"""
    salt_bytes = salt or os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, 100_000)
    return salt_bytes.hex(), dk.hex()


def _verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    """Verify password against hash"""
    salt = bytes.fromhex(salt_hex)
    _, computed = _hash_password(password, salt)
    return hmac.compare_digest(computed, hash_hex)



