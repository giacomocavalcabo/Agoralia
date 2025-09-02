from typing import Any
from fastapi import Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone

def log_event(db: Session, *, workspace_id: str, user_id: str | None, action: str,
              resource_type: str | None = None, resource_id: str | None = None,
              request: Request | None = None, meta: dict[str, Any] | None = None):
    """Log an audit event to the database"""
    ip = None
    ua = None
    try:
        if request:
            ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
            ua = request.headers.get("user-agent")
    except Exception:
        pass
    
    # Insert audit event
    db.execute("""
        INSERT INTO audit_events (created_at, workspace_id, user_id, action, resource_type, resource_id, ip, user_agent, meta)
        VALUES (NOW(), :ws, :uid, :act, :rt, :rid, :ip, :ua, CAST(:meta AS JSON))
    """, {
        "ws": workspace_id,
        "uid": user_id,
        "act": action,
        "rt": resource_type,
        "rid": resource_id,
        "ip": ip,
        "ua": ua,
        "meta": (meta or {})
    })
    db.commit()
