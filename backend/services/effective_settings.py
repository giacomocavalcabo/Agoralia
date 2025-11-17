"""Effective settings resolver (workspace + user override)"""
from typing import Optional
from services.workspace_settings import get_workspace_settings
from services.user_preferences import get_user_preferences
from schemas.settings import EffectiveSettings


def get_effective_settings(user_id: int, tenant_id: int) -> EffectiveSettings:
    """
    Resolve effective settings with priority:
    1. UserPreferences (if present)
    2. WorkspaceSettings (if present)
    3. Fallback to defaults
    
    Algorithm example for timezone:
    - UserPreferences.timezone (if present)
    - WorkspaceSettings.timezone (if present)
    - Fallback "UTC"
    
    Args:
        user_id: User ID
        tenant_id: Logical tenant ID
    
    Returns:
        EffectiveSettings with resolved values
    """
    workspace = get_workspace_settings(tenant_id)
    user_prefs = get_user_preferences(user_id, tenant_id)
    
    # Resolve timezone
    timezone = (
        user_prefs.timezone or
        workspace.timezone or
        "UTC"
    )
    
    # Resolve locale
    locale = (
        user_prefs.ui_locale or
        workspace.default_lang or
        "en-US"
    )
    
    # Resolve date format
    date_format = user_prefs.date_format or "YYYY-MM-DD"
    
    # Resolve time format
    time_format = user_prefs.time_format or "24h"
    
    # Resolve theme
    theme = user_prefs.theme or "system"
    
    # Generate presigned URL if logo is in R2
    logo_url = workspace.brand_logo_url
    if logo_url and logo_url.startswith("workspace-logos/"):
        from utils.r2_client import r2_presign_get
        presigned = r2_presign_get(logo_url, expires_seconds=3600 * 24)  # 24h
        if presigned:
            logo_url = presigned
    
    return EffectiveSettings(
        timezone=timezone,
        locale=locale,
        date_format=date_format,
        time_format=time_format,
        theme=theme,
        workspace_name=workspace.workspace_name,
        brand_logo_url=logo_url,
    )

