"""
Auth dependencies - Centralized auth and tenant resolution
"""
import os
from fastapi import HTTPException, Header, Query, Depends, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from backend.db import get_db
from backend.models import User, Workspace, WorkspaceMember, UserAuth


def get_tenant_id(
    request: Request,
    user = Depends(get_current_user),
    workspace_id: str | None = Query(default=None, description="Workspace ID (optional if authenticated)"),
    x_workspace_id: str | None = Header(default=None, alias="X-Workspace-Id")
) -> str:
    """
    Get and validate tenant/workspace ID with fallback priority:
    1) query ?workspace_id=...
    2) header X-Workspace-Id
    3) user.workspace_id (from auth_guard)
    """
    # 1) Query parameter (highest priority)
    if workspace_id:
        return workspace_id
    
    # 2) Header X-Workspace-Id
    if x_workspace_id:
        return x_workspace_id
    
    # 3) User's workspace_id (from authenticated user)
    if user and hasattr(user, 'workspace_id') and user.workspace_id:
        return user.workspace_id
    
    # 4) Last resort: explicit error
    raise HTTPException(status_code=422, detail="workspace_id is required")


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current authenticated user from session cookie
    """
    from backend.auth.session import get_session
    
    session = get_session(request)
    if not session:
        return None
    
    user_id = session.get("claims", {}).get("user_id")
    if not user_id:
        return None
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    
    # Update last seen
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    
    return user


def get_workspace_member(
    workspace_id: str = Depends(get_tenant_id),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Optional[WorkspaceMember]:
    """
    Get workspace membership for current user
    """
    if not current_user:
        return None
    
    # For now, return a mock workspace member
    # In production, check actual membership in database
    return WorkspaceMember(
        workspace_id=workspace_id,
        user_id=current_user.id,
        role="admin"
    )


def require_auth(
    current_user: Optional[User] = Depends(get_current_user)
) -> User:
    """
    Require authentication - raises 401 if not authenticated
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return current_user


def require_workspace_access(
    workspace_member: Optional[WorkspaceMember] = Depends(get_workspace_member)
) -> WorkspaceMember:
    """
    Require workspace access - raises 403 if not member
    """
    if not workspace_member:
        raise HTTPException(status_code=403, detail="Workspace access required")
    return workspace_member


def require_admin(
    workspace_member: WorkspaceMember = Depends(require_workspace_access)
) -> WorkspaceMember:
    """
    Require admin role in workspace
    """
    if workspace_member.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return workspace_member


def require_global_admin(
    current_user: User = Depends(require_auth)
) -> User:
    """
    Require global admin access
    """
    if not current_user.is_admin_global:
        raise HTTPException(status_code=403, detail="Global admin access required")
    return current_user


def require_email_verified(
    current_user: User = Depends(require_auth)
) -> User:
    """
    Require email verification for write operations
    """
    if not current_user.email_verified_at:
        raise HTTPException(
            status_code=403, 
            detail={
                "error": "Email verification required",
                "message": "Please verify your email address before performing this action.",
                "code": "EMAIL_VERIFICATION_REQUIRED"
            }
        )
    return current_user


def require_recent_auth(
    current_user: User = Depends(require_auth),
    request: Request = None
) -> User:
    """
    Require recent authentication for sensitive operations
    """
    # In production, check last TOTP verification time
    # For now, just require authentication
    return current_user


# Alias per compatibilità con le route esistenti
def auth_guard(
    current_user: User = Depends(require_auth)
) -> User:
    """
    Alias per require_auth - compatibilità con route esistenti
    """
    return current_user


def admin_guard(
    request: Request, 
    x_admin_email: Optional[str] = Header(default=None), 
    admin_email: Optional[str] = Query(default=None)
) -> None:
    """
    Require admin access - compatibilità con route esistenti
    Usa la stessa logica di require_admin_or_session
    """
    # Import localmente per evitare circular imports
    from backend.auth.session import get_session
    
    chosen = x_admin_email or admin_email
    wildcard = (os.getenv("ADMIN_EMAILS") or "").strip()
    if wildcard == "*":
        return
    if chosen:
        _require_admin(chosen)
        return
    sess = get_session(request)
    claims = (sess or {}).get("claims") if sess else None
    if not claims or not claims.get("is_admin_global"):
        raise HTTPException(status_code=403, detail="Admin required")
