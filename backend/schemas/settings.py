"""Pydantic schemas for settings"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


# Workspace Settings Schemas

class WorkspaceGeneralUpdate(BaseModel):
    """Update general workspace settings"""
    workspace_name: Optional[str] = Field(None, max_length=128)
    timezone: Optional[str] = Field(None, max_length=64)
    brand_logo_url: Optional[str] = None


class WorkspaceGeneralResponse(BaseModel):
    """Response for general workspace settings"""
    workspace_name: Optional[str] = None
    timezone: Optional[str] = None
    brand_logo_url: Optional[str] = None


class WorkspaceTelephonyUpdate(BaseModel):
    """Update telephony settings"""
    default_agent_id: Optional[int] = None
    default_from_number: Optional[str] = Field(None, max_length=32)
    default_spacing_ms: Optional[int] = Field(None, ge=0, le=60000)  # 0-60 seconds


class WorkspaceTelephonyResponse(BaseModel):
    """Response for telephony settings"""
    default_agent_id: Optional[int] = None
    default_from_number: Optional[str] = None
    default_spacing_ms: int


class WorkspaceBudgetUpdate(BaseModel):
    """Update budget settings"""
    budget_monthly_cents: Optional[int] = Field(None, ge=0)  # In cents
    budget_warn_percent: Optional[int] = Field(None, ge=1, le=100)
    budget_stop_enabled: Optional[bool] = None


class WorkspaceBudgetResponse(BaseModel):
    """Response for budget settings"""
    budget_monthly_cents: Optional[int] = None
    budget_warn_percent: int
    budget_stop_enabled: bool


class WorkspaceComplianceUpdate(BaseModel):
    """Update compliance settings"""
    require_legal_review: Optional[bool] = None
    override_country_rules_enabled: Optional[bool] = None


class WorkspaceComplianceResponse(BaseModel):
    """Response for compliance settings"""
    require_legal_review: bool
    override_country_rules_enabled: bool


class WorkspaceQuietHoursUpdate(BaseModel):
    """Update quiet hours settings"""
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_weekdays: Optional[str] = Field(None, max_length=32)  # "09:00-21:00"
    quiet_hours_saturday: Optional[str] = Field(None, max_length=32)  # "09:00-21:00" | "forbidden"
    quiet_hours_sunday: Optional[str] = Field(None, max_length=32)  # "forbidden" | "09:00-21:00"
    quiet_hours_timezone: Optional[str] = Field(None, max_length=64)


class WorkspaceQuietHoursResponse(BaseModel):
    """Response for quiet hours settings"""
    quiet_hours_enabled: bool
    quiet_hours_weekdays: Optional[str] = None
    quiet_hours_saturday: Optional[str] = None
    quiet_hours_sunday: Optional[str] = None
    quiet_hours_timezone: Optional[str] = None


class WorkspaceIntegrationsResponse(BaseModel):
    """Response for integrations (never returns actual keys)"""
    retell_api_key_set: bool
    retell_webhook_secret_set: bool


class WorkspaceIntegrationsUpdate(BaseModel):
    """Update integrations (keys are encrypted before saving)"""
    retell_api_key: Optional[str] = None  # Will be encrypted
    retell_webhook_secret: Optional[str] = None  # Will be encrypted


# User Preferences Schemas

class UserPreferencesUIUpdate(BaseModel):
    """Update UI preferences"""
    theme: Optional[str] = Field(None, pattern="^(light|dark|system)$")
    ui_locale: Optional[str] = Field(None, max_length=16)
    date_format: Optional[str] = Field(None, pattern="^(DD/MM/YYYY|MM/DD/YYYY|YYYY-MM-DD)$")
    time_format: Optional[str] = Field(None, pattern="^(24h|12h)$")
    timezone: Optional[str] = Field(None, max_length=64)


class UserPreferencesUIResponse(BaseModel):
    """Response for UI preferences"""
    theme: str
    ui_locale: Optional[str] = None
    date_format: Optional[str] = None
    time_format: Optional[str] = None
    timezone: Optional[str] = None


class UserPreferencesNotificationsUpdate(BaseModel):
    """Update notification preferences"""
    email_notifications_enabled: Optional[bool] = None
    email_campaign_started: Optional[bool] = None
    email_campaign_paused: Optional[bool] = None
    email_budget_warning: Optional[bool] = None
    email_compliance_alert: Optional[bool] = None


class UserPreferencesNotificationsResponse(BaseModel):
    """Response for notification preferences"""
    email_notifications_enabled: bool
    email_campaign_started: bool
    email_campaign_paused: bool
    email_budget_warning: bool
    email_compliance_alert: bool


class UserPreferencesDashboardUpdate(BaseModel):
    """Update dashboard preferences"""
    default_view: Optional[str] = Field(None, pattern="^(campaigns|calls|dashboard)$")
    table_page_size: Optional[int] = Field(None, ge=10, le=200)


class UserPreferencesDashboardResponse(BaseModel):
    """Response for dashboard preferences"""
    default_view: Optional[str] = None
    table_page_size: int


# Effective Settings (resolved workspace + user)

class EffectiveSettings(BaseModel):
    """Effective settings resolved from workspace + user preferences"""
    timezone: str
    locale: str
    date_format: str
    time_format: str
    theme: str
    workspace_name: Optional[str] = None
    brand_logo_url: Optional[str] = None
