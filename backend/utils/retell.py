"""Retell AI API client utilities"""
import os
import httpx
from typing import Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from config.database import engine


def get_retell_api_key(tenant_id: Optional[int] = None) -> str:
    """Get Retell API key for a tenant
    
    Supports BYO (Bring Your Own) Retell account:
    - If tenant has retell_api_key set, use that
    - Otherwise, fallback to global RETELL_API_KEY
    
    Args:
        tenant_id: Optional tenant ID. If None, uses global key.
    
    Returns:
        Retell API key string
    """
    if tenant_id is not None:
        # Check if tenant has custom Retell API key (BYO account)
        try:
            with Session(engine) as session:
                # Check if tenants table exists and has retell_api_key column
                from sqlalchemy import inspect, text
                inspector = inspect(engine)
                if 'tenants' in inspector.get_table_names():
                    columns = [col['name'] for col in inspector.get_columns('tenants')]
                    if 'retell_api_key' in columns:
                        result = session.execute(
                            text("SELECT retell_api_key FROM tenants WHERE id = :tenant_id"),
                            {"tenant_id": tenant_id}
                        ).first()
                        if result and result[0]:
                            return result[0]  # Use tenant's custom key
        except Exception:
            # If lookup fails, fallback to global key
            pass
    
    # Fallback to global RETELL_API_KEY
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")
    return api_key


def get_retell_headers(tenant_id: Optional[int] = None) -> Dict[str, str]:
    """Get Retell API headers
    
    Args:
        tenant_id: Optional tenant ID for BYO Retell account support
    
    Returns:
        Dict with Authorization and Content-Type headers
    """
    api_key = get_retell_api_key(tenant_id)
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


def get_retell_base_url() -> str:
    """Get Retell API base URL"""
    return os.getenv("RETELL_BASE_URL", "https://api.retellai.com")


async def retell_get_json(path: str) -> Dict[str, Any]:
    """Make a GET request to Retell API"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{get_retell_base_url()}{path}",
            headers=get_retell_headers()
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()


async def retell_post_json(path: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Make a POST request to Retell API"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{get_retell_base_url()}{path}",
            headers=get_retell_headers(),
            json=body
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        # Handle empty responses (204 No Content or 200 with empty body)
        if resp.status_code == 204 or not resp.content:
            return {}
        try:
            return resp.json()
        except Exception:
            # If JSON parsing fails, return empty dict (for empty string responses)
            return {}


async def retell_patch_json(path: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Make a PATCH request to Retell API"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.patch(
            f"{get_retell_base_url()}{path}",
            headers=get_retell_headers(),
            json=body
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()


async def retell_delete_json(path: str) -> Dict[str, Any]:
    """Make a DELETE request to Retell API"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{get_retell_base_url()}{path}",
            headers=get_retell_headers()
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        if resp.status_code == 204:
            return {}
        return resp.json() if resp.content else {}


async def retell_post_multipart(
    path: str,
    files: Optional[Dict[str, Any]] = None,
    data: Optional[Dict[str, Any]] = None,
    tenant_id: Optional[int] = None
) -> Dict[str, Any]:
    """Make a POST request with multipart/form-data to Retell API
    
    Used for knowledge base creation which requires file uploads.
    
    Args:
        path: API path (e.g., "/create-knowledge-base")
        files: Dict of file fields for httpx format (e.g., {"knowledge_base_files": (filename, content, content_type)})
        data: Dict of form data fields (strings, lists of strings for JSON arrays, etc.)
        tenant_id: Optional tenant ID for BYO Retell account support
    
    Returns:
        JSON response from Retell API
    """
    api_key = get_retell_api_key(tenant_id)
    headers = {"Authorization": f"Bearer {api_key}"}
    # Don't set Content-Type - httpx will set it automatically for multipart
    
    # Prepare form data for httpx - merge files and data
    # httpx expects: files={"field_name": ("filename", content, "content-type")} for files
    # and data={"field_name": value} for regular form fields
    form_files: Dict[str, Any] = {}
    form_data_dict: Dict[str, Any] = {}
    
    # Process data fields
    if data:
        for key, value in data.items():
            # Skip JSON string fields (like knowledge_base_texts) - send as-is in data
            if isinstance(value, str) and (value.startswith("[") or value.startswith("{")):
                # JSON string - send as regular form field
                form_data_dict[key] = value
            elif isinstance(value, list):
                # For lists of strings (like knowledge_base_urls), send as multiple form fields
                # httpx will handle this correctly for multipart
                form_data_dict[key] = value
            else:
                form_data_dict[key] = value
    
    # Process file fields (if any)
    if files:
        form_files.update(files)
    
    async with httpx.AsyncClient(timeout=60) as client:  # Longer timeout for file uploads
        resp = await client.post(
            f"{get_retell_base_url()}{path}",
            headers=headers,
            files=form_files if form_files else None,
            data=form_data_dict if form_data_dict else None
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        if resp.status_code == 204 or not resp.content:
            return {}
        try:
            return resp.json()
        except Exception:
            return {}

