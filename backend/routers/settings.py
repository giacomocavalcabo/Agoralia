"""
Settings router for company/organization settings
Handles company profile, branding, and organization-level configurations
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, List
from backend.db import get_db
from backend.models import User
from backend.sessions import read_session_cookie, get_user_id
from backend.auth.session import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

# Company settings model
class CompanyUpdate(BaseModel):
    company_name: Optional[str] = None
    domain: Optional[str] = None
    vat_id: Optional[str] = None
    brand_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    logo_url: Optional[str] = None
    support_email: Optional[str] = None
    legal_name: Optional[str] = None
    website_url: Optional[str] = None

# Helper function to check if user is admin/owner
def require_admin_or_owner(request: Request, db: Session = Depends(get_db)):
    """Check if current user has admin/owner permissions"""
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

@router.get("/company")
def get_company(request: Request, db: Session = Depends(get_db)):
    """Get company settings - requires admin access"""
    user = require_admin_or_owner(request, db)
    
    # For now, return mock data - you can implement Organization model later
    return {
        "company_name": getattr(user, 'company_name', None) or "Your Company",
        "domain": getattr(user, 'domain', None),
        "vat_id": getattr(user, 'vat_id', None),
        "brand_color": getattr(user, 'brand_color', None) or "#0EA5E9",
        "logo_url": getattr(user, 'logo_url', None),
        "support_email": getattr(user, 'support_email', None),
        "legal_name": getattr(user, 'legal_name', None),
        "website_url": getattr(user, 'website_url', None),
    }

@router.patch("/company")
def update_company(payload: CompanyUpdate, request: Request, db: Session = Depends(get_db)):
    """Update company settings - requires admin access"""
    user = require_admin_or_owner(request, db)
    
    try:
        # Update user fields (for now - later you can implement Organization model)
        updated_fields = []
        for field, value in payload.model_dump(exclude_none=True).items():
            if hasattr(user, field):
                setattr(user, field, value)
                updated_fields.append(field)
        
        if updated_fields:
            db.commit()
            db.refresh(user)
            logger.info(f"Updated company settings for user {user.email}: {updated_fields}")

        return {"ok": True, "updated_fields": updated_fields}
        
    except Exception as e:
        logger.error(f"Error updating company settings: {e}")
        raise HTTPException(status_code=500, detail="Update failed")

@router.get("/profile")
def get_profile_settings(request: Request, db: Session = Depends(get_db)):
    """Get user profile settings"""
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
    
    return {
        "name": getattr(user, "name", None) or user.email.split("@")[0],
        "email": user.email,
        "locale": getattr(user, "locale", None) or "en-US",
        "timezone": getattr(user, "timezone", None) or "UTC",
        "notify_email": getattr(user, "notify_email", True),
        "avatar_url": getattr(user, "avatar_url", None),
    }
