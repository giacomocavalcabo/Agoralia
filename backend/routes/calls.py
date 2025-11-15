"""Call management endpoints"""
import os
import json
import urllib.parse
import httpx
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config.database import engine
from models.calls import CallRecord, CallSegment
from models.agents import KnowledgeSection
from utils.auth import extract_tenant_id
from utils.tenant import tenant_session
from utils.helpers import country_iso_from_e164, _resolve_lang, _resolve_agent, _resolve_from_number
from utils.retell import (
    get_retell_headers,
    get_retell_base_url,
    retell_get_json,
    retell_post_json,
)
from utils.websocket import manager as ws_manager
from services.settings import get_settings
from services.enforcement import (
    enforce_subscription_or_raise,
    enforce_compliance_or_raise,
    enforce_budget_or_raise,
)

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class OutboundCallRequest(BaseModel):
    to: str = Field(..., description="E.164 destination, es. +39XXXXXXXXXX")
    from_number: Optional[str] = Field(None, description="Caller ID E.164 se disponibile")
    language: str = Field("it-IT")
    objective: str = Field("Qualifica lead secondo BANT in italiano")
    metadata: Optional[dict] = None
    agent_id: Optional[str] = None
    kb_id: Optional[int] = None


class WebCallRequest(BaseModel):
    agent_id: str = Field(...)
    metadata: Optional[dict] = None
    kb_id: Optional[int] = None


class InjectBody(BaseModel):
    message: str
    kind: Optional[str] = None  # e.g., reminder, summarize


class DispositionUpdate(BaseModel):
    outcome: str
    note: Optional[str] = None


# ============================================================================
# Retell Integration Endpoints
# ============================================================================

class PhoneNumberPurchase(BaseModel):
    phone_number: Optional[str] = None
    area_code: Optional[int] = None
    country_code: str = "IT"
    number_provider: str = "telnyx"
    inbound_agent_id: Optional[str] = None
    outbound_agent_id: Optional[str] = None
    nickname: Optional[str] = None


@router.post("/retell/phone-numbers/create")
async def purchase_phone_number(request: Request, body: PhoneNumberPurchase):
    """Purchase a phone number via Retell AI
    
    Body parameters:
    - phone_number: E.164 format (e.g., +393491234567) - When provided, country_code is ignored
    - area_code: US/CA area code (only for US/CA numbers via area code search)
    - country_code: Country code (US or CA only, required for area_code)
    - number_provider: telnyx or twilio
    - inbound_agent_id: Optional agent for inbound calls
    - outbound_agent_id: Optional agent for outbound calls
    - nickname: Optional nickname
    
    Note: Retell API supports country_code only for US/CA. For other countries,
    use phone_number directly in E.164 format.
    """
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")
    
    base_url = get_retell_base_url()
    endpoint = f"{base_url}/create-phone-number"
    headers = get_retell_headers()
    
    # Build request body for Retell API
    retell_body: Dict[str, Any] = {
        "number_provider": body.number_provider,
    }
    
    # Check if phone_number is provided
    if body.phone_number:
        retell_body["phone_number"] = body.phone_number
        # Don't include country_code when phone_number is provided - Retell only supports US/CA for country_code
        # The country is inferred from the phone_number E.164 format
        # Note: If Retell doesn't support IT via phone_number directly, you may need to purchase via Telnyx API directly
    elif body.area_code is not None:
        retell_body["area_code"] = body.area_code
        # For area_code, country_code is required and must be US or CA
        if body.country_code not in ["US", "CA"]:
            raise HTTPException(
                status_code=400,
                detail="Per area_code, country_code deve essere US o CA (Retell supporta solo questi)"
            )
        retell_body["country_code"] = body.country_code
    else:
        raise HTTPException(
            status_code=400,
            detail="Devi fornire phone_number (E.164) o area_code"
        )
    
    if body.inbound_agent_id:
        retell_body["inbound_agent_id"] = body.inbound_agent_id
    
    if body.outbound_agent_id:
        retell_body["outbound_agent_id"] = body.outbound_agent_id
    
    if body.nickname:
        retell_body["nickname"] = body.nickname
    
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(endpoint, headers=headers, json=retell_body)
            response_text = resp.text
            response_status = resp.status_code
            
            if resp.status_code >= 400:
                try:
                    error_json = resp.json()
                except Exception:
                    error_json = {"raw_response": response_text}
                
                return {
                    "success": False,
                    "status_code": response_status,
                    "error": error_json,
                    "request_sent": {
                        "endpoint": endpoint,
                        "headers": {k: "***" if k == "Authorization" else v for k, v in headers.items()},
                        "body": retell_body,
                    }
                }
            
            try:
                response_json = resp.json()
            except Exception:
                response_json = {"raw_response": response_text}
            
            # Save phone number to our database
            tenant_id = extract_tenant_id(request)
            if response_json.get("phone_number"):
                with Session(engine) as session:
                    from models.agents import PhoneNumber
                    from utils.helpers import country_iso_from_e164
                    
                    # Check if number already exists
                    existing = session.query(PhoneNumber).filter(
                        PhoneNumber.e164 == response_json["phone_number"]
                    ).first()
                    
                    if not existing:
                        new_number = PhoneNumber(
                            e164=response_json["phone_number"],
                            type="retell",
                            verified=1,
                            tenant_id=tenant_id,
                            country=country_iso_from_e164(response_json["phone_number"]),
                        )
                        session.add(new_number)
                        session.commit()
            
            return {
                "success": True,
                "status_code": response_status,
                "response": response_json,
                "request_sent": {
                    "endpoint": endpoint,
                    "headers": {k: "***" if k == "Authorization" else v for k, v in headers.items()},
                    "body": retell_body,
                }
            }
        except httpx.HTTPError as e:
            return {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__,
                "request_sent": {
                    "endpoint": endpoint,
                    "headers": {k: "***" if k == "Authorization" else v for k, v in headers.items()},
                    "body": retell_body,
                }
            }


