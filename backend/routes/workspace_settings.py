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
    WorkspaceIntegrationsResponse,
    WorkspaceIntegrationsUpdate,
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


@router.get("/general", response_model=WorkspaceGeneralResponse)
async def get_workspace_general(
    request: Request,
    _: tuple[int, int] = Depends(require_admin)
) -> WorkspaceGeneralResponse:
    """Get general workspace settings (admin only)"""
    tenant_id = extract_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    
    settings = get_workspace_settings(tenant_id)
    
    # Generate presigned URL if logo is in R2
    logo_url = settings.brand_logo_url
    if logo_url and logo_url.startswith("workspace-logos/"):
        presigned = r2_presign_get(logo_url, expires_seconds=3600 * 24)  # 24h
        if presigned:
            logo_url = presigned
    
    return WorkspaceGeneralResponse(
        workspace_name=settings.workspace_name,
        timezone=settings.timezone,
        brand_logo_url=logo_url,
    )


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
    
    # Convert Pydantic model to dict, excluding None values
    updates = body.model_dump(exclude_none=True)
    
    settings = update_workspace_settings(tenant_id, updates)
    
    # Generate presigned URL if logo is in R2
    logo_url = settings.brand_logo_url
    if logo_url and logo_url.startswith("workspace-logos/"):
        presigned = r2_presign_get(logo_url, expires_seconds=3600 * 24)  # 24h
        if presigned:
            logo_url = presigned
    
    return WorkspaceGeneralResponse(
        workspace_name=settings.workspace_name,
        timezone=settings.timezone,
        brand_logo_url=logo_url,
    )


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
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read file
    file_data = await file.read()
    if len(file_data) > 5 * 1024 * 1024:  # 5MB max
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    
    # Determine content type
    content_type = file.content_type or "image/png"
    
    # Upload to R2
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    r2_key = f"workspace-logos/{tenant_id}/logo.{file_ext}"
    
    uploaded = r2_put_bytes(r2_key, file_data, content_type=content_type)
    if not uploaded:
        raise HTTPException(status_code=500, detail="Failed to upload logo")
    
    # Update settings with R2 key (not full URL)
    updates = {"brand_logo_url": r2_key}
    settings = update_workspace_settings(tenant_id, updates)
    
    # Generate presigned URL for response
    logo_url = r2_presign_get(r2_key, expires_seconds=3600 * 24 * 365)  # 1 year
    if not logo_url:
        logo_url = r2_key
    
    return WorkspaceGeneralResponse(
        workspace_name=settings.workspace_name,
        timezone=settings.timezone,
        brand_logo_url=logo_url,
    )


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

