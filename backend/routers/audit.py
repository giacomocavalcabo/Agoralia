"""
Audit router for viewing audit logs
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from backend.db import get_db
from backend.models import User
from backend.sessions import read_session_cookie, get_user_id
from backend.auth.session import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["audit"])

def require_admin(request: Request, db: Session = Depends(get_db)):
    """Check if current user has admin permissions"""
    from backend.sessions import read_session_cookie, get_user_id
    
    session_id = read_session_cookie(request)
    if not session_id:
        raise HTTPException(status_code=401, detail="Missing session")
    
    user_id = get_user_id(session_id)
    if not user_id:
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is admin (adapt based on your role system)
    if not getattr(user, 'is_admin_global', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user

@router.get("/")
def get_audit_logs(
    request: Request, 
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None)
):
    """Get audit logs - requires admin access"""
    user = require_admin(request, db)
    
    # Get user's workspace
    from backend.models import WorkspaceMember
    workspace_member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if not workspace_member:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace_id = workspace_member.workspace_id
    
    # Build query
    query = """
        SELECT ae.id, ae.created_at, ae.user_id, ae.action, ae.resource_type, 
               ae.resource_id, ae.ip, ae.user_agent, ae.meta,
               u.email as user_email, u.name as user_name
        FROM audit_events ae
        LEFT JOIN users u ON ae.user_id = u.id
        WHERE ae.workspace_id = :workspace_id
    """
    
    params = {"workspace_id": workspace_id}
    
    if cursor:
        query += " AND ae.id < :cursor"
        params["cursor"] = cursor
    
    query += " ORDER BY ae.created_at DESC LIMIT :limit"
    params["limit"] = limit
    
    result = db.execute(query, params).fetchall()
    
    events = []
    for row in result:
        events.append({
            "id": row.id,
            "created_at": row.created_at.isoformat(),
            "user": {
                "id": row.user_id,
                "email": row.user_email,
                "name": row.user_name
            } if row.user_id else None,
            "action": row.action,
            "resource": {
                "type": row.resource_type,
                "id": row.resource_id
            } if row.resource_type else None,
            "ip": row.ip,
            "user_agent": row.user_agent,
            "meta": row.meta or {}
        })
    
    return {
        "events": events,
        "next_cursor": str(events[-1]["id"]) if events else None
    }
