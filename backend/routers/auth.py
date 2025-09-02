"""
Authentication router for Agoralia API
"""
import base64
import json
import logging
import os
import secrets
import urllib.parse
import traceback
from datetime import datetime, timezone

import bcrypt
import requests
from fastapi import APIRouter, Depends, HTTPException, Response, Request, BackgroundTasks
from pydantic import BaseModel, EmailStr, constr
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db import get_db
from backend.models import User, UserAuth
from backend.security import pwd_context
from backend.sessions import (
    create_session,
    set_session_cookie,
    clear_session_cookie,
    read_session_cookie,
    get_user_id,
    destroy_session,
)
from backend.auth.session import get_current_user

logger = logging.getLogger("agoralia.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterIn(BaseModel):
    email: EmailStr
    password: constr(min_length=8)  # policy solo in registrazione
    name: str | None = None

class RegisterPayload(BaseModel):
    email: EmailStr
    password: str
    name: str

# set_session_cookie is now imported from backend.sessions

@router.post("/register", status_code=201)
def auth_register(payload: RegisterIn, response: Response, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        email = payload.email.lower().strip()
        existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        user = User(email=email, name=(payload.name or "").strip() or None, is_admin_global=False)
        db.add(user)
        db.flush()

        pass_hash = pwd_context.hash(payload.password)
        ua = UserAuth(user_id=user.id, provider="password", pass_hash=pass_hash)  # provider coerente con il tuo Enum
        db.add(ua)
        db.commit()

        if os.getenv("AUTO_LOGIN_AFTER_REGISTER", "true").lower() == "true":
            from backend.sessions import issue_session
            issue_session(response, str(user.id))

        return {"user": {"id": str(user.id), "email": user.email, "name": user.name or user.email.split("@")[0]}}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error("register failed: %s", e)
        logger.error("trace:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Registration failed")

class LoginIn(BaseModel):
    email: EmailStr
    password: str

@router.get("/me")
def auth_me(request: Request, user: User = Depends(get_current_user)):
    """Get current user info for header"""
    # Check if user is allowed to see demo data
    from backend.config import settings
    is_demo_allowed = user.email.lower() in settings.demo_admin_emails_list
    
    # Build roles list for frontend compatibility
    roles = []
    if bool(user.is_admin_global):
        roles.append("admin")
    if is_demo_allowed:
        roles.append("demo")
    
    return {
        "id": str(user.id), 
        "email": user.email, 
        "name": getattr(user, "name", None) or user.email.split("@")[0],
        "locale": getattr(user, 'locale', None) or "en-US",
        "is_admin_global": bool(user.is_admin_global),
        "is_admin": bool(user.is_admin_global),  # alias per compatibilità frontend
        "roles": roles,  # array per compatibilità frontend
        "email_verified": bool(getattr(user, 'email_verified_at', None)),
        "is_demo_allowed": is_demo_allowed,
    }

@router.post("/login")
def auth_login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password. Please try again.")

    ua = db.execute(
        select(UserAuth).where(UserAuth.user_id == user.id, UserAuth.provider == "password")
    ).scalar_one_or_none()
    if not ua or not pwd_context.verify(payload.password, ua.pass_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password. Please try again.")

    from backend.sessions import issue_session
    issue_session(response, str(user.id))
    return {"user": {"id": str(user.id), "email": user.email, "name": user.name or user.email.split("@")[0]}}

@router.post("/oauth/google/start")
def oauth_google_start(request: Request, response: Response):
    state = base64.urlsafe_b64encode(secrets.token_bytes(24)).decode().rstrip("=")
    
    client_id = os.getenv("OAUTH_GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "https://api.agoralia.app/auth/oauth/google/callback")
    
    logger.info(f"Google OAuth start - Client ID: {client_id[:10] if client_id else 'NOT_SET'}...")
    logger.info(f"Google OAuth start - Redirect URI: {redirect_uri}")
    
    # memorizza lo state server-side per 3 min (in-mem per ora)
    if not hasattr(request.app.state, 'oauth_state'):
        request.app.state.oauth_state = {}
    request.app.state.oauth_state[state] = True
    
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent"
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    
    logger.info(f"Google OAuth URL generated: {url[:100]}...")
    return {"auth_url": url, "state": state}

@router.get("/oauth/google/callback")
def oauth_google_callback(code: str, state: str, response: Response, request: Request, db: Session = Depends(get_db)):
    try:
        logger.info(f"Google OAuth callback started with code length: {len(code) if code else 0}")
        
        # verifica state
        if not state or not hasattr(request.app.state, 'oauth_state') or not request.app.state.oauth_state.pop(state, None):
            raise HTTPException(status_code=400, detail="Invalid state")
        
        if not code:
            raise HTTPException(status_code=400, detail="Missing code")
        
        # scambia code per token
        data = {
            "code": code,
            "client_id": os.getenv("OAUTH_GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("OAUTH_GOOGLE_CLIENT_SECRET"),
            "redirect_uri": os.getenv("GOOGLE_REDIRECT_URI", "https://api.agoralia.app/auth/oauth/google/callback"),
            "grant_type": "authorization_code",
        }
        
        logger.info(f"Exchanging code for token with client_id: {data['client_id'][:10]}...")
        
        tok = requests.post("https://oauth2.googleapis.com/token", data=data, timeout=10)
        if tok.status_code != 200:
            logger.error(f"Token exchange failed: {tok.status_code} - {tok.text}")
            raise HTTPException(status_code=500, detail=f"OAuth callback failed: {tok.text}")
        
        tokens = tok.json()
        access_token = tokens.get("access_token")
        if not access_token:
            raise HTTPException(status_code=500, detail="OAuth callback failed: missing access_token")
        
        logger.info(f"Token exchange successful, access_token length: {len(access_token) if access_token else 0}")
        
        # usa access_token per ottenere userinfo
        ui = requests.get("https://www.googleapis.com/oauth2/v2/userinfo", 
                         headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
        if ui.status_code != 200:
            logger.error(f"Userinfo fetch failed: {ui.status_code} - {ui.text}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch userinfo: {ui.text}")
        
        prof = ui.json()  # {email, name, id, picture, ...}
        email = prof.get("email", "").lower()
        name = prof.get("name")
        
        if not email:
            raise HTTPException(status_code=400, detail="Google account has no email")

        # trova/crea utente
        user = db.query(User).filter(User.email == email).first()
        if not user:
            try:
                user = User(
                    id=f"u_{int(datetime.now().timestamp())}",
                    email=email,
                    name=name or email.split("@")[0],
                    email_verified_at=datetime.now(timezone.utc),
                    created_at=datetime.now(timezone.utc),
                    last_login_at=None,
                    is_admin_global=False,
                )
                db.add(user)
                db.flush()
                
                user_auth = UserAuth(
                    id=f"ua_{int(datetime.now().timestamp())}",
                    user_id=user.id,
                    provider="google",
                    pass_hash=None,
                    provider_id=prof.get("id"),
                    created_at=datetime.now(timezone.utc),
                )
                db.add(user_auth)
                db.flush()
                
                # Commit esplicito per evitare timeout
                db.commit()
                logger.info(f"New user created successfully: {user.email}")
                
            except Exception as db_error:
                db.rollback()
                logger.error(f"Database error during user creation: {str(db_error)}")
                raise HTTPException(
                    status_code=503,
                    detail="Failed to create user account. Please try again."
                )

        # Commit finale per utenti esistenti
        try:
            db.commit()
            logger.info(f"Database transaction committed successfully for user: {user.email}")
        except Exception as commit_error:
            logger.error(f"Commit error: {str(commit_error)}")
            # Non facciamo rollback qui perché la sessione è già creata
        
        # redirect all'app (pagina "me" o dashboard) con cookie di sessione
        from fastapi.responses import RedirectResponse
        redirect_url = f"{os.getenv('FRONTEND_APP_URL', 'https://app.agoralia.app')}/"
        resp = RedirectResponse(url=redirect_url, status_code=303)  # 303 = post-login più "pulito"
        
        # crea sessione unificata sul redirect response
        from backend.sessions import issue_session
        issue_session(resp, str(user.id))
        
        logger.info(f"Session created for user {user.email}")
        logger.info(f"Redirecting to: {redirect_url}")
        
        return resp
        
    except Exception as e:
        logger.error(f"Google OAuth callback failed: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Gestione specifica per errori database
        if "psycopg2.OperationalError" in str(e) and "timeout" in str(e).lower():
            logger.error("Database timeout detected - this is a connection issue, not OAuth")
            raise HTTPException(
                status_code=503, 
                detail="Database temporarily unavailable. Please try again in a few moments."
            )
        elif "psycopg2" in str(e):
            logger.error("Database error detected - this is a database issue, not OAuth")
            raise HTTPException(
                status_code=503, 
                detail="Database error. Please try again later."
            )
        else:
            raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")

# Microsoft OAuth endpoints moved to dedicated router: backend/routers/auth_microsoft.py

@router.post("/logout", status_code=204)
def auth_logout(response: Response, request: Request):
    sid = read_session_cookie(request)
    if sid:
        destroy_session(sid)
    clear_session_cookie(response)
    return Response(status_code=204)

# RIMOSSO: definizione duplicata di /me che causava 500 invece di 401
# La prima definizione (linea 85) usa get_current_user correttamente
