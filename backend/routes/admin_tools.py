"""Temporary admin tools endpoint (for development only)"""
import os
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import Session
from config.database import engine
from models.users import User
from utils.auth import extract_tenant_id, _decode_token

router = APIRouter()


@router.post("/make-admin/{tenant_id}")
async def make_admin_by_tenant(request: Request, tenant_id: int):
    """
    Make all users in a tenant admin (development only)
    WARNING: This should be removed or secured in production!
    """
    # Allow if ADMIN_TOOLS_ENABLED is set OR if ADMIN_SECRET is provided in request
    admin_secret = request.headers.get("X-Admin-Secret") or request.query_params.get("admin_secret")
    expected_secret = os.getenv("ADMIN_SECRET") or os.getenv("ADMIN_TOOLS_ENABLED")
    
    if not admin_secret and not os.getenv("ADMIN_TOOLS_ENABLED"):
        raise HTTPException(status_code=403, detail="Admin tools disabled. Set ADMIN_TOOLS_ENABLED or provide X-Admin-Secret header")
    
    if admin_secret and expected_secret and admin_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    
    # Verify caller is authenticated (optional additional check)
    try:
        auth = request.headers.get("Authorization") or ""
        if auth.startswith("Bearer "):
            token = auth[7:]
            payload = _decode_token(token)
            caller_tenant_id = payload.get("tenant_id")
            # Only allow if caller is from same tenant or is already admin
            if caller_tenant_id != tenant_id and not payload.get("is_admin"):
                raise HTTPException(status_code=403, detail="Not authorized")
    except Exception:
        pass  # Allow if token check fails (for development)
    
    with Session(engine) as session:
        users = session.query(User).filter(User.tenant_id == tenant_id).all()
        
        if not users:
            raise HTTPException(status_code=404, detail=f"No users found for tenant_id {tenant_id}")
        
        updated_count = 0
        for user in users:
            if user.is_admin == 0:
                user.is_admin = 1
                updated_count += 1
        
        session.commit()
        
        return {
            "ok": True,
            "tenant_id": tenant_id,
            "total_users": len(users),
            "updated_to_admin": updated_count,
            "users": [
                {
                    "id": user.id,
                    "email": user.email,
                    "is_admin": bool(user.is_admin),
                }
                for user in users
            ],
        }

