# backend/routers/auth_microsoft.py
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from urllib.parse import urlencode
import os, secrets, time, requests, logging

from backend.db import get_db
from backend.config import settings
from backend.models import User  # adatta al tuo path
from backend.sessions import issue_session  # la funzione che imposta il cookie

logger = logging.getLogger("auth.microsoft")

router = APIRouter(tags=["auth"])

AUTH_BASE = "https://login.microsoftonline.com"
GRAPH_ME = "https://graph.microsoft.com/v1.0/me"

SCOPES = [
    "openid", "profile", "email", "offline_access",
    "https://graph.microsoft.com/User.Read",
]

def _tenant() -> str:
    return os.getenv("OAUTH_MS_TENANT", settings.OAUTH_MS_TENANT or "common")

def _redirect_uri() -> str:
    return os.getenv("MICROSOFT_REDIRECT_URI") or f"{settings.APP_BASE_URL}/auth/oauth/microsoft/callback"

def _authorize_url() -> str:
    return f"{AUTH_BASE}/{_tenant()}/oauth2/v2.0/authorize"

def _token_url() -> str:
    return f"{AUTH_BASE}/{_tenant()}/oauth2/v2.0/token"

@router.post("/auth/oauth/microsoft/start")
def microsoft_start(request: Request):
    req_id = f"msstart_{int(time.time())}_{secrets.token_hex(3)}"
    state = secrets.token_urlsafe(24)
    # salva state per 3 minuti max (best-effort, in-mem)
    request.app.state.oauth_state[state] = {"t": time.time(), "req_id": req_id}

    params = {
        "client_id": settings.OAUTH_MS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": _redirect_uri(),
        "response_mode": "query",
        "scope": " ".join(SCOPES),
        "state": state,
        "prompt": "consent",
    }
    url = f"{_authorize_url()}?{urlencode(params)}"
    logger.info("[%s] MS start -> %s", req_id, url)
    return {"auth_url": url, "state": state}

@router.get("/auth/oauth/microsoft/callback")
def microsoft_callback(
    code: str | None = None,
    state: str | None = None,
    request: Request = None,
    response: Response = None,
    db: Session = Depends(get_db),
):
    req_id = f"mscb_{int(time.time())}_{secrets.token_hex(3)}"
    logger.info("[%s] callback received code=%s state=%s", req_id, bool(code), bool(state))

    try:
        # 1) valida state
        st = request.app.state.oauth_state.pop(state, None) if state else None
        if not st or (time.time() - st["t"]) > 180:
            logger.warning("[%s] invalid or expired state", req_id)
            raise HTTPException(status_code=400, detail="Invalid state")

        if not code:
            raise HTTPException(status_code=400, detail="Missing code")

        # 2) scambia il code con i token
        data = {
            "client_id": settings.OAUTH_MS_CLIENT_ID,
            "client_secret": settings.OAUTH_MS_CLIENT_SECRET,
            "code": code,
            "redirect_uri": _redirect_uri(),
            "grant_type": "authorization_code",
        }
        logger.info("[%s] exchanging code at %s", req_id, _token_url())
        tok = requests.post(_token_url(), data=data, timeout=12)
        if tok.status_code != 200:
            logger.error("[%s] token exchange failed: %s | body=%s", req_id, tok.status_code, tok.text)
            raise HTTPException(status_code=500, detail=f"Microsoft OAuth callback failed: {tok.text}")

        tj = tok.json()
        access_token = tj.get("access_token")
        id_token = tj.get("id_token")

        if not access_token and not id_token:
            logger.error("[%s] no access_token/id_token in token response: %s", req_id, tj)
            raise HTTPException(status_code=500, detail="Microsoft OAuth callback failed: no token")

        # 3) userinfo: prova Graph /me (richiede User.Read)
        email = name = None
        try:
            if access_token:
                h = {"Authorization": f"Bearer {access_token}"}
                ui = requests.get(GRAPH_ME, headers=h, timeout=10)
                if ui.status_code == 200:
                    me = ui.json()
                    # best-effort per la mail
                    email = me.get("mail") or me.get("userPrincipalName")
                    name = me.get("displayName")
                    logger.info("[%s] graph /me ok email=%s name=%s", req_id, email, name)
                else:
                    logger.warning("[%s] graph /me failed: %s %s", req_id, ui.status_code, ui.text)
        except Exception as ge:
            logger.exception("[%s] error calling graph /me: %s", req_id, ge)

        # 4) se manca email, prova a dedurla dall'id_token (solo se necessario)
        # (opzionale: puoi decodificare JWT senza verifica per leggere 'preferred_username' / 'email')

        if not email:
            logger.error("[%s] no email from Microsoft profile", req_id)
            raise HTTPException(status_code=400, detail="Microsoft account has no email")

        # 5) upsert utente
        user = db.query(User).filter(User.email == email).one_or_none()
        if not user:
            user = User(email=email, name=name or email.split("@")[0])
            db.add(user)
            db.flush()
            # TODO: crea anche user_auth(provider='microsoft', provider_id=...) se previsto
        db.commit()

        # 6) sessione + redirect all'app
        issue_session(response, user_id=str(user.id))
        redirect_to = f"{settings.FRONTEND_APP_URL}/auth/callback?ok=1&provider=microsoft"
        logger.info("[%s] success -> redirect %s", req_id, redirect_to)
        return RedirectResponse(redirect_to, status_code=302)

    except HTTPException:
        raise
    except Exception as e:
        # log completo e dettaglio chiaro
        logger.exception("[%s] unhandled error in microsoft callback", req_id)
        raise HTTPException(status_code=500, detail=f"Microsoft OAuth callback failed: {str(e) or type(e).__name__}")
