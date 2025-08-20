"""
Auth dependencies - Centralized auth and tenant resolution
"""
from fastapi import HTTPException, Header, Query, Depends, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from ..db import get_db
from ..models import User, Workspace, WorkspaceMember, UserAuth


def get_tenant_id(
    workspace_id: str = Query(..., description="Workspace ID"),
    authorization: Optional[str] = Header(None)
) -> str:
    """
    Get and validate tenant/workspace ID
    """
    # For now, return the workspace_id directly
    # In production, validate authorization header and check user permissions
    return workspace_id


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current authenticated user from session cookie
    """
    from ..main import _get_session
    
    session = _get_session(request)
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
