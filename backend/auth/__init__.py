# backend/auth/__init__.py
from .session import get_session, get_current_user, set_session_cookie
from .deps import auth_guard, admin_guard

__all__ = [
    "get_session",
    "get_current_user", 
    "set_session_cookie",
    "auth_guard",
    "admin_guard"
]
