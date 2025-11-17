"""Authentication endpoints"""
import os
from typing import Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config.database import engine
from models.users import User
from utils.auth import extract_tenant_id, _hash_password, _verify_password, _encode_token

router = APIRouter()


class AuthRegister(BaseModel):
    email: str
    password: str
    name: str | None = None
    admin_secret: str | None = None


class AuthLogin(BaseModel):
    email: str
    password: str


@router.post("/register")
async def auth_register(body: AuthRegister):
    """Register new user"""
    try:
        with Session(engine) as session:
            existing = session.query(User).filter(User.email == body.email.lower()).one_or_none()
            if existing:
                raise HTTPException(status_code=400, detail="email exists")
            salt, h = _hash_password(body.password)
            
            # Check if admin_secret is provided
            is_admin = 1 if (body.admin_secret and body.admin_secret == os.getenv("ADMIN_SIGNUP_SECRET")) else 0
            
            user = User(tenant_id=0, email=body.email.lower(), name=body.name, password_salt=salt, password_hash=h, is_admin=is_admin)
            session.add(user)
            session.commit()
            user.tenant_id = user.id
            session.commit()
            
            # If no admin_secret was provided, check if this is the only user in the workspace
            # If so, make them admin automatically
            if is_admin == 0:
                user_count = session.query(User).filter(User.tenant_id == user.tenant_id).count()
                if user_count == 1:
                    user.is_admin = 1
                    session.commit()
                    is_admin = 1
            
            token = _encode_token({
                "sub": user.id,
                "tenant_id": user.tenant_id,
                "is_admin": bool(user.is_admin),
                "exp": (datetime.now(timezone.utc) + timedelta(days=7)).timestamp()
            })
            return {"token": token, "tenant_id": user.tenant_id, "is_admin": bool(user.is_admin)}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = str(e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Registration failed: {error_detail}")


@router.post("/login")
async def auth_login(body: AuthLogin):
    """Login user"""
    try:
        with Session(engine) as session:
            user = session.query(User).filter(User.email == body.email.lower()).one_or_none()
            if not user or not _verify_password(body.password, user.password_salt, user.password_hash):
                raise HTTPException(status_code=401, detail="invalid credentials")
            
            # Check if user should be admin (if they're the only one in workspace)
            user_count = session.query(User).filter(User.tenant_id == user.tenant_id).count()
            if user_count == 1 and user.is_admin == 0:
                user.is_admin = 1
                session.commit()
            
            token = _encode_token({
                "sub": user.id,
                "tenant_id": user.tenant_id,
                "is_admin": bool(user.is_admin),
                "exp": (datetime.now(timezone.utc) + timedelta(days=7)).timestamp()
            })
            return {"token": token, "tenant_id": user.tenant_id, "is_admin": bool(user.is_admin)}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = str(e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Login failed: {error_detail}")


@router.post("/google/start")
async def auth_google_start(body: dict):
    """Start Google OAuth login"""
    import urllib.parse
    import os
    # Supporta sia OAUTH_GOOGLE_CLIENT_ID che GOOGLE_CLIENT_ID (per retrocompatibilità)
    client_id = os.getenv("OAUTH_GOOGLE_CLIENT_ID") or os.getenv("GOOGLE_CLIENT_ID")
    
    if not client_id:
        raise HTTPException(status_code=500, detail="OAUTH_GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID missing")
    scopes = "openid email profile"
    params = {
        "client_id": client_id,
        "redirect_uri": body.get("redirect_uri"),
        "response_type": "code",
        "scope": scopes,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return {"auth_url": url}


@router.post("/google/callback")
async def auth_google_callback(body: dict):
    """Handle Google OAuth callback"""
    import httpx
    import base64
    import json as _json
    import os
    from models.users import User
    
    token_url = "https://oauth2.googleapis.com/token"
    # Supporta sia OAUTH_GOOGLE_* che GOOGLE_* (per retrocompatibilità)
    client_id = os.getenv("OAUTH_GOOGLE_CLIENT_ID") or os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("OAUTH_GOOGLE_CLIENT_SECRET") or os.getenv("GOOGLE_CLIENT_SECRET")
    
    if not client_id:
        raise HTTPException(status_code=500, detail="OAUTH_GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID missing")
    if not client_secret:
        raise HTTPException(status_code=500, detail="OAUTH_GOOGLE_CLIENT_SECRET or GOOGLE_CLIENT_SECRET missing")
    
    data = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": body.get("redirect_uri"),
        "code": body.get("code"),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(token_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=str(resp.text))
        tok = resp.json()
    id_token = tok.get("id_token") or ""
    
    # Decode JWT without verification (for MVP)
    def _decode_jwt_no_verify(id_token: str) -> Dict[str, Any]:
        try:
            parts = id_token.split(".")
            if len(parts) < 2:
                return {}
            payload_b64 = parts[1]
            padding = "=" * (-len(payload_b64) % 4)
            payload = base64.urlsafe_b64decode(payload_b64 + padding)
            return _json.loads(payload.decode("utf-8"))
        except Exception:
            return {}
    
    info = _decode_jwt_no_verify(id_token)
    email = (info.get("email") or "").lower()
    name = info.get("name") or info.get("given_name") or email.split("@")[0]
    if not email:
        raise HTTPException(status_code=400, detail="no email in id_token")
    with Session(engine) as session:
        user = session.query(User).filter(User.email == email).one_or_none()
        if not user:
            salt, h = _hash_password(os.urandom(16).hex())
            user = User(tenant_id=0, email=email, name=name, password_salt=salt, password_hash=h, is_admin=0)
            session.add(user)
            session.commit()
            user.tenant_id = user.id
            session.commit()
            
            # If this is the only user in the workspace, make them admin automatically
            user_count = session.query(User).filter(User.tenant_id == user.tenant_id).count()
            if user_count == 1:
                user.is_admin = 1
                session.commit()
        else:
            # On login, also check if user should be admin (if they're the only one in workspace)
            user_count = session.query(User).filter(User.tenant_id == user.tenant_id).count()
            if user_count == 1 and user.is_admin == 0:
                user.is_admin = 1
                session.commit()
        
        token = _encode_token({
            "sub": user.id,
            "tenant_id": user.tenant_id,
            "is_admin": bool(user.is_admin),
            "exp": (datetime.now(timezone.utc) + timedelta(days=7)).timestamp()
        })
        return {"token": token, "tenant_id": user.tenant_id, "is_admin": bool(user.is_admin)}


@router.get("/me")
async def auth_me(request: Request):
    """Return basic info about the authenticated user based on Bearer token."""
    try:
        auth = request.headers.get("Authorization") or ""
        if not auth.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="missing bearer token")
        token = auth[7:]
        from utils.auth import _decode_token
        payload = _decode_token(token)
        user_id = int(payload.get("sub") or 0)
        tenant_id = int(payload.get("tenant_id") or 0)
        is_admin = bool(payload.get("is_admin") or False)
        with Session(engine) as session:
            user = session.query(User).filter(User.id == user_id).one_or_none()
            if user:
                # Check if user should be admin (if they're the only one in workspace)
                user_count = session.query(User).filter(User.tenant_id == user.tenant_id).count()
                if user_count == 1 and user.is_admin == 0:
                    user.is_admin = 1
                    session.commit()
                    is_admin = True
            
            return {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "is_admin": bool(user.is_admin) if user else is_admin,
                "email": user.email if user else None,
                "name": user.name if user else None,
            }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=401, detail="invalid token")

