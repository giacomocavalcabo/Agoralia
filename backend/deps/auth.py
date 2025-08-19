"""
Auth dependencies - Centralized auth and tenant resolution
"""
from fastapi import HTTPException, Header, Query, Depends
from sqlalchemy.orm import Session
from typing import Optional

from ..db import get_db
from ..models import User, Workspace, WorkspaceMember


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
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current authenticated user from authorization header
    """
    if not authorization:
        return None
    
    # For now, return a mock user
    # In production, decode JWT token and fetch user from DB
    return User(
        id="user_1",
        email="demo@example.com",
        name="Demo User",
        locale="en-US"
    )


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
