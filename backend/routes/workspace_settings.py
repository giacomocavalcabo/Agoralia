"""Workspace settings endpoints"""
from fastapi import APIRouter, Request, HTTPException, Depends, UploadFile, File, Form
from typing import Optional
from utils.auth import extract_tenant_id, _decode_token
from utils.r2_client import r2_put_bytes, r2_presign_get
import os
from services.workspace_settings import (
    get_workspace_settings,
    update_workspace_settings,
    get_retell_api_key_set,
    get_retell_webhook_secret_set,
)
from schemas.settings import (
    WorkspaceGeneralUpdate,
    WorkspaceGeneralResponse,
    WorkspaceTelephonyUpdate,
    WorkspaceTelephonyResponse,
    WorkspaceBudgetUpdate,
    WorkspaceBudgetResponse,
    WorkspaceComplianceUpdate,
    WorkspaceComplianceResponse,
    WorkspaceQuietHoursUpdate,
    WorkspaceQuietHoursResponse,
    WorkspaceIntegrationsResponse,
    WorkspaceIntegrationsUpdate,
    WorkspaceNotificationsUpdate,
    WorkspaceNotificationsResponse,
)

router = APIRouter()


def require_admin(request: Request) -> tuple[int, int]:
    """
    Dependency: require admin user and extract tenant_id/user_id from JWT
    
    Returns:
        (user_id, tenant_id)
    
    Raises:
        HTTPException 401: If not authenticated
        HTTPException 403: If not admin
    """
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
    is_admin = payload.get("is_admin", False)
    
    if not user_id or not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return int(user_id), int(tenant_id)


# General

@router.get("/general", response_model=WorkspaceGeneralResponse)
async def get_workspace_general(
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceGeneralResponse:
    """Get general workspace settings (admin only)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    try:
        settings = get_workspace_settings(tenant_id)
        
        # Generate URL for logo (R2 presigned or static file)
        logo_url = settings.brand_logo_url
        if logo_url and logo_url.startswith("workspace-logos/"):
            # Check if R2 is configured
            import os
            r2_configured = bool(
                os.getenv("R2_ACCESS_KEY_ID") and 
                os.getenv("R2_SECRET_ACCESS_KEY") and 
                os.getenv("R2_ACCOUNT_ID") and 
                os.getenv("R2_BUCKET")
            )
            if r2_configured:
                # Try R2 presigned URL
                presigned = r2_presign_get(logo_url, expires_seconds=3600 * 24)  # 24h
                if presigned:
                    logo_url = presigned
                else:
                    # Fallback to static file URL
                    logo_url = f"/uploads/{logo_url}"
            else:
                # Use static file URL
                logo_url = f"/uploads/{logo_url}"
        
        return WorkspaceGeneralResponse(
            workspace_name=settings.workspace_name,
            timezone=settings.timezone,
            brand_logo_url=logo_url,
        )
    except Exception as e:
        import traceback
        error_detail = f"Error loading general settings: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_detail}", flush=True)
        raise HTTPException(status_code=500, detail=f"Error loading general settings: {str(e)}")


@router.delete("/general/logo", response_model=WorkspaceGeneralResponse)
async def delete_workspace_logo(
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceGeneralResponse:
    """Delete workspace logo (admin only)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    try:
        settings = get_workspace_settings(tenant_id)
        old_logo_url = settings.brand_logo_url
        
        # Delete file if exists
        if old_logo_url and old_logo_url.startswith("workspace-logos/"):
            import os
            r2_configured = bool(
                os.getenv("R2_ACCESS_KEY_ID") and 
                os.getenv("R2_SECRET_ACCESS_KEY") and 
                os.getenv("R2_ACCOUNT_ID") and 
                os.getenv("R2_BUCKET")
            )
            
            if r2_configured:
                # Delete from R2
                from utils.r2_client import r2_delete
                r2_delete(old_logo_url)
            else:
                # Delete from disk
                from pathlib import Path
                from utils.r2_client import delete_file_from_disk
                backend_dir = Path(__file__).resolve().parent.parent
                file_path = backend_dir / "uploads" / old_logo_url
                delete_file_from_disk(str(file_path))
        
        # Update settings to remove logo
        updates = {"brand_logo_url": None}
        settings = update_workspace_settings(tenant_id, updates)
        
        return WorkspaceGeneralResponse(
            workspace_name=settings.workspace_name,
            timezone=settings.timezone,
            brand_logo_url=None,
        )
    except Exception as e:
        import traceback
        error_detail = f"Error deleting logo: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_detail}", flush=True)
        raise HTTPException(status_code=500, detail=f"Error deleting logo: {str(e)}")


