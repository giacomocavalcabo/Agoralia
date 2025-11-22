"""Retell AI API client utilities"""
import os
import json
import io
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


async def retell_get_json(path: str, tenant_id: Optional[int] = None) -> Dict[str, Any]:
    """Make a GET request to Retell API
    
    Args:
        path: API path (e.g., "/list-voices")
        tenant_id: Optional tenant ID for BYO Retell account support
    
    Returns:
        JSON response from Retell API
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{get_retell_base_url()}{path}",
            headers=get_retell_headers(tenant_id)
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()


async def retell_post_json(path: str, body: Dict[str, Any], tenant_id: Optional[int] = None) -> Dict[str, Any]:
    """Make a POST request to Retell API
    
    Args:
        path: API path (e.g., "/create-batch-call")
        body: Request body as dict
        tenant_id: Optional tenant ID for BYO Retell account support
    
    Returns:
        JSON response from Retell API (or empty dict for 204 No Content)
    """
    base_url = get_retell_base_url()
    full_url = f"{base_url}{path}"
    headers = get_retell_headers(tenant_id)
    
    # Log request details for debugging
    print(f"[DEBUG] [retell_post_json] POST {full_url}", flush=True)
    print(f"[DEBUG] [retell_post_json] Headers: {dict(headers)}", flush=True)
    print(f"[DEBUG] [retell_post_json] Body keys: {list(body.keys()) if isinstance(body, dict) else 'N/A'}", flush=True)
    
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            full_url,
            headers=headers,
            json=body
        )
        print(f"[DEBUG] [retell_post_json] Response status: {resp.status_code}", flush=True)
        if resp.status_code >= 400:
            error_detail = resp.text
            try:
                error_json = resp.json()
                if isinstance(error_json, dict):
                    error_msg = error_json.get("message") or error_json.get("error") or error_json.get("detail") or resp.text
                    error_detail = error_msg
            except Exception:
                pass
            print(f"[DEBUG] [retell_post_json] Error {resp.status_code}: {error_detail[:500]}", flush=True)
            raise HTTPException(status_code=resp.status_code, detail=error_detail)
        # Handle empty responses (204 No Content or 200 with empty body)
        if resp.status_code == 204 or not resp.content:
            return {}
        try:
            return resp.json()
        except Exception:
            # If JSON parsing fails, return empty dict (for empty string responses)
            return {}


async def retell_patch_json(path: str, body: Dict[str, Any], tenant_id: Optional[int] = None) -> Dict[str, Any]:
    """Make a PATCH request to Retell API
    
    Args:
        path: API path (e.g., "/update-agent/{agent_id}")
        body: Request body as dict
        tenant_id: Optional tenant ID for BYO Retell account support
    
    Returns:
        JSON response from Retell API
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.patch(
            f"{get_retell_base_url()}{path}",
            headers=get_retell_headers(tenant_id),
            json=body
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        # Handle empty responses
        if resp.status_code == 204 or not resp.content:
            return {}
        try:
            return resp.json()
        except Exception:
            return {}


async def retell_delete_json(path: str, tenant_id: Optional[int] = None) -> Dict[str, Any]:
    """Make a DELETE request to Retell API
    
    Args:
        path: API path (e.g., "/delete-knowledge-base/{kb_id}")
        tenant_id: Optional tenant ID for BYO Retell account support
    
    Returns:
        JSON response from Retell API (or empty dict for 204 No Content)
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{get_retell_base_url()}{path}",
            headers=get_retell_headers(tenant_id)
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
    # Retell API expects multipart/form-data with specific formats:
    # - knowledge_base_texts: JSON string array of {text, title} objects
    # - knowledge_base_urls: JSON string array of URLs OR multiple form fields
    # - knowledge_base_name: string
    # - enable_auto_refresh: boolean as string
    if data:
        for key, value in data.items():
            # Handle JSON string fields (already serialized) - send as-is
            if isinstance(value, str) and (value.startswith("[") or value.startswith("{")):
                # JSON string - send as regular form field
                form_data_dict[key] = value
            elif isinstance(value, list):
                # For arrays, Retell might expect JSON string OR multiple fields
                # Based on Retell docs, arrays should be JSON strings
                form_data_dict[key] = json.dumps(value)
            else:
                form_data_dict[key] = value
    
    # Process file fields (if any)
    # RetellAI expects files as an array in knowledge_base_files field
    # httpx expects file-like objects, not raw bytes
    # httpx supports array of files by passing a list of tuples at the top level
    # Format: [("field_name", (filename, content, content_type)), ("field_name", (filename2, content2, content_type2)), ...]
    if files:
        # If files is a dict with "knowledge_base_files" as a list of tuples, convert to httpx format
        if isinstance(files, dict) and "knowledge_base_files" in files:
            file_list = files["knowledge_base_files"]
            if isinstance(file_list, list) and len(file_list) > 0:
                # Convert each tuple (filename, bytes, content_type) to httpx format
                # httpx for arrays: list of (field_name, (filename, file_obj, content_type)) tuples
                converted_files = []
                for item in file_list:
                    if isinstance(item, tuple) and len(item) >= 2:
                        filename = item[0]
                        content = item[1]
                        content_type = item[2] if len(item) > 2 else "application/octet-stream"
                        # Convert bytes to BytesIO if it's bytes
                        if isinstance(content, bytes):
                            file_obj = io.BytesIO(content)
                        elif hasattr(content, 'read'):
                            # Already a file-like object
                            file_obj = content
                        else:
                            # Unknown type, try to wrap it
                            file_obj = content
                        # httpx format: ("field_name", (filename, file_obj, content_type))
                        # For arrays, httpx expects a list of tuples: [("field_name", (filename, file_obj, content_type)), ...]
                        converted_files.append(("knowledge_base_files", (filename, file_obj, content_type)))
                    else:
                        # Invalid format, skip
                        continue
                # For arrays, httpx requires a list of tuples at the top level
                # Format: [("field_name", (filename, file_obj, content_type)), ("field_name", (filename2, file_obj2, content_type2)), ...]
                # This is what we have in converted_files
                form_files = converted_files if converted_files else None
            else:
                form_files.update(files)
        else:
            form_files.update(files)
    else:
        form_files = None
    
    async with httpx.AsyncClient(timeout=120) as client:  # Longer timeout for file uploads (2 minutes)
        # Log what we're sending for debugging (without file content)
        import logging
        logger = logging.getLogger(__name__)
        
        # Extract file info without content for logging
        # Handle both bytes and BytesIO objects
        def get_file_size(content):
            """Get size of file content, handling both bytes and BytesIO"""
            if isinstance(content, bytes):
                return len(content)
            elif hasattr(content, 'getbuffer'):  # BytesIO
                return content.getbuffer().nbytes
            elif hasattr(content, 'seek') and hasattr(content, 'tell'):  # file-like object
                pos = content.tell()
                content.seek(0, io.SEEK_END)
                size = content.tell()
                content.seek(pos)
                return size
            return 0
        
        file_info = {}
        if form_files:
            # form_files can be either a dict (single file) or a list (array of files)
            if isinstance(form_files, list):
                # Array format: [("field_name", (filename, content, content_type)), ...]
                file_info_list = []
                for field_name, file_data in form_files:
                    if isinstance(file_data, tuple) and len(file_data) >= 2:
                        file_info_list.append({
                            "filename": file_data[0],
                            "size": get_file_size(file_data[1]) if len(file_data) > 1 else 0,
                            "content_type": file_data[2] if len(file_data) > 2 else "unknown"
                        })
                # Group by field name for display
                if file_info_list:
                    file_info["knowledge_base_files"] = file_info_list
            elif isinstance(form_files, dict):
                # Dict format: {"field_name": file_data or [file_data, ...]}
                for field_name, file_data in form_files.items():
                    if isinstance(file_data, list):
                        file_info[field_name] = [
                            {
                                "filename": item[0] if isinstance(item, tuple) and len(item) > 0 else "unknown",
                                "size": get_file_size(item[1]) if isinstance(item, tuple) and len(item) > 1 else 0,
                                "content_type": item[2] if isinstance(item, tuple) and len(item) > 2 else "unknown"
                            }
                            for item in file_data
                        ]
                    elif isinstance(file_data, tuple) and len(file_data) > 0:
                        file_info[field_name] = {
                            "filename": file_data[0],
                            "size": get_file_size(file_data[1]) if len(file_data) > 1 else 0,
                            "content_type": file_data[2] if len(file_data) > 2 else "unknown"
                        }
        
        logger.info(f"[retell_post_multipart] Sending to {path}, data: {form_data_dict}, files: {file_info}")
        print(f"[DEBUG] [retell_post_multipart] Sending to {path}", flush=True)
        print(f"[DEBUG] [retell_post_multipart] Data: {form_data_dict}", flush=True)
        print(f"[DEBUG] [retell_post_multipart] Files: {file_info}", flush=True)
        
        # httpx.post() accepts files as either:
        # - Dict: {"field_name": (filename, content, content_type)} for single file
        # - List: [("field_name", (filename, content, content_type)), ...] for arrays
        # When using files=list, we should combine with data into a single multipart request
        # httpx will handle combining files and data automatically
        
        # For array of files, httpx might not support list format correctly
        # Let's try combining everything into files parameter when we have file arrays
        # When form_files is a list (array of files), combine with data into files
        if isinstance(form_files, list) and form_files:
            # For arrays, try combining files and data into a single list
            # Add form data as tuples to the files list
            combined_files = list(form_files)  # Copy the list
            for key, value in form_data_dict.items():
                # Add form data as (key, value) tuples
                combined_files.append((key, value))
            files_param = combined_files
            data_param = None
        else:
            # For single file or dict format, use separate files and data
            files_param = form_files if form_files else None
            data_param = form_data_dict if form_data_dict else None
        
        # Debug: log the exact format being passed
        print(f"[DEBUG] [retell_post_multipart] files_param type: {type(files_param)}, length: {len(files_param) if files_param else 0}", flush=True)
        if files_param and isinstance(files_param, list):
            print(f"[DEBUG] [retell_post_multipart] First file tuple: {files_param[0] if len(files_param) > 0 else 'empty'}", flush=True)
            print(f"[DEBUG] [retell_post_multipart] First file tuple type: {type(files_param[0]) if len(files_param) > 0 else 'empty'}", flush=True)
            if len(files_param) > 0 and isinstance(files_param[0], tuple) and len(files_param[0]) > 1:
                print(f"[DEBUG] [retell_post_multipart] First file tuple[1] type: {type(files_param[0][1])}", flush=True)
        
        resp = await client.post(
            f"{get_retell_base_url()}{path}",
            headers=headers,
            files=files_param,
            data=data_param
        )
        
        logger.info(f"[retell_post_multipart] Response status: {resp.status_code}, body: {resp.text[:500]}")
        print(f"[DEBUG] [retell_post_multipart] Response status: {resp.status_code}", flush=True)
        print(f"[DEBUG] [retell_post_multipart] Response body: {resp.text[:500]}", flush=True)
        
        if resp.status_code >= 400:
            # Try to parse Retell error response
            error_detail = resp.text
            try:
                error_json = resp.json()
                if isinstance(error_json, dict):
                    error_msg = error_json.get("message") or error_json.get("error") or error_json.get("detail") or resp.text
                    error_detail = error_msg
            except Exception:
                pass
            logger.error(f"[retell_post_multipart] Retell API error: {resp.status_code} - {error_detail}")
            print(f"[DEBUG] [retell_post_multipart] Retell API error: {resp.status_code} - {error_detail}", flush=True)
            raise HTTPException(status_code=resp.status_code, detail=error_detail)
        if resp.status_code == 204 or not resp.content:
            return {}
        try:
            return resp.json()
        except Exception:
            return {}

