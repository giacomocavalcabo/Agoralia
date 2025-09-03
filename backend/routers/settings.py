"""
Settings router for company/organization settings
Handles company profile, branding, and organization-level configurations
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, List
from backend.db import get_db
from backend.models import User, Workspace
from backend.sessions import read_session_cookie, get_user_id
from backend.auth.session import get_current_user
from backend.schemas_billing import BudgetSettings, BudgetState, BudgetUpdateRequest
from backend.services.billing_service import get_workspace_budget_state
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
    timezone: Optional[str] = None

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
    
    # Get workspace info
    from backend.models import WorkspaceMember, Workspace
    workspace_member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    workspace = None
    if workspace_member:
        workspace = db.get(Workspace, workspace_member.workspace_id)
    
    # For now, return mock data - you can implement Organization model later
    return {
        "company_name": getattr(workspace, 'name', None) or "Your Company",
        "domain": getattr(workspace, 'domain', None),
        "vat_id": getattr(workspace, 'vat_id', None),
        "brand_color": getattr(workspace, 'brand_color', None) or "#0EA5E9",
        "logo_url": getattr(workspace, 'logo_url', None),
        "support_email": getattr(workspace, 'support_email', None),
        "legal_name": getattr(workspace, 'legal_name', None),
        "website_url": getattr(workspace, 'website_url', None),
        "timezone": getattr(workspace, 'timezone', None) or "UTC",
    }

@router.patch("/company")
def update_company(payload: CompanyUpdate, request: Request, db: Session = Depends(get_db)):
    """Update company settings - requires admin access"""
    user = require_admin_or_owner(request, db)
    
    try:
        # Get workspace info
        from backend.models import WorkspaceMember, Workspace
        workspace_member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
        if not workspace_member:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        workspace = db.get(Workspace, workspace_member.workspace_id)
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        # Track timezone change for audit
        old_timezone = getattr(workspace, 'timezone', None)
        
        # Update workspace fields
        updated_fields = []
        for field, value in payload.model_dump(exclude_none=True).items():
            if hasattr(workspace, field):
                setattr(workspace, field, value)
                updated_fields.append(field)
        
        if updated_fields:
            db.commit()
            db.refresh(workspace)
            logger.info(f"Updated workspace {workspace.id} fields: {updated_fields}")
            
            # Log audit events
            try:
                from backend.audit import log_event
                
                # Log timezone change specifically
                if payload.timezone and payload.timezone != old_timezone:
                    log_event(db, workspace_id=str(workspace.id), user_id=str(user.id), 
                             action="timezone.change", resource_type="workspace", 
                             resource_id=str(workspace.id), request=request, 
                             meta={"old": old_timezone, "new": payload.timezone})
                
                # Log general workspace update
                log_event(db, workspace_id=str(workspace.id), user_id=str(user.id), 
                         action="workspace.update", resource_type="workspace", 
                         resource_id=str(workspace.id), request=request)
            except Exception:
                pass  # Don't fail update if audit logging fails

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

# Billing endpoints
@router.get("/billing/budget", response_model=BudgetState)
async def get_budget(
    request: Request,
    db: Session = Depends(get_db)
):
    """Get current budget state for workspace"""
    # Get current workspace
    from backend.models import WorkspaceMember
    session_id = read_session_cookie(request)
    if not session_id:
        raise HTTPException(status_code=401, detail="Missing session")
    
    user_id = get_user_id(session_id)
    if not user_id:
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get workspace
    workspace_member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if not workspace_member:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace = db.get(Workspace, workspace_member.workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    budget_state = get_workspace_budget_state(workspace, db)
    return BudgetState(
        settings=BudgetSettings(
            monthly_budget_cents=budget_state["monthly_budget_cents"],
            budget_currency=budget_state["budget_currency"],
            budget_resets_day=budget_state["budget_resets_day"],
            budget_hard_stop=budget_state["budget_hard_stop"],
            budget_thresholds=budget_state["budget_thresholds"],
        ),
        spend_month_to_date_cents=budget_state["spend_month_to_date_cents"],
        blocked=budget_state["blocked"],
        threshold_hit=budget_state["threshold_hit"],
        billing_period=budget_state["billing_period"]
    )

@router.put("/billing/budget", response_model=BudgetState)
async def update_budget(
    payload: BudgetUpdateRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """Update budget settings - requires admin access"""
    # Get current workspace with admin check
    user = require_admin_or_owner(request, db)
    
    from backend.models import WorkspaceMember
    workspace_member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if not workspace_member:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace = db.get(Workspace, workspace_member.workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Update budget settings
    from backend.services.billing_service import update_workspace_budget
    update_workspace_budget(workspace, payload, db)
    
    # Return updated state
    budget_state = get_workspace_budget_state(workspace, db)
    return BudgetState(
        settings=BudgetSettings(
            monthly_budget_cents=budget_state["monthly_budget_cents"],
            budget_currency=budget_state["budget_currency"],
            budget_resets_day=budget_state["budget_resets_day"],
            budget_hard_stop=budget_state["budget_hard_stop"],
            budget_thresholds=budget_state["budget_thresholds"],
        ),
        spend_month_to_date_cents=budget_state["spend_month_to_date_cents"],
        blocked=budget_state["blocked"],
        threshold_hit=budget_state["threshold_hit"],
        billing_period=budget_state["billing_period"]
    )