@router.patch("/general", response_model=WorkspaceGeneralResponse)
async def update_workspace_general(
    body: WorkspaceGeneralUpdate,
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceGeneralResponse:
    """Update general workspace settings (admin only, partial update)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    try:
        # Convert Pydantic model to dict, excluding None values
        updates = body.model_dump(exclude_none=True)
        
        # Handle logo deletion: if brand_logo_url is explicitly set to null/empty, delete the file
        if "brand_logo_url" in updates and (updates["brand_logo_url"] is None or updates["brand_logo_url"] == ""):
            # Get current logo before deleting
            current_settings = get_workspace_settings(tenant_id)
            old_logo_url = current_settings.brand_logo_url
            
            # Delete file if exists
            if old_logo_url and old_logo_url.startswith("workspace-logos/"):
                import os
                r2_configured = bool(
                    os.getenv("R2_ACCESS_KEY_ID") and 
                    os.getenv("R2_SECRET_ACCESS_KEY") and 
                    os.getenv("R2_ACCOUNT_ID") and 
                    os.getenv("R2_BUCKET")
                )
                
                if r2_configured:
                    # Delete from R2
                    from utils.r2_client import r2_delete
                    r2_delete(old_logo_url)
                else:
                    # Delete from disk
                    from pathlib import Path
                    from utils.r2_client import delete_file_from_disk
                    backend_dir = Path(__file__).resolve().parent.parent
                    file_path = backend_dir / "uploads" / old_logo_url
                    delete_file_from_disk(str(file_path))
            
            # Set to None in database
            updates["brand_logo_url"] = None
        
        settings = update_workspace_settings(tenant_id, updates)
        
        # Generate URL for logo (R2 presigned or static file)
        logo_url = settings.brand_logo_url
        if logo_url and logo_url.startswith("workspace-logos/"):
            # Check if R2 is configured
            import os
            r2_configured = bool(
                os.getenv("R2_ACCESS_KEY_ID") and 
                os.getenv("R2_SECRET_ACCESS_KEY") and 
                os.getenv("R2_ACCOUNT_ID") and 
                os.getenv("R2_BUCKET")
            )
            if r2_configured:
                # Try R2 presigned URL
                presigned = r2_presign_get(logo_url, expires_seconds=3600 * 24)  # 24h
                if presigned:
                    logo_url = presigned
                else:
                    # Fallback to static file URL
                    logo_url = f"/uploads/{logo_url}"
            else:
                # Use static file URL
                logo_url = f"/uploads/{logo_url}"
        
        return WorkspaceGeneralResponse(
            workspace_name=settings.workspace_name,
            timezone=settings.timezone,
            brand_logo_url=logo_url,
        )
    except Exception as e:
        import traceback
        error_detail = f"Error updating general settings: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_detail}", flush=True)
        raise HTTPException(status_code=500, detail=f"Error updating general settings: {str(e)}")


@router.post("/general/logo", response_model=WorkspaceGeneralResponse)
async def upload_workspace_logo(
    request: Request,
    file: UploadFile = File(...),
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceGeneralResponse:
    """Upload workspace logo (admin only)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read file
        file_data = await file.read()
        if len(file_data) > 5 * 1024 * 1024:  # 5MB max
            raise HTTPException(status_code=400, detail="File too large (max 5MB)")
        
        # Determine content type
        content_type = file.content_type or "image/png"
        
        # Get current logo to delete old one (replace behavior)
        current_settings = get_workspace_settings(tenant_id)
        old_logo_url = current_settings.brand_logo_url
        
        # Delete old logo if exists (replace behavior)
        # Delete ALL logo files for this tenant (different extensions)
        if old_logo_url and old_logo_url.startswith("workspace-logos/"):
            import os
            r2_configured = bool(
                os.getenv("R2_ACCESS_KEY_ID") and 
                os.getenv("R2_SECRET_ACCESS_KEY") and 
                os.getenv("R2_ACCOUNT_ID") and 
                os.getenv("R2_BUCKET")
            )
            
            if r2_configured:
                # Delete from R2 - delete all possible logo extensions
                from utils.r2_client import r2_delete
                tenant_logo_prefix = f"workspace-logos/{tenant_id}/logo."
                # Try common extensions
                for ext in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']:
                    r2_delete(f"{tenant_logo_prefix}{ext}")
            else:
                # Delete from disk - delete all possible logo extensions
                from pathlib import Path
                from utils.r2_client import delete_file_from_disk
                backend_dir = Path(__file__).resolve().parent.parent
                tenant_logo_dir = backend_dir / "uploads" / "workspace-logos" / str(tenant_id)
                if tenant_logo_dir.exists():
                    # Delete all logo.* files in tenant directory
                    for logo_file in tenant_logo_dir.glob("logo.*"):
                        delete_file_from_disk(str(logo_file))
        
        # Save new file - try R2 first, fallback to disk
        import os
        from pathlib import Path
        
        # Determine file extension
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "png"
        filename = f"logo.{file_ext}"
        storage_key = f"workspace-logos/{tenant_id}/{filename}"
        
        # Try R2 first (persistent storage)
        r2_configured = bool(
            os.getenv("R2_ACCESS_KEY_ID") and 
            os.getenv("R2_SECRET_ACCESS_KEY") and 
            os.getenv("R2_ACCOUNT_ID") and 
            os.getenv("R2_BUCKET")
        )
        
        logo_url_to_save = None
        
        if r2_configured:
            # Upload to R2 (persistent)
            uploaded = r2_put_bytes(storage_key, file_data, content_type=content_type)
            if uploaded:
                logo_url_to_save = storage_key
            else:
                # R2 upload failed, fallback to disk
                pass
        
        # Fallback to disk if R2 not configured or upload failed
        if not logo_url_to_save:
            # Use same path as main.py for consistency
            backend_dir = Path(__file__).resolve().parent.parent
            uploads_dir = backend_dir / "uploads" / "workspace-logos"
            uploads_dir.mkdir(parents=True, exist_ok=True)
            
            file_path = uploads_dir / str(tenant_id) / filename
            
            # Create tenant-specific directory
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save file to disk (overwrites if exists)
            try:
                with open(file_path, "wb") as f:
                    f.write(file_data)
                logo_url_to_save = storage_key  # Use same format for consistency
            except Exception as e:
                import traceback
                error_detail = f"Failed to save logo to disk: {str(e)}\n{traceback.format_exc()}"
                print(f"[ERROR] {error_detail}", flush=True)
                raise HTTPException(status_code=500, detail=f"Failed to save logo: {str(e)}")
        
        # Update settings with logo URL
        updates = {"brand_logo_url": logo_url_to_save}
        try:
            settings = update_workspace_settings(tenant_id, updates)
        except Exception as e:
            import traceback
            error_detail = f"Error updating settings with logo URL: {str(e)}\n{traceback.format_exc()}"
            print(f"[ERROR] {error_detail}", flush=True)
            raise HTTPException(status_code=500, detail=f"Error updating settings: {str(e)}")
        
        # Generate URL for response
        # If it's an R2 key, try to get presigned URL, otherwise use static file URL
        logo_url = None
        if logo_url_to_save and logo_url_to_save.startswith("workspace-logos/"):
            # Check if R2 is configured and try to get presigned URL
            import os
            r2_configured = bool(
                os.getenv("R2_ACCESS_KEY_ID") and 
                os.getenv("R2_SECRET_ACCESS_KEY") and 
                os.getenv("R2_ACCOUNT_ID") and 
                os.getenv("R2_BUCKET")
            )
            if r2_configured:
                # Try R2 presigned URL
                presigned = r2_presign_get(logo_url_to_save, expires_seconds=3600 * 24 * 365)
                if presigned:
                    logo_url = presigned
                else:
                    # Fallback to static file URL
                    logo_url = f"/uploads/{logo_url_to_save}"
            else:
                # Use static file URL
                logo_url = f"/uploads/{logo_url_to_save}"
        else:
            logo_url = logo_url_to_save
        
        return WorkspaceGeneralResponse(
            workspace_name=settings.workspace_name,
            timezone=settings.timezone,
            brand_logo_url=logo_url,
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        import traceback
        error_detail = f"Error uploading logo: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_detail}", flush=True)
        raise HTTPException(status_code=500, detail=f"Error uploading logo: {str(e)}")


# Telephony

@router.get("/telephony", response_model=WorkspaceTelephonyResponse)
async def get_workspace_telephony(
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceTelephonyResponse:
    """Get telephony workspace settings (admin only)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    settings = get_workspace_settings(tenant_id)
    
    # Convert default_agent_id from string to int if it's a numeric string
    default_agent_id = None
    if settings.default_agent_id:
        try:
            default_agent_id = int(settings.default_agent_id)
        except ValueError:
            pass  # Keep as None if not numeric
    
    return WorkspaceTelephonyResponse(
        default_agent_id=default_agent_id,
        default_from_number=settings.default_from_number,
        default_spacing_ms=settings.default_spacing_ms,
    )


@router.patch("/telephony", response_model=WorkspaceTelephonyResponse)
async def update_workspace_telephony(
    body: WorkspaceTelephonyUpdate,
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceTelephonyResponse:
    """Update telephony workspace settings (admin only, partial update)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    updates = body.model_dump(exclude_none=True)
    
    # Convert default_agent_id from int to string for storage
    if "default_agent_id" in updates and updates["default_agent_id"] is not None:
        updates["default_agent_id"] = str(updates["default_agent_id"])
    
    settings = update_workspace_settings(tenant_id, updates)
    
    # Convert back to int for response
    default_agent_id = None
    if settings.default_agent_id:
        try:
            default_agent_id = int(settings.default_agent_id)
        except ValueError:
            pass
    
    return WorkspaceTelephonyResponse(
        default_agent_id=default_agent_id,
        default_from_number=settings.default_from_number,
        default_spacing_ms=settings.default_spacing_ms,
    )


# Budget

@router.get("/budget", response_model=WorkspaceBudgetResponse)
async def get_workspace_budget(
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceBudgetResponse:
    """Get budget workspace settings (admin only)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    settings = get_workspace_settings(tenant_id)
    
    return WorkspaceBudgetResponse(
        budget_monthly_cents=settings.budget_monthly_cents,
        budget_warn_percent=settings.budget_warn_percent,
        budget_stop_enabled=bool(settings.budget_stop_enabled),
    )


@router.patch("/budget", response_model=WorkspaceBudgetResponse)
async def update_workspace_budget(
    body: WorkspaceBudgetUpdate,
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceBudgetResponse:
    """Update budget workspace settings (admin only, partial update)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    updates = body.model_dump(exclude_none=True)
    
    # Convert bool to int for storage
    if "budget_stop_enabled" in updates:
        updates["budget_stop_enabled"] = 1 if updates["budget_stop_enabled"] else 0
    
    settings = update_workspace_settings(tenant_id, updates)
    
    return WorkspaceBudgetResponse(
        budget_monthly_cents=settings.budget_monthly_cents,
        budget_warn_percent=settings.budget_warn_percent,
        budget_stop_enabled=bool(settings.budget_stop_enabled),
    )


# Compliance

@router.get("/compliance", response_model=WorkspaceComplianceResponse)
async def get_workspace_compliance(
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceComplianceResponse:
    """Get compliance workspace settings (admin only)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    settings = get_workspace_settings(tenant_id)
    
    return WorkspaceComplianceResponse(
        require_legal_review=bool(settings.require_legal_review),
        override_country_rules_enabled=bool(settings.override_country_rules_enabled),
    )


@router.patch("/compliance", response_model=WorkspaceComplianceResponse)
async def update_workspace_compliance(
    body: WorkspaceComplianceUpdate,
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceComplianceResponse:
    """Update compliance workspace settings (admin only, partial update)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    updates = body.model_dump(exclude_none=True)
    
    # Convert bool to int for storage
    if "require_legal_review" in updates:
        updates["require_legal_review"] = 1 if updates["require_legal_review"] else 0
    if "override_country_rules_enabled" in updates:
        updates["override_country_rules_enabled"] = 1 if updates["override_country_rules_enabled"] else 0
    
    settings = update_workspace_settings(tenant_id, updates)
    
    return WorkspaceComplianceResponse(
        require_legal_review=bool(settings.require_legal_review),
        override_country_rules_enabled=bool(settings.override_country_rules_enabled),
    )


# Quiet Hours

@router.get("/quiet-hours", response_model=WorkspaceQuietHoursResponse)
async def get_workspace_quiet_hours(
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceQuietHoursResponse:
    """Get quiet hours workspace settings (admin only)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    settings = get_workspace_settings(tenant_id)
    
    return WorkspaceQuietHoursResponse(
        quiet_hours_enabled=bool(settings.quiet_hours_enabled),
        quiet_hours_weekdays=settings.quiet_hours_weekdays,
        quiet_hours_saturday=settings.quiet_hours_saturday,
        quiet_hours_sunday=settings.quiet_hours_sunday,
        quiet_hours_timezone=settings.quiet_hours_timezone,
    )


@router.patch("/quiet-hours", response_model=WorkspaceQuietHoursResponse)
async def update_workspace_quiet_hours(
    body: WorkspaceQuietHoursUpdate,
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceQuietHoursResponse:
    """Update quiet hours workspace settings (admin only, partial update)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    updates = body.model_dump(exclude_none=True)
    
    # Convert bool to int for storage
    if "quiet_hours_enabled" in updates:
        updates["quiet_hours_enabled"] = 1 if updates["quiet_hours_enabled"] else 0
    
    settings = update_workspace_settings(tenant_id, updates)
    
    return WorkspaceQuietHoursResponse(
        quiet_hours_enabled=bool(settings.quiet_hours_enabled),
        quiet_hours_weekdays=settings.quiet_hours_weekdays,
        quiet_hours_saturday=settings.quiet_hours_saturday,
        quiet_hours_sunday=settings.quiet_hours_sunday,
        quiet_hours_timezone=settings.quiet_hours_timezone,
    )


# Integrations

@router.get("/integrations", response_model=WorkspaceIntegrationsResponse)
async def get_workspace_integrations(
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceIntegrationsResponse:
    """Get integrations status (never returns actual keys)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    return WorkspaceIntegrationsResponse(
        retell_api_key_set=get_retell_api_key_set(tenant_id),
        retell_webhook_secret_set=get_retell_webhook_secret_set(tenant_id),
    )


@router.patch("/integrations", response_model=WorkspaceIntegrationsResponse)
async def update_workspace_integrations(
    body: WorkspaceIntegrationsUpdate,
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceIntegrationsResponse:
    """Update integrations (keys are encrypted before saving)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    updates = {}
    if body.retell_api_key is not None:
        updates["retell_api_key"] = body.retell_api_key
    if body.retell_webhook_secret is not None:
        updates["retell_webhook_secret"] = body.retell_webhook_secret
    
    if updates:
        update_workspace_settings(tenant_id, updates)
    
    return WorkspaceIntegrationsResponse(
        retell_api_key_set=get_retell_api_key_set(tenant_id),
        retell_webhook_secret_set=get_retell_webhook_secret_set(tenant_id),
    )


# Notifications

@router.get("/notifications", response_model=WorkspaceNotificationsResponse)
async def get_workspace_notifications(
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceNotificationsResponse:
    """Get notification settings (admin only)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    try:
        settings = get_workspace_settings(tenant_id)
        
        # Try to access notification fields - if they don't exist, use defaults
        try:
            return WorkspaceNotificationsResponse(
                email_notifications_enabled=bool(settings.email_notifications_enabled),
                email_campaign_started=bool(settings.email_campaign_started),
                email_campaign_paused=bool(settings.email_campaign_paused),
                email_budget_warning=bool(settings.email_budget_warning),
                email_compliance_alert=bool(settings.email_compliance_alert),
            )
        except (AttributeError, KeyError):
            # Fields don't exist yet (migration not run) - return defaults
            return WorkspaceNotificationsResponse(
                email_notifications_enabled=True,
                email_campaign_started=True,
                email_campaign_paused=True,
                email_budget_warning=True,
                email_compliance_alert=True,
            )
    except Exception as e:
        import traceback
        error_detail = f"Error loading notification settings: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_detail}", flush=True)
        raise HTTPException(status_code=500, detail=f"Error loading notification settings: {str(e)}")


@router.patch("/notifications", response_model=WorkspaceNotificationsResponse)
async def update_workspace_notifications(
    body: WorkspaceNotificationsUpdate,
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceNotificationsResponse:
    """Update notification settings (admin only, partial update)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    updates = body.model_dump(exclude_none=True)
    
    # Convert boolean values to integers (0/1) for database storage
    # IMPORTANT: Convert ALL boolean fields, even if they're already in updates
    boolean_fields = ["email_notifications_enabled", "email_campaign_started", "email_campaign_paused", 
                     "email_budget_warning", "email_compliance_alert"]
    for key in boolean_fields:
        if key in updates:
            # Ensure it's converted to int (0 or 1)
            updates[key] = 1 if bool(updates[key]) else 0
    
    # Debug: log what we're sending
    import logging
    logging.debug(f"Updating notifications for tenant {tenant_id}: {updates}")
    
    settings = update_workspace_settings(tenant_id, updates)
    
    return WorkspaceNotificationsResponse(
        email_notifications_enabled=bool(settings.email_notifications_enabled),
        email_campaign_started=bool(settings.email_campaign_started),
        email_campaign_paused=bool(settings.email_campaign_paused),
        email_budget_warning=bool(settings.email_budget_warning),
        email_compliance_alert=bool(settings.email_compliance_alert),
    )
