# backend/auth/deps.py
from backend.auth.session import get_current_user as auth_guard, require_admin as admin_guard

__all__ = ["auth_guard", "admin_guard"]
