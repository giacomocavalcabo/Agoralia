# backend/auth/session.py
from __future__ import annotations
from typing import Optional, Dict, Any
import json
from fastapi import Request, HTTPException, status, Response, Depends
from datetime import timedelta, datetime, timezone

try:
    # preferisci il client già esistente, se c'è
    from backend.services.redis_client import get_redis  # type: ignore
except Exception:  # fallback
    get_redis = None  # type: ignore

try:
    # modelli e db (adatta se il path reale differisce)
    from backend.db import get_db
    from backend.models import User
except Exception:
    # Se i path reali differiscono, adeguali nella tua codebase
    raise

from backend.config.settings import settings

SESSION_COOKIE_NAME = getattr(settings, "SESSION_COOKIE_NAME", "session_id")
SESSION_TTL_SECONDS = int(getattr(settings, "SESSION_TTL_SECONDS", 86400))

def _redis():
    """Ottieni un client Redis (async) dal tuo factory, o crea un fallback."""
    if get_redis:
        r = get_redis()
        return r
    # Fallback generico su redis.asyncio
    from redis.asyncio import Redis  # type: ignore
    return Redis.from_url(getattr(settings, "REDIS_URL", "redis://localhost:6379/0"))

async def _read_session_from_store(session_id: str) -> Optional[Dict[str, Any]]:
    r = _redis()
    raw = await r.get(f"session:{session_id}")
    if not raw:
        return None
    try:
        if isinstance(raw, (bytes, bytearray)):
            raw = raw.decode("utf-8")
        return json.loads(raw)
    except Exception:
        return None

async def _touch_session_ttl(session_id: str):
    r = _redis()
    await r.expire(f"session:{session_id}", SESSION_TTL_SECONDS)

async def get_session(request: Request) -> Dict[str, Any]:
    """
    Recupera la sessione dal cookie. Lancia 401 se mancante/invalid/expired.
    Sostituisce la vecchia funzione `_get_session(...)`.
    """
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing session")

    sess = await _read_session_from_store(session_id)
    if not sess:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    # opzionale: sliding TTL
    await _touch_session_ttl(session_id)
    return sess

def set_session_cookie(response: Response, session_id: str):
    """
    Helper per il login: imposta cookie coerente con le policy.
    """
    # NB: SameSite='lax' per far passare redirect OAuth; secure=True in prod su HTTPS
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=not getattr(settings, "DEBUG", False),
        samesite="lax",
        path="/",
    )

# ----- Guardie FastAPI basate su sessione -----

from sqlalchemy.orm import Session as OrmSession

async def get_current_user(
    sess: Dict[str, Any] = Depends(get_session),
    db: OrmSession = Depends(get_db),
) -> User:
    """
    Risolve l'utente dalla sessione. Si aspetta almeno `email` in sessione.
    """
    email = sess.get("email")
    user_id = sess.get("user_id")  # opzionale, se salvate anche l'id
    if not email and not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session payload")

    q = db.query(User)
    if user_id:
        user = q.filter(User.id == user_id).first()
    else:
        user = q.filter(User.email.ilike(email)).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if not getattr(user, "is_admin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user
