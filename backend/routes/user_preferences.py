"""User preferences endpoints"""
from fastapi import APIRouter, Request, HTTPException
from utils.auth import extract_tenant_id, _decode_token
from services.user_preferences import get_user_preferences, update_user_preferences
from schemas.settings import (
    UserPreferencesUIUpdate,
    UserPreferencesUIResponse,
    UserPreferencesNotificationsUpdate,
    UserPreferencesNotificationsResponse,
    UserPreferencesDashboardUpdate,
    UserPreferencesDashboardResponse,
)

router = APIRouter()


def get_user_from_token(request: Request) -> tuple[int, int]:
    """Extract user_id and tenant_id from JWT"""
    auth = request.headers.get("Authorization") or ""
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = auth[7:]
    try:
        payload = _decode_token(token)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    
    if not user_id or not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    return int(user_id), int(tenant_id)


# UI Preferences

@router.get("/ui", response_model=UserPreferencesUIResponse)
async def get_user_preferences_ui(request: Request) -> UserPreferencesUIResponse:
    """Get UI preferences (user can access their own)"""
    user_id, tenant_id = get_user_from_token(request)
    
    prefs = get_user_preferences(user_id, tenant_id)
    
    return UserPreferencesUIResponse(
        theme=prefs.theme,
        ui_locale=prefs.ui_locale,
        date_format=prefs.date_format,
        time_format=prefs.time_format,
        timezone=prefs.timezone,
    )


@router.patch("/ui", response_model=UserPreferencesUIResponse)
async def update_user_preferences_ui(
    body: UserPreferencesUIUpdate,
    request: Request
) -> UserPreferencesUIResponse:
    """Update UI preferences (user can update their own)"""
    user_id, tenant_id = get_user_from_token(request)
    
    updates = body.model_dump(exclude_none=True)
    prefs = update_user_preferences(user_id, tenant_id, updates)
    
    return UserPreferencesUIResponse(
        theme=prefs.theme,
        ui_locale=prefs.ui_locale,
        date_format=prefs.date_format,
        time_format=prefs.time_format,
        timezone=prefs.timezone,
    )


# Notifications

@router.get("/notifications", response_model=UserPreferencesNotificationsResponse)
async def get_user_preferences_notifications(request: Request) -> UserPreferencesNotificationsResponse:
    """Get notification preferences (user can access their own)"""
    user_id, tenant_id = get_user_from_token(request)
    
    prefs = get_user_preferences(user_id, tenant_id)
    
    return UserPreferencesNotificationsResponse(
        email_notifications_enabled=bool(prefs.email_notifications_enabled),
        email_campaign_started=bool(prefs.email_campaign_started),
        email_campaign_paused=bool(prefs.email_campaign_paused),
        email_budget_warning=bool(prefs.email_budget_warning),
        email_compliance_alert=bool(prefs.email_compliance_alert),
    )


@router.patch("/notifications", response_model=UserPreferencesNotificationsResponse)
async def update_user_preferences_notifications(
    body: UserPreferencesNotificationsUpdate,
    request: Request
) -> UserPreferencesNotificationsResponse:
    """Update notification preferences (user can update their own)"""
    user_id, tenant_id = get_user_from_token(request)
    
    updates = body.model_dump(exclude_none=True)
    
    # Convert bool to int for storage
    for key in ["email_notifications_enabled", "email_campaign_started", "email_campaign_paused", 
                "email_budget_warning", "email_compliance_alert"]:
        if key in updates:
            updates[key] = 1 if updates[key] else 0
    
    prefs = update_user_preferences(user_id, tenant_id, updates)
    
    return UserPreferencesNotificationsResponse(
        email_notifications_enabled=bool(prefs.email_notifications_enabled),
        email_campaign_started=bool(prefs.email_campaign_started),
        email_campaign_paused=bool(prefs.email_campaign_paused),
        email_budget_warning=bool(prefs.email_budget_warning),
        email_compliance_alert=bool(prefs.email_compliance_alert),
    )


# Dashboard

@router.get("/dashboard", response_model=UserPreferencesDashboardResponse)
async def get_user_preferences_dashboard(request: Request) -> UserPreferencesDashboardResponse:
    """Get dashboard preferences (user can access their own)"""
    user_id, tenant_id = get_user_from_token(request)
    
    prefs = get_user_preferences(user_id, tenant_id)
    
    return UserPreferencesDashboardResponse(
        default_view=prefs.default_view,
        table_page_size=prefs.table_page_size,
    )


@router.patch("/dashboard", response_model=UserPreferencesDashboardResponse)
async def update_user_preferences_dashboard(
    body: UserPreferencesDashboardUpdate,
    request: Request
) -> UserPreferencesDashboardResponse:
    """Update dashboard preferences (user can update their own)"""
    user_id, tenant_id = get_user_from_token(request)
    
    updates = body.model_dump(exclude_none=True)
    prefs = update_user_preferences(user_id, tenant_id, updates)
    
    return UserPreferencesDashboardResponse(
        default_view=prefs.default_view,
        table_page_size=prefs.table_page_size,
    )