@router.post("/retell/test")
async def test_retell_api(request: Request, agent_id: Optional[str] = None):
    """Test Retell API connection with minimal request
    
    Args:
        agent_id: Optional agent_id to use for test. If not provided, uses default_agent_id from settings.
    """
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")
    
    base_url = get_retell_base_url()
    endpoint = f"{base_url}/v2/create-phone-call"
    headers = get_retell_headers()
    
    # Minimal test request - just check if API responds
    # Using test numbers from Retell documentation
    from_num = os.getenv("DEFAULT_FROM_NUMBER")
    if not from_num:
        return {
            "success": False,
            "error": "DEFAULT_FROM_NUMBER non configurato",
            "required_fields": ["from_number", "to_number", "agent_id"],
            "missing": ["from_number (DEFAULT_FROM_NUMBER env var)"]
        }
    
    test_body = {
        "from_number": from_num,
        "to_number": "+12025551235",  # Test destination
    }
    
    # Check for agent_id - use query param if provided, otherwise try settings
    if not agent_id:
        try:
            from services.settings import get_settings
            settings = get_settings()
            if settings and settings.default_agent_id:
                agent_id = settings.default_agent_id
        except Exception:
            pass
    
    if agent_id:
        test_body["override_agent_id"] = agent_id
    # Note: Retell allows calls without override_agent_id if from_number has an agent bound
    # We'll try the call even without override_agent_id - Retell will use the agent bound to from_number
    
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(endpoint, headers=headers, json=test_body)
            response_text = resp.text
            response_status = resp.status_code
            
            # Try to parse JSON
            try:
                response_json = resp.json()
            except Exception:
                response_json = {"raw_response": response_text}
            
            return {
                "status_code": response_status,
                "success": resp.status_code < 400,
                "response": response_json,
                "request_sent": {
                    "endpoint": endpoint,
                    "headers": {k: "***" if k == "Authorization" else v for k, v in headers.items()},
                    "body": test_body,
                }
            }
        except httpx.HTTPError as e:
            return {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__,
                "request_sent": {
                    "endpoint": endpoint,
                    "headers": {k: "***" if k == "Authorization" else v for k, v in headers.items()},
                    "body": test_body,
                }
            }


