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
    try:
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
        
        # Generate URL for logo (R2 presigned or static file)
        logo_url = workspace.brand_logo_url
        if logo_url and logo_url.startswith("workspace-logos/"):
            import os
            r2_configured = bool(
                os.getenv("R2_ACCESS_KEY_ID") and 
                os.getenv("R2_SECRET_ACCESS_KEY") and 
                os.getenv("R2_ACCOUNT_ID") and 
                os.getenv("R2_BUCKET")
            )
            if r2_configured:
                # Try R2 presigned URL
                from utils.r2_client import r2_presign_get
                presigned = r2_presign_get(logo_url, expires_seconds=3600 * 24)  # 24h
                if presigned:
                    logo_url = presigned
                else:
                    # Fallback to static file URL
                    logo_url = f"/uploads/{logo_url}"
            else:
                # Use static file URL - but verify file exists on disk
                from pathlib import Path
                backend_dir = Path(__file__).resolve().parent.parent.parent
                file_path = backend_dir / "uploads" / logo_url
                if not file_path.exists():
                    # File doesn't exist on disk (probably lost after container restart)
                    # Return None to indicate logo is missing
                    logo_url = None
                else:
                    # File exists, use static file URL
                    logo_url = f"/uploads/{logo_url}"
        
        return EffectiveSettings(
            timezone=timezone,
            locale=locale,
            date_format=date_format,
            time_format=time_format,
            theme=theme,
            workspace_name=workspace.workspace_name,
            brand_logo_url=logo_url,
        )
    except Exception as e:
        import traceback
        error_detail = f"Error in get_effective_settings: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_detail}", flush=True)
        raise

