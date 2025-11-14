"""Retell AI API client utilities"""
import os
import httpx
from typing import Dict, Any
from fastapi import HTTPException


def get_retell_headers() -> Dict[str, str]:
    """Get Retell API headers"""
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")
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
        return resp.json()

