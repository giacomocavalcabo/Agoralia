"""
Session management module for Agoralia API
Thread-safe in-memory sessions (temporary solution)
"""
import os
import time
import secrets
import threading
from typing import Optional
from fastapi import Response, Request

_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "ag_sess")
_COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN")  # es: .agoralia.app
_TTL = int(os.getenv("SESSION_TTL_SECONDS", "2592000"))  # 30 giorni
_SECURE = True
_SAMESITE = "none"  # cookie cross-site tra app.<d> e api.<d>

_lock = threading.RLock()
_SESSIONS: dict[str, tuple[int, float]] = {}  # sid -> (user_id, expires_ts)

def create_session(user_id: int) -> str:
    sid = secrets.token_urlsafe(32)
    exp = time.time() + _TTL
    with _lock:
        _SESSIONS[sid] = (user_id, exp)
    return sid

def destroy_session(session_id: str) -> None:
    with _lock:
        _SESSIONS.pop(session_id, None)

def get_user_id(session_id: Optional[str]) -> Optional[int]:
    if not session_id:
        return None
    now = time.time()
    with _lock:
        rec = _SESSIONS.get(session_id)
        if not rec:
            return None
        uid, exp = rec
        if exp < now:
            _SESSIONS.pop(session_id, None)
            return None
        return uid

def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=_COOKIE_NAME,
        value=session_id,
        domain=_COOKIE_DOMAIN,
        path="/",
        secure=_SECURE,
        httponly=True,
        samesite=_SAMESITE,
        max_age=_TTL,
    )

def issue_session(response: Response, user_id: str, ttl_seconds: int | None = None):
    """Funzione unificata per emissione cookie di sessione"""
    ttl = ttl_seconds or _TTL
    sess_id = create_session(user_id)
    response.set_cookie(
        key=_COOKIE_NAME,
        value=sess_id,
        max_age=ttl,
        secure=_SECURE,
        httponly=True,
        samesite=_SAMESITE,
        domain=_COOKIE_DOMAIN,
        path="/",
    )
    return sess_id

def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=_COOKIE_NAME,
        domain=_COOKIE_DOMAIN,
        path="/",
    )

def read_session_cookie(request: Request) -> Optional[str]:
    return request.cookies.get(_COOKIE_NAME)
