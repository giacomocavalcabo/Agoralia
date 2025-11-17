"""Pydantic schemas for settings"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, field_validator, Field


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