@router.post("/retell/outbound")
async def create_outbound_call(request: Request, payload: OutboundCallRequest):
    """Create outbound phone call via Retell"""
    import traceback
    import sys
    import logging
    logger = logging.getLogger(__name__)
    
    # Configure logging to stdout if not configured
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    
    error_step = "initialization"
    try:
        api_key = os.getenv("RETELL_API_KEY")
        if not api_key:
            raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")

        base_url = get_retell_base_url()
        endpoint = f"{base_url}/v2/create-phone-call"
        headers = get_retell_headers()

        # Resolve from_number with priority: explicit -> campaign -> settings -> env
        tenant_id = extract_tenant_id(request)
        lead_id = None
        campaign_id = None
        if payload.metadata:
            campaign_id = payload.metadata.get("campaign_id")
            lead_id = payload.metadata.get("lead_id")
        
        logger.info(f"[create_outbound_call] tenant_id={tenant_id}, campaign_id={campaign_id}, lead_id={lead_id}")
        print(f"[DEBUG] tenant_id={tenant_id}, campaign_id={campaign_id}, lead_id={lead_id}", flush=True)
        
        error_step = "resolve_from_number"
        with Session(engine) as session:
            # Load lead if needed
            lead = None
            if lead_id:
                from models.campaigns import Lead
                lead = session.get(Lead, lead_id)
                logger.info(f"[create_outbound_call] lead loaded: {lead is not None}")
                if lead and tenant_id is not None and lead.tenant_id != tenant_id:
                    lead = None
                elif lead and lead.campaign_id:
                    campaign_id = lead.campaign_id
            
            from_num = _resolve_from_number(
                session,
                from_number=payload.from_number,
                campaign_id=campaign_id,
                lead_id=lead.id if lead else None,
                tenant_id=tenant_id,
            )
            logger.info(f"[create_outbound_call] from_num resolved: {from_num}")
            if not from_num:
                raise HTTPException(
                    status_code=400,
                    detail="from_number mancante: imposta DEFAULT_FROM_NUMBER nelle settings/env o passa un Caller ID valido"
                )
            lang = _resolve_lang(
                session, request, payload.to,
                (payload.metadata or {}).get("lang") if payload.metadata else None
            )
            logger.info(f"[create_outbound_call] lang resolved: {lang}")
            agent_id = payload.agent_id
            is_multi = False
            if not agent_id:
                aid, is_multi = _resolve_agent(session, tenant_id, "voice", lang)
                if aid:
                    agent_id = aid
            logger.info(f"[create_outbound_call] agent_id: {agent_id}, is_multi: {is_multi}")
        
        # Build request body - Retell AI requires: from_number, to_number
        # agent_id is optional - if not provided, Retell uses the agent bound to from_number
        body = {
            "from_number": from_num,
            "to_number": payload.to,
        }
        # Use override_agent_id if we have an agent_id (Retell API parameter name)
        if agent_id:
            body["override_agent_id"] = agent_id
        body.setdefault("metadata", {})
        body["metadata"]["lang"] = lang
        if is_multi:
            body["metadata"]["instruction"] = f"rispondi sempre in {lang}"
            # Attach kb version for traceability
            try:
                s = get_settings()
                body["metadata"]["kb_version"] = int(s.kb_version_outbound or 0)
            except Exception:
                pass
        if payload.metadata is not None:
            body["metadata"].update(payload.metadata)
        # Attach knowledge pack
        if payload.kb_id is not None:
            with Session(engine) as session:
                secs = (
                    session.query(KnowledgeSection)
                    .filter(KnowledgeSection.kb_id == payload.kb_id)
                    .order_by(KnowledgeSection.id.asc())
                    .all()
                )
                if secs:
                    body.setdefault("metadata", {})
                    body["metadata"]["kb"] = {
                        "knowledge": [s.content_text for s in secs if s.kind == "knowledge" and s.content_text],
                        "rules": [s.content_text for s in secs if s.kind == "rules" and s.content_text],
                        "style": [s.content_text for s in secs if s.kind == "style" and s.content_text],
                    }

        logger.info(f"[create_outbound_call] body prepared: {json.dumps(body)}")
        
        # Compliance + subscription + budget gating
        # Reload lead in new session for compliance check
        logger.info("[create_outbound_call] Starting compliance checks...")
        print("[DEBUG] Starting compliance checks...", flush=True)
        error_step = "compliance_check"
        with Session(engine) as session:
            lead_for_compliance = None
            if lead_id:
                from models.campaigns import Lead
                lead_for_compliance = session.get(Lead, lead_id)
                if lead_for_compliance and tenant_id is not None and lead_for_compliance.tenant_id != tenant_id:
                    lead_for_compliance = None
            logger.info("[create_outbound_call] Enforcing subscription...")
            print("[DEBUG] Enforcing subscription...", flush=True)
            enforce_subscription_or_raise(session, request)
            logger.info("[create_outbound_call] Enforcing compliance...")
            print("[DEBUG] Enforcing compliance...", flush=True)
            enforce_compliance_or_raise(session, request, payload.to, payload.metadata, lead=lead_for_compliance)
            logger.info("[create_outbound_call] Enforcing budget...")
            print("[DEBUG] Enforcing budget...", flush=True)
            enforce_budget_or_raise(session, request)
        
        logger.info(f"[create_outbound_call] Calling Retell API: {endpoint}")
        print(f"[DEBUG] Calling Retell API: {endpoint}", flush=True)
        error_step = "retell_api_call"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(endpoint, headers=headers, json=body)
            logger.info(f"[create_outbound_call] Retell API response status: {resp.status_code}")
            print(f"[DEBUG] Retell API response status: {resp.status_code}", flush=True)
            if resp.status_code >= 400:
                error_text = resp.text
                logger.error(f"[create_outbound_call] Retell API error: {error_text}")
                print(f"[DEBUG] Retell API error: {error_text}", flush=True)
                raise HTTPException(status_code=resp.status_code, detail=error_text)
            data = resp.json()
            logger.info(f"[create_outbound_call] Retell API success: {data.get('call_id') or data.get('id')}")
            print(f"[DEBUG] Retell API success: {data.get('call_id') or data.get('id')}", flush=True)
            error_step = "persist_call"
            # Persist call
            tenant_id = extract_tenant_id(request)
            with Session(engine) as session:
                rec = CallRecord(
                    direction="outbound",
                    provider="retell",
                    to_number=payload.to,
                    from_number=from_num,
                    provider_call_id=str(data.get("call_id") or data.get("id") or ""),
                    status="created",
                    raw_response=str(data),
                    tenant_id=tenant_id,
                )
                session.add(rec)
                session.commit()
            await ws_manager.broadcast({"type": "call.created", "data": data})
            return data
    except HTTPException as he:
        logger.error(f"[create_outbound_call] HTTPException at step {error_step}: {he.status_code} - {he.detail}")
        print(f"[DEBUG] HTTPException at step {error_step}: {he.status_code} - {he.detail}", flush=True)
        raise
    except Exception as e:
        error_msg = str(e)
        error_traceback = traceback.format_exc()
        logger.error(f"[create_outbound_call] Exception at step {error_step}: {error_msg}\n{error_traceback}")
        print(f"[DEBUG] Exception at step {error_step}: {error_msg}", flush=True)
        print(f"[DEBUG] Traceback:\n{error_traceback}", flush=True)
        # Return full error details for debugging
        exc_type, exc_value, exc_tb = sys.exc_info()
        error_detail = f"Error at {error_step}: {exc_type.__name__}: {error_msg}"
        if exc_tb:
            tb_lines = traceback.format_tb(exc_tb)
            error_detail += f"\nTraceback:\n{''.join(tb_lines[-5:])}"  # Last 5 frames
        raise HTTPException(status_code=500, detail=error_detail)


@router.post("/retell/web")
async def create_web_call(payload: WebCallRequest):
    """Create web call via Retell"""
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")

    base_url = get_retell_base_url()
    endpoint = f"{base_url}/v2/create-web-call"
    headers = get_retell_headers()

    # Resolve language/agent for chat/web
    body: Dict[str, Any] = {}
    with Session(engine) as session:
        lang = (payload.metadata or {}).get("lang") if payload.metadata else None
        lang = lang or (get_settings().default_lang or "en-US")
        agent_id = payload.agent_id
        if not agent_id:
            aid, is_multi = _resolve_agent(session, None, "chat", lang)
            if aid:
                agent_id = aid
                if is_multi:
                    body.setdefault("metadata", {})
                    body["metadata"]["instruction"] = f"rispondi sempre in {lang}"
        if agent_id:
            body["agent_id"] = agent_id
        body.setdefault("metadata", {})
        body["metadata"]["lang"] = lang
        if payload.metadata:
            body["metadata"].update(payload.metadata)
    # Attach knowledge pack if kb_id passed
    if payload.kb_id is not None:
        with Session(engine) as session:
            secs = (
                session.query(KnowledgeSection)
                .filter(KnowledgeSection.kb_id == payload.kb_id)
                .order_by(KnowledgeSection.id.asc())
                .all()
            )
            if secs:
                body.setdefault("metadata", {})
                body["metadata"]["kb"] = {
                    "knowledge": [s.content_text for s in secs if s.kind == "knowledge" and s.content_text],
                    "rules": [s.content_text for s in secs if s.kind == "rules" and s.content_text],
                    "style": [s.content_text for s in secs if s.kind == "style" and s.content_text],
                }
    # Add kb_version if present
    try:
        s = get_settings()
        body.setdefault("metadata", {})
        body["metadata"]["kb_version"] = int(s.kb_version_outbound or 0)
    except Exception:
        pass
    body = {k: v for k, v in body.items() if v is not None}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(endpoint, headers=headers, json=body)
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        data = resp.json()
        with Session(engine) as session:
            rec = CallRecord(
                direction="web",
                provider="retell",
                to_number=None,
                from_number=None,
                provider_call_id=str(data.get("call_id") or data.get("id") or ""),
                status="created",
                raw_response=str(data),
                tenant_id=None,
            )
            session.add(rec)
            session.commit()
        await ws_manager.broadcast({"type": "webcall.created", "data": data})
        return data


@router.get("/retell/calls/{provider_call_id}")
async def retell_get_call(provider_call_id: str):
    """Get call details from Retell"""
    data = await retell_get_json(f"/v2/get-call?call_id={urllib.parse.quote(provider_call_id)}")
    return data


@router.get("/retell/calls")
async def retell_list_calls(limit: int = 50, cursor: Optional[str] = None):
    """List calls from Retell"""
    qs = {"limit": max(1, min(limit, 100))}
    if cursor:
        qs["cursor"] = cursor
    query = urllib.parse.urlencode(qs)
    # Use correct Retell API endpoint
    data = await retell_get_json(f"/v2/list-phone-calls?{query}")
    return data


@router.get("/retell/agents")
async def retell_list_agents(limit: Optional[int] = None, pagination_key: Optional[str] = None, pagination_key_version: Optional[int] = None):
    """List agents from Retell AI
    
    Query params:
    - limit: Limit on number of objects (1-1000, default 1000)
    - pagination_key: Agent ID to continue from
    - pagination_key_version: Version of agent at pagination_key
    """
    params: Dict[str, Any] = {}
    if limit is not None:
        params["limit"] = limit
    if pagination_key is not None:
        params["pagination_key"] = pagination_key
    if pagination_key_version is not None:
        params["pagination_key_version"] = pagination_key_version
    
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    path = "/list-agents"
    if query_string:
        path += f"?{query_string}"
    
    try:
        data = await retell_get_json(path)
        return data
    except HTTPException as e:
        # Try alternative endpoint
        try:
            data = await retell_get_json(f"/v2{path}" if not path.startswith("/v2") else path)
            return data
        except Exception:
            raise e


@router.get("/retell/agents/{agent_id}")
async def retell_get_agent(agent_id: str, version: Optional[int] = None):
    """Get agent details from Retell AI
    
    Path params:
    - agent_id: Unique id of the agent to retrieve
    
    Query params:
    - version: Optional version of the API to use (default latest)
    """
    path = f"/get-agent/{agent_id}"
    if version is not None:
        path += f"?version={version}"
    
    try:
        data = await retell_get_json(path)
        return data
    except HTTPException as e:
        # Try v2 endpoint
        try:
            v2_path = f"/v2/get-agent/{agent_id}"
            if version is not None:
                v2_path += f"?version={version}"
            data = await retell_get_json(v2_path)
            return data
        except Exception:
            raise e


@router.post("/retell/agents/{agent_id}/publish")
async def retell_publish_agent(agent_id: str):
    """Publish the latest version of an agent and create a new draft with newer version
    
    According to Retell AI docs:
    - POST /publish-agent/{agent_id} publishes the agent
    - Response: 200 with "Agent successfully published"
    """
    import logging
    import traceback
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"[publish_agent] Attempting to publish agent: {agent_id}")
        print(f"[DEBUG] [publish_agent] Attempting to publish agent: {agent_id}", flush=True)
        
        # Publish agent
        data = await retell_post_json(f"/publish-agent/{agent_id}", {})
        logger.info(f"[publish_agent] Successfully published agent: {agent_id}, response: {data}")
        print(f"[DEBUG] [publish_agent] Successfully published agent: {agent_id}, response: {data}", flush=True)
        
        return {
            "success": True,
            "message": "Agent successfully published",
            "response": data,
        }
    except HTTPException as e:
        logger.error(f"[publish_agent] HTTPException publishing agent {agent_id}: {e.status_code} - {e.detail}")
        print(f"[DEBUG] [publish_agent] HTTPException publishing agent {agent_id}: {e.status_code} - {e.detail}", flush=True)
        
        # Try v2 endpoint
        try:
            logger.info(f"[publish_agent] Trying v2 endpoint for agent: {agent_id}")
            print(f"[DEBUG] [publish_agent] Trying v2 endpoint for agent: {agent_id}", flush=True)
            
            data = await retell_post_json(f"/v2/publish-agent/{agent_id}", {})
            logger.info(f"[publish_agent] Successfully published agent (v2): {agent_id}, response: {data}")
            print(f"[DEBUG] [publish_agent] Successfully published agent (v2): {agent_id}, response: {data}", flush=True)
            
            return {
                "success": True,
                "message": "Agent successfully published",
                "response": data,
            }
        except Exception as ex:
            logger.error(f"[publish_agent] Exception in v2 fallback for agent {agent_id}: {ex}\n{traceback.format_exc()}")
            print(f"[DEBUG] [publish_agent] Exception in v2 fallback for agent {agent_id}: {ex}", flush=True)
            print(f"[DEBUG] Traceback:\n{traceback.format_exc()}", flush=True)
            raise e
    except Exception as e:
        logger.error(f"[publish_agent] Unexpected exception publishing agent {agent_id}: {e}\n{traceback.format_exc()}")
        print(f"[DEBUG] [publish_agent] Unexpected exception publishing agent {agent_id}: {e}", flush=True)
        print(f"[DEBUG] Traceback:\n{traceback.format_exc()}", flush=True)
        raise HTTPException(status_code=500, detail=f"Error publishing agent: {str(e)}")


@router.get("/retell/agents/{agent_id}/versions")
async def retell_get_agent_versions(agent_id: str, version: Optional[int] = None):
    """Get all versions of an agent
    
    According to Retell AI docs:
    - GET /get-agent-versions/{agent_id} returns all versions
    - Returns array of agent objects with different versions
    """
    path = f"/get-agent-versions/{agent_id}"
    if version is not None:
        path += f"?version={version}"
    
    try:
        data = await retell_get_json(path)
        return data
    except HTTPException as e:
        # Try v2 endpoint
        try:
            v2_path = f"/v2/get-agent-versions/{agent_id}"
            if version is not None:
                v2_path += f"?version={version}"
            data = await retell_get_json(v2_path)
            return data
        except Exception:
            raise e


@router.get("/retell/agents/{agent_id}/mcp-tools")
async def retell_get_mcp_tools(agent_id: str, mcp_id: str, version: Optional[int] = None):
    """Get MCP tools for a specific agent
    
    According to Retell AI docs:
    - GET /get-mcp-tools/{agent_id}?mcp_id=... returns MCP tools
    - Returns array of tool definitions with name, description, inputSchema
    """
    path = f"/get-mcp-tools/{agent_id}?mcp_id={mcp_id}"
    if version is not None:
        path += f"&version={version}"
    
    try:
        data = await retell_get_json(path)
        return data
    except HTTPException as e:
        # Try v2 endpoint
        try:
            v2_path = f"/v2/get-mcp-tools/{agent_id}?mcp_id={mcp_id}"
            if version is not None:
                v2_path += f"&version={version}"
            data = await retell_get_json(v2_path)
            return data
        except Exception:
            raise e


@router.post("/retell/agents/test-create")
async def retell_create_agent_test(request: Request):
    """Test endpoint to create Retell agent and see full response"""
    from services.agents import create_retell_agent
    
    try:
        # Test creation with minimal config
        response = await create_retell_agent(
            name="Test Direct Retell",
            language="it-IT",
            voice_id="11labs-Adrian",
        )
        return {
            "success": True,
            "response": response,
            "retell_agent_id": (
                response.get("retell_llm_id") or
                response.get("llm_id") or
                response.get("id") or
                response.get("agent_id")
            ),
        }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


@router.patch("/retell/phone-numbers/{phone_number}")
async def update_retell_phone_number(
    phone_number: str,
    inbound_agent_id: Optional[str] = None,
    outbound_agent_id: Optional[str] = None,
    nickname: Optional[str] = None,
):
    """Update phone number configuration in Retell AI (bind agents)
    
    Args:
        phone_number: E.164 format number (e.g., +14158735112)
        inbound_agent_id: Agent ID for inbound calls
        outbound_agent_id: Agent ID for outbound calls
        nickname: Optional nickname
    """
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")
    
    base_url = get_retell_base_url()
    endpoint = f"{base_url}/update-phone-number"
    headers = get_retell_headers()
    
    body: Dict[str, Any] = {"phone_number": phone_number}
    
    if inbound_agent_id is not None:
        body["inbound_agent_id"] = inbound_agent_id
    if outbound_agent_id is not None:
        body["outbound_agent_id"] = outbound_agent_id
    if nickname is not None:
        body["nickname"] = nickname
    
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.patch(endpoint, headers=headers, json=body)
            if resp.status_code >= 400:
                try:
                    error_json = resp.json()
                except Exception:
                    error_json = {"raw_response": resp.text}
                raise HTTPException(status_code=resp.status_code, detail=str(error_json))
            
            return {
                "success": True,
                "response": resp.json(),
                "request_sent": {
                    "endpoint": endpoint,
                    "body": body,
                }
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.post("/retell/backfill")
async def retell_backfill(request: Request, limit: int = 100):
    """Backfill calls from Retell to local database"""
    lst = await retell_list_calls(limit=limit)
    items = lst.get("calls") or lst.get("items") or []
    new_count = 0
    with Session(engine) as session:
        tenant_id = extract_tenant_id(request)
        for c in items:
            pid = str(c.get("call_id") or c.get("id") or "")
            if not pid:
                continue
            exists = session.query(CallRecord).filter(CallRecord.provider_call_id == pid).one_or_none()
            if exists:
                continue
            rec = CallRecord(
                direction=str(c.get("direction") or "outbound"),
                provider="retell",
                to_number=c.get("to_number"),
                from_number=c.get("from_number"),
                provider_call_id=pid,
                status=str(c.get("status") or "created"),
                raw_response=json.dumps(c),
                tenant_id=tenant_id,
            )
            session.add(rec)
            new_count += 1
        session.commit()
    return {"backfilled": new_count}


# ============================================================================
# Call Management Endpoints
# ============================================================================

@router.get("")
async def list_calls(request: Request) -> List[Dict[str, Any]]:
    """List all calls"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        q = session.query(CallRecord).order_by(CallRecord.created_at.desc())
        if tenant_id is not None:
            q = q.filter(CallRecord.tenant_id == tenant_id)
        rows = q.limit(200).all()
        return [
            {
                "id": r.id,
                "created_at": r.created_at.isoformat(),
                "direction": r.direction,
                "provider": r.provider,
                "to": r.to_number,
                "from": r.from_number,
                "provider_call_id": r.provider_call_id,
                "status": r.status,
                "audio_url": r.audio_url,
                "country_iso": country_iso_from_e164(r.to_number),
            }
            for r in rows
        ]


@router.get("/live")
async def list_live_calls(request: Request, hours: int = 6) -> List[Dict[str, Any]]:
    """List live (active) calls"""
    tenant_id = extract_tenant_id(request)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max(1, min(hours, 48)))
    with tenant_session(request) as session:
        q = session.query(CallRecord).filter(CallRecord.created_at >= cutoff).filter(CallRecord.status != "ended")
        if tenant_id is not None:
            q = q.filter(CallRecord.tenant_id == tenant_id)
        rows = q.order_by(CallRecord.created_at.desc()).limit(100).all()
        return [
            {
                "id": r.id,
                "created_at": r.created_at.isoformat(),
                "direction": r.direction,
                "to": r.to_number,
                "from": r.from_number,
                "provider_call_id": r.provider_call_id,
                "audio_url": r.audio_url,
                "status": r.status,
            }
            for r in rows
        ]


@router.get("/{call_id}")
async def get_call(request: Request, call_id: int) -> Dict[str, Any]:
    """Get call details"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        r = session.get(CallRecord, call_id)
        if not r:
            raise HTTPException(status_code=404, detail="Call not found")
        if tenant_id is not None and r.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Call not found")
        
        # Parse media_json if exists
        media_urls = []
        try:
            if r.media_json:
                media_data = json.loads(r.media_json)
                media_urls = media_data.get("audio_urls", [])
        except Exception:
            pass
        # Fallback to audio_url if no media_json
        if not media_urls and r.audio_url:
            media_urls = [r.audio_url]
        
        return {
            "id": r.id,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat(),
            "direction": r.direction,
            "provider": r.provider,
            "to": r.to_number,
            "from": r.from_number,
            "provider_call_id": r.provider_call_id,
            "status": r.status,
            "raw_response": r.raw_response,
            "country_iso": country_iso_from_e164(r.to_number),
            "disposition": r.disposition_outcome,
            "disposition_note": r.disposition_note,
            "audio_url": media_urls[0] if media_urls else None,
            "audio_urls": media_urls,
        }


@router.get("/{call_id}/segments")
async def get_call_segments(call_id: int) -> List[Dict[str, Any]]:
    """Get call transcript segments"""
    with Session(engine) as session:
        rows = (
            session.query(CallSegment)
            .filter(CallSegment.call_id == call_id)
            .order_by(CallSegment.id.asc())
            .all()
        )
        return [
            {
                "id": s.id,
                "turn_index": s.turn_index,
                "speaker": s.speaker,
                "start_ms": s.start_ms,
                "end_ms": s.end_ms,
                "text": s.text,
                "ts": s.ts.isoformat() if s.ts else None,
            }
            for s in rows
        ]


@router.get("/{call_id}/summary")
async def get_call_summary(call_id: int) -> Dict[str, Any]:
    """Get call summary and structured data"""
    with Session(engine) as session:
        r = session.get(CallRecord, call_id)
        if not r:
            raise HTTPException(status_code=404, detail="Call not found")
        
        # Parse summary_json
        summary = None
        try:
            if r.summary_json:
                summary_data = json.loads(r.summary_json)
                summary = summary_data.get("bullets", {})
        except Exception:
            summary = {"raw": r.summary_json} if r.summary_json else None
        
        # Parse structured_json (BANT/TRADE)
        bant = {}
        trade = {}
        try:
            if r.structured_json:
                structured_data = json.loads(r.structured_json)
                bant = structured_data.get("bant", {})
                trade = structured_data.get("trade", {})
        except Exception:
            pass
        
        return {
            "summary": summary,
            "bant": bant,
            "trade": trade,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }


@router.post("/{call_id}/end")
async def end_call(call_id: int) -> Dict[str, Any]:
    """End a call"""
    with Session(engine) as session:
        rec = session.get(CallRecord, call_id)
        if not rec:
            raise HTTPException(status_code=404, detail="Call not found")
        if rec.status == "ended":
            return {"ok": True, "already": True}
        rec.status = "ended"
        rec.updated_at = datetime.now(timezone.utc)
        session.commit()
        # Broadcast a finish event for dashboards
        data = {"call_id": rec.provider_call_id, "local_id": rec.id}
        await ws_manager.broadcast({"type": "call.finished", "data": data})
        return {"ok": True}


@router.post("/{call_id}/inject")
async def inject_call(call_id: int, body: InjectBody) -> Dict[str, Any]:
    """Inject message into call"""
    # MVP: only broadcast an inject event for UI; provider-side integration can be added later
    payload = {"call_id": call_id, "message": body.message, "kind": body.kind}
    await ws_manager.broadcast({"type": "call.inject", "data": payload})
    return {"ok": True}


@router.post("/{call_id}/pause")
async def pause_call(call_id: int) -> Dict[str, Any]:
    """Pause a call"""
    await ws_manager.broadcast({"type": "call.pause", "data": {"call_id": call_id}})
    return {"ok": True}


@router.post("/{call_id}/resume")
async def resume_call(call_id: int) -> Dict[str, Any]:
    """Resume a paused call"""
    await ws_manager.broadcast({"type": "call.resume", "data": {"call_id": call_id}})
    return {"ok": True}


@router.post("/{call_id}/disposition")
async def update_disposition(call_id: int, body: DispositionUpdate) -> Dict[str, Any]:
    """Update call disposition"""
    with Session(engine) as session:
        r = session.get(CallRecord, call_id)
        if not r:
            raise HTTPException(status_code=404, detail="Call not found")
        r.disposition_outcome = body.outcome
        r.disposition_note = body.note
        r.disposition_updated_at = datetime.now(timezone.utc)
        session.commit()
    return {"ok": True}


@router.get("/history/{phone}")
async def calls_by_phone(
    request: Request,
    phone: str,
    created_gte: Optional[str] = None,
    created_lte: Optional[str] = None,
    outcome: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Get call history for a phone number"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        q = session.query(CallRecord).filter(
            (CallRecord.to_number == phone) | (CallRecord.from_number == phone)
        )
        if tenant_id is not None:
            q = q.filter(CallRecord.tenant_id == tenant_id)
        # Date filters
        try:
            if created_gte:
                gte = datetime.fromisoformat(created_gte)
                if gte.tzinfo is None:
                    gte = gte.replace(tzinfo=timezone.utc)
                q = q.filter(CallRecord.created_at >= gte)
        except Exception:
            pass
        try:
            if created_lte:
                lte = datetime.fromisoformat(created_lte)
                if lte.tzinfo is None:
                    lte = lte.replace(tzinfo=timezone.utc)
                q = q.filter(CallRecord.created_at <= lte)
        except Exception:
            pass
        rows = q.order_by(CallRecord.created_at.desc()).limit(500).all()
        results: List[Dict[str, Any]] = []
        for r in rows:
            out = r.disposition_outcome
            if outcome and (out or "").lower() != outcome.lower():
                continue
            results.append(
                {
                    "id": r.id,
                    "created_at": r.created_at.isoformat(),
                    "direction": r.direction,
                    "to": r.to_number,
                    "from": r.from_number,
                    "status": r.status,
                    "outcome": out,
                }
            )
        return results

