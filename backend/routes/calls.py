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
from models.agents import KnowledgeSection, KnowledgeBase
from utils.auth import extract_tenant_id
from utils.tenant import tenant_session
from utils.helpers import country_iso_from_e164, _resolve_lang, _resolve_agent, _resolve_from_number
from utils.retell import (
    get_retell_headers,
    get_retell_base_url,
    retell_get_json,
    retell_post_json,
    retell_patch_json,
    retell_delete_json,
    retell_post_multipart,
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

class AgentOverrideAgent(BaseModel):
    """Partial Agent settings for agent override"""
    voice_id: Optional[str] = None
    voice_model: Optional[str] = None
    fallback_voice_ids: Optional[List[str]] = None
    voice_temperature: Optional[float] = None
    voice_speed: Optional[float] = None
    volume: Optional[float] = None
    language: Optional[str] = None
    normalize_for_speech: Optional[bool] = None
    pronunciation_dictionary: Optional[List[Dict[str, Any]]] = None
    boosted_keywords: Optional[List[str]] = None
    stt_mode: Optional[str] = None
    vocab_specialization: Optional[Dict[str, Any]] = None
    denoising_mode: Optional[str] = None
    responsiveness: Optional[float] = None
    interruption_sensitivity: Optional[float] = None
    enable_backchannel: Optional[bool] = None
    backchannel_frequency: Optional[float] = None
    backchannel_words: Optional[List[str]] = None
    end_call_after_silence_ms: Optional[int] = None
    max_call_duration_ms: Optional[int] = None
    begin_message_delay_ms: Optional[int] = None
    ring_duration_ms: Optional[int] = None
    reminder_trigger_ms: Optional[int] = None
    reminder_max_count: Optional[int] = None
    ambient_sound: Optional[str] = None
    ambient_sound_volume: Optional[float] = None
    allow_user_dtmf: Optional[bool] = None
    user_dtmf_options: Optional[List[str]] = None
    voicemail_option: Optional[Dict[str, Any]] = None
    webhook_url: Optional[str] = None
    webhook_timeout_ms: Optional[int] = None
    data_storage_setting: Optional[Dict[str, Any]] = None
    opt_in_signed_url: Optional[str] = None
    pii_config: Optional[Dict[str, Any]] = None
    post_call_analysis_data: Optional[Dict[str, Any]] = None
    post_call_analysis_model: Optional[str] = None
    begin_message: Optional[str] = None


class AgentOverrideRetellLLM(BaseModel):
    """Partial Retell LLM settings for agent override"""
    model: Optional[str] = None
    s2s_model: Optional[str] = None
    model_temperature: Optional[float] = None
    knowledge_base_ids: Optional[List[str]] = None
    kb_config: Optional[Dict[str, Any]] = None
    start_speaker: Optional[str] = None  # "agent" or "user"
    begin_after_user_silence_ms: Optional[int] = None
    begin_message: Optional[str] = None


class AgentOverrideConversationFlow(BaseModel):
    """Partial Conversation Flow settings for agent override"""
    model_choice: Optional[Dict[str, Any]] = None
    model_temperature: Optional[float] = None
    knowledge_base_ids: Optional[List[str]] = None
    kb_config: Optional[Dict[str, Any]] = None
    start_speaker: Optional[str] = None  # "agent" or "user"
    begin_after_user_silence_ms: Optional[int] = None
    begin_message: Optional[str] = None


class AgentOverride(BaseModel):
    """Complete agent override configuration for per-call customization
    
    According to Retell AI docs:
    - agent_override allows overriding agent behavior without modifying the saved agent
    - Overrides are applied only for this specific call
    - Must satisfy same validation rules as agent creation
    """
    agent: Optional[AgentOverrideAgent] = None
    retell_llm: Optional[AgentOverrideRetellLLM] = None
    conversation_flow: Optional[AgentOverrideConversationFlow] = None


class OutboundCallRequest(BaseModel):
    to: str = Field(..., description="E.164 destination, es. +39XXXXXXXXXX")
    from_number: Optional[str] = Field(None, description="Caller ID E.164 se disponibile")
    language: str = Field("it-IT")
    objective: str = Field("Qualifica lead secondo BANT in italiano")
    metadata: Optional[dict] = None
    agent_id: Optional[str] = None
    override_agent_version: Optional[int] = Field(None, description="Agent version to use (Retell API)")
    agent_override: Optional[AgentOverride] = Field(None, description="Complete agent override for per-call customization")
    retell_llm_dynamic_variables: Optional[Dict[str, str]] = Field(None, description="Dynamic variables for personalization (all values must be strings)")
    kb_id: Optional[int] = Field(None, description="Agoralia Knowledge Base ID (will be converted to Retell KB ID)")
    knowledge_base_ids: Optional[List[str]] = Field(None, description="Retell Knowledge Base IDs (e.g., ['knowledge_base_xxx']) - takes precedence over kb_id")


class WebCallRequest(BaseModel):
    agent_id: str = Field(...)
    metadata: Optional[dict] = None
    kb_id: Optional[int] = Field(None, description="Agoralia Knowledge Base ID (will be converted to Retell KB ID)")
    knowledge_base_ids: Optional[List[str]] = Field(None, description="Retell Knowledge Base IDs (e.g., ['knowledge_base_xxx']) - takes precedence over kb_id")


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
    """Request body for purchasing a phone number (deprecated - use PhoneNumberUnified)"""
    phone_number: Optional[str] = None  # E.164 format (e.g., +14157774444)
    area_code: Optional[int] = None  # 3-digit US area code (e.g., 415)
    country_code: Optional[str] = "US"  # US or CA only (default: US)
    number_provider: str = "twilio"  # twilio or telnyx
    inbound_agent_id: Optional[str] = None
    outbound_agent_id: Optional[str] = None
    inbound_agent_version: Optional[int] = None
    outbound_agent_version: Optional[int] = None
    nickname: Optional[str] = None
    inbound_webhook_url: Optional[str] = None
    toll_free: Optional[bool] = False


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
        country_code = body.country_code or "US"
        if country_code not in ["US", "CA"]:
            raise HTTPException(
                status_code=400,
                detail="Per area_code, country_code deve essere US o CA (Retell supporta solo questi)"
            )
        retell_body["country_code"] = country_code
    else:
        raise HTTPException(
            status_code=400,
            detail="Devi fornire phone_number (E.164) o area_code"
        )
    
    # Optional fields
    if body.inbound_agent_id is not None:
        retell_body["inbound_agent_id"] = body.inbound_agent_id
    if body.outbound_agent_id is not None:
        retell_body["outbound_agent_id"] = body.outbound_agent_id
    if body.inbound_agent_version is not None:
        retell_body["inbound_agent_version"] = body.inbound_agent_version
    if body.outbound_agent_version is not None:
        retell_body["outbound_agent_version"] = body.outbound_agent_version
    if body.nickname:
        retell_body["nickname"] = body.nickname
    if body.inbound_webhook_url:
        retell_body["inbound_webhook_url"] = body.inbound_webhook_url
    if body.toll_free:
        retell_body["toll_free"] = body.toll_free
    
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
        
        # Agent override: Use override_agent_id/override_agent_version if provided
        if agent_id:
            body["override_agent_id"] = agent_id
        if payload.override_agent_version is not None:
            body["override_agent_version"] = payload.override_agent_version
        
        # Agent Override: Complete per-call customization
        # According to Retell docs: if both override_agent_id and agent_override are provided,
        # we first resolve the target agent by id/version, then apply agent_override on top
        agent_override_dict: Dict[str, Any] = {}
        if payload.agent_override:
            if payload.agent_override.agent:
                agent_dict: Dict[str, Any] = {}
                agent_override = payload.agent_override.agent
                # Only include fields that are not None
                for field_name in AgentOverrideAgent.__fields__.keys():
                    value = getattr(agent_override, field_name, None)
                    if value is not None:
                        agent_dict[field_name] = value
                if agent_dict:
                    agent_override_dict["agent"] = agent_dict
            
            if payload.agent_override.retell_llm:
                retell_llm_dict: Dict[str, Any] = {}
                retell_llm_override = payload.agent_override.retell_llm
                for field_name in AgentOverrideRetellLLM.__fields__.keys():
                    value = getattr(retell_llm_override, field_name, None)
                    if value is not None:
                        retell_llm_dict[field_name] = value
                if retell_llm_dict:
                    agent_override_dict["retell_llm"] = retell_llm_dict
            
            if payload.agent_override.conversation_flow:
                conversation_flow_dict: Dict[str, Any] = {}
                conversation_flow_override = payload.agent_override.conversation_flow
                for field_name in AgentOverrideConversationFlow.__fields__.keys():
                    value = getattr(conversation_flow_override, field_name, None)
                    if value is not None:
                        conversation_flow_dict[field_name] = value
                if conversation_flow_dict:
                    agent_override_dict["conversation_flow"] = conversation_flow_dict
            
            if agent_override_dict:
                body["agent_override"] = agent_override_dict
                logger.info(f"[create_outbound_call] Agent override applied: {json.dumps(agent_override_dict)}")
                print(f"[DEBUG] Agent override applied: {json.dumps(agent_override_dict)}", flush=True)
        
        # Dynamic Variables: Personalize agent responses with {{variable_name}} syntax
        # According to Retell docs: all values must be strings
        if payload.retell_llm_dynamic_variables:
            # Validate all values are strings
            for key, value in payload.retell_llm_dynamic_variables.items():
                if not isinstance(value, str):
                    raise HTTPException(
                        status_code=400,
                        detail=f"retell_llm_dynamic_variables.{key} must be a string (got {type(value).__name__})"
                    )
            body["retell_llm_dynamic_variables"] = payload.retell_llm_dynamic_variables
            logger.info(f"[create_outbound_call] Dynamic variables applied: {payload.retell_llm_dynamic_variables}")
            print(f"[DEBUG] Dynamic variables applied: {payload.retell_llm_dynamic_variables}", flush=True)
        
        # Knowledge Base IDs: Collect all KB IDs (priority: knowledge_base_ids > kb_id converted to retell_kb_id)
        knowledge_base_ids_list: List[str] = []
        
        # 1. If knowledge_base_ids provided directly, use them
        if payload.knowledge_base_ids:
            knowledge_base_ids_list.extend(payload.knowledge_base_ids)
            logger.info(f"[create_outbound_call] Using knowledge_base_ids from payload: {payload.knowledge_base_ids}")
        
        # 2. If kb_id provided, convert Agoralia KB ID to Retell KB ID (lazy sync)
        if payload.kb_id is not None:
            with Session(engine) as session:
                from services.kb_sync import ensure_kb_synced
                retell_kb_id = await ensure_kb_synced(payload.kb_id, session, tenant_id)
                if retell_kb_id:
                    if retell_kb_id not in knowledge_base_ids_list:
                        knowledge_base_ids_list.append(retell_kb_id)
                        logger.info(f"[create_outbound_call] Synced kb_id {payload.kb_id} to retell_kb_id: {retell_kb_id}")
                    else:
                        logger.info(f"[create_outbound_call] retell_kb_id {retell_kb_id} already in knowledge_base_ids")
                else:
                    # Fallback to old behavior: use metadata kb (for backward compatibility or if sync fails)
                    kb = session.get(KnowledgeBase, payload.kb_id)
                    if kb and not kb.retell_kb_id:
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
                            logger.warning(f"[create_outbound_call] Using legacy metadata kb (sync failed for kb_id {payload.kb_id})")
        
        # 3. Apply knowledge_base_ids to agent_override if present, or create one if needed
        if knowledge_base_ids_list:
            # If agent_override already exists, merge knowledge_base_ids into retell_llm
            if "retell_llm" not in agent_override_dict:
                agent_override_dict["retell_llm"] = {}
            # Merge knowledge_base_ids (combine with existing if any)
            existing_kb_ids = agent_override_dict["retell_llm"].get("knowledge_base_ids", [])
            combined_kb_ids = list(set(existing_kb_ids + knowledge_base_ids_list))
            agent_override_dict["retell_llm"]["knowledge_base_ids"] = combined_kb_ids
            body["agent_override"] = agent_override_dict
            logger.info(f"[create_outbound_call] Added knowledge_base_ids to agent_override.retell_llm: {combined_kb_ids}")
            print(f"[DEBUG] Added knowledge_base_ids to agent_override.retell_llm: {combined_kb_ids}", flush=True)
        
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

        logger.info(f"[create_outbound_call] body prepared: {json.dumps(body)}")
        
        # Compliance + subscription + budget gating
        # Reload lead in new session for compliance check
        logger.info("[create_outbound_call] Starting compliance checks...")
        print("[DEBUG] Starting compliance checks...", flush=True)
        error_step = "compliance_check"
        with Session(engine) as session:
            lead_for_compliance = None
            from models.campaigns import Lead
            if lead_id:
                lead_for_compliance = session.get(Lead, lead_id)
                if lead_for_compliance and tenant_id is not None and lead_for_compliance.tenant_id != tenant_id:
                    lead_for_compliance = None
            # If no lead found from lead_id, try to find by phone number (for quiet_hours_disabled check)
            if not lead_for_compliance and payload.to:
                query = session.query(Lead).filter(Lead.phone == payload.to)
                if tenant_id is not None:
                    query = query.filter(Lead.tenant_id == tenant_id)
                lead_for_compliance = query.order_by(Lead.id.desc()).first()  # Get most recent lead
            logger.info("[create_outbound_call] Enforcing subscription...")
            print("[DEBUG] Enforcing subscription...", flush=True)
            enforce_subscription_or_raise(session, request)
            logger.info("[create_outbound_call] Enforcing compliance...")
            print(f"[DEBUG] Enforcing compliance with lead={lead_for_compliance.id if lead_for_compliance else None}, quiet_hours_disabled={lead_for_compliance.quiet_hours_disabled if lead_for_compliance else None}", flush=True)
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
    
    # Knowledge Base IDs: Collect all KB IDs (priority: knowledge_base_ids > kb_id converted to retell_kb_id)
    knowledge_base_ids_list: List[str] = []
    
    # 1. If knowledge_base_ids provided directly, use them
    if payload.knowledge_base_ids:
        knowledge_base_ids_list.extend(payload.knowledge_base_ids)
    
    # 2. If kb_id provided, convert Agoralia KB ID to Retell KB ID (lazy sync)
    if payload.kb_id is not None:
        with Session(engine) as session:
            from services.kb_sync import ensure_kb_synced
            retell_kb_id = await ensure_kb_synced(payload.kb_id, session, tenant_id=None)
            if retell_kb_id:
                if retell_kb_id not in knowledge_base_ids_list:
                    knowledge_base_ids_list.append(retell_kb_id)
            else:
                # Fallback to old behavior: use metadata kb (for backward compatibility or if sync fails)
                kb = session.get(KnowledgeBase, payload.kb_id)
                if kb and not kb.retell_kb_id:
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
    
    # 3. Apply knowledge_base_ids to body (web calls use agent_override or direct retell_llm config)
    if knowledge_base_ids_list:
        # For web calls, add to agent_override.retell_llm or create one
        if "agent_override" not in body:
            body["agent_override"] = {}
        if "retell_llm" not in body["agent_override"]:
            body["agent_override"]["retell_llm"] = {}
        body["agent_override"]["retell_llm"]["knowledge_base_ids"] = knowledge_base_ids_list
    
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
    """Get call details from Retell AI
    
    According to Retell AI docs:
    - GET /v2/get-call/{call_id} retrieves call details
    """
    try:
        data = await retell_get_json(f"/v2/get-call/{urllib.parse.quote(provider_call_id)}")
        return data
    except HTTPException as e:
        # Fallback to query param format if path param doesn't work
        try:
            data = await retell_get_json(f"/v2/get-call?call_id={urllib.parse.quote(provider_call_id)}")
            return data
        except Exception:
            raise e


class ListCallsFilter(BaseModel):
    """Filter criteria for listing calls"""
    agent_id: Optional[List[str]] = None
    call_status: Optional[List[str]] = None  # registered, not_connected, ongoing, ended, error
    call_type: Optional[List[str]] = None  # phone_call, web_call
    direction: Optional[List[str]] = None  # inbound, outbound
    user_sentiment: Optional[List[str]] = None
    call_successful: Optional[List[bool]] = None
    start_timestamp: Optional[Dict[str, int]] = None  # upper_threshold, lower_threshold


class ListCallsRequest(BaseModel):
    """Request body for listing calls"""
    filter_criteria: Optional[ListCallsFilter] = None
    sort_order: Optional[str] = Field(default="descending", pattern="^(ascending|descending)$")
    limit: Optional[int] = Field(default=50, ge=1, le=1000)
    pagination_key: Optional[str] = None


@router.post("/retell/calls/list")
async def retell_list_calls(body: ListCallsRequest):
    """List calls from Retell AI
    
    According to Retell AI docs:
    - POST /v2/list-calls lists calls with filters, sorting, and pagination
    - Body contains filter_criteria, sort_order, limit, pagination_key
    """
    request_body: Dict[str, Any] = {
        "sort_order": body.sort_order or "descending",
        "limit": min(max(1, body.limit or 50), 1000),
    }
    
    if body.filter_criteria:
        filter_dict: Dict[str, Any] = {}
        if body.filter_criteria.agent_id:
            filter_dict["agent_id"] = body.filter_criteria.agent_id
        if body.filter_criteria.call_status:
            filter_dict["call_status"] = body.filter_criteria.call_status
        if body.filter_criteria.call_type:
            filter_dict["call_type"] = body.filter_criteria.call_type
        if body.filter_criteria.direction:
            filter_dict["direction"] = body.filter_criteria.direction
        if body.filter_criteria.user_sentiment:
            filter_dict["user_sentiment"] = body.filter_criteria.user_sentiment
        if body.filter_criteria.call_successful is not None:
            filter_dict["call_successful"] = body.filter_criteria.call_successful
        if body.filter_criteria.start_timestamp:
            filter_dict["start_timestamp"] = body.filter_criteria.start_timestamp
        
        if filter_dict:
            request_body["filter_criteria"] = filter_dict
    
    if body.pagination_key:
        request_body["pagination_key"] = body.pagination_key
    
    try:
        data = await retell_post_json("/v2/list-calls", request_body)
        return data
    except HTTPException as e:
        # Fallback to old GET endpoint if POST doesn't work
        try:
            # Legacy GET endpoint for backward compatibility
            qs = {"limit": request_body["limit"]}
            if body.pagination_key:
                qs["cursor"] = body.pagination_key
            query = urllib.parse.urlencode(qs)
            data = await retell_get_json(f"/v2/list-phone-calls?{query}")
            return data
        except Exception:
            raise e


@router.get("/retell/calls")
async def retell_list_calls_simple(
    limit: int = 50,
    cursor: Optional[str] = None,
    agent_id: Optional[str] = None,
    call_status: Optional[str] = None,
    call_type: Optional[str] = None,
):
    """Simple GET endpoint for listing calls (backward compatibility)
    
    Internally converts to POST /v2/list-calls format
    """
    filter_criteria = None
    if agent_id or call_status or call_type:
        filter_criteria = ListCallsFilter(
            agent_id=[agent_id] if agent_id else None,
            call_status=[call_status] if call_status else None,
            call_type=[call_type] if call_type else None,
        )
    
    body = ListCallsRequest(
        filter_criteria=filter_criteria,
        limit=limit,
        pagination_key=cursor,
    )
    return await retell_list_calls(body)


@router.patch("/retell/calls/{provider_call_id}")
async def retell_update_call(provider_call_id: str, body: Dict[str, Any]):
    """Update a call in Retell AI
    
    According to Retell AI docs:
    - PATCH /v2/update-call/{call_id} updates call metadata and data storage settings
    - Body can contain: metadata, data_storage_setting, override_dynamic_variables
    """
    try:
        # Use path parameter as per official docs
        data = await retell_patch_json(f"/v2/update-call/{urllib.parse.quote(provider_call_id)}", body)
        return {
            "success": True,
            "response": data,
        }
    except HTTPException as e:
        # Fallback to query param format if path param doesn't work
        try:
            path = f"/v2/update-call?call_id={urllib.parse.quote(provider_call_id)}"
            data = await retell_patch_json(path, body)
            return {
                "success": True,
                "response": data,
            }
        except Exception:
            raise e


@router.delete("/retell/calls/{provider_call_id}")
async def retell_delete_call(provider_call_id: str):
    """Delete a call from Retell AI
    
    According to Retell AI docs:
    - DELETE /v2/delete-call/{call_id} deletes a call record and its associated data
    - Returns 204 No Content on success
    """
    try:
        # Use path parameter as per official docs
        data = await retell_delete_json(f"/v2/delete-call/{urllib.parse.quote(provider_call_id)}")
        return {
            "success": True,
            "message": "Call deleted successfully",
            "response": data,
        }
    except HTTPException as e:
        # Fallback to query param format if path param doesn't work
        try:
            path = f"/v2/delete-call?call_id={urllib.parse.quote(provider_call_id)}"
            data = await retell_delete_json(path)
            return {
                "success": True,
                "message": "Call deleted successfully",
                "response": data,
            }
        except Exception:
            raise e


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


# ============================================================================
# Agent Creation Models
# ============================================================================

class AgentCreateRequest(BaseModel):
    """Complete agent creation request with all RetellAI fields"""
    # Response Engine (required)
    response_engine: Dict[str, Any] = Field(..., description="Response engine config (retell-llm, conversation-flow, etc.)")
    
    # Basic fields
    agent_name: Optional[str] = Field(None, description="Agent name for reference")
    voice_id: str = Field(..., description="Voice ID (e.g., '11labs-Adrian')")
    voice_model: Optional[str] = Field(None, description="Voice model (e.g., 'eleven_turbo_v2')")
    
    # Voice settings
    fallback_voice_ids: Optional[List[str]] = None
    voice_temperature: Optional[float] = Field(None, ge=0, le=2, description="Voice stability (0-2)")
    voice_speed: Optional[float] = Field(None, ge=0.5, le=2, description="Voice speed (0.5-2)")
    volume: Optional[float] = Field(None, ge=0, le=2, description="Volume (0-2)")
    
    # Agent behavior
    responsiveness: Optional[float] = Field(None, ge=0, le=1, description="Responsiveness (0-1)")
    interruption_sensitivity: Optional[float] = Field(None, ge=0, le=1, description="Interruption sensitivity (0-1)")
    enable_backchannel: Optional[bool] = None
    backchannel_frequency: Optional[float] = Field(None, ge=0, le=1)
    backchannel_words: Optional[List[str]] = None
    reminder_trigger_ms: Optional[int] = Field(None, gt=0)
    reminder_max_count: Optional[int] = Field(None, ge=0)
    
    # Ambient sound
    ambient_sound: Optional[str] = None
    ambient_sound_volume: Optional[float] = Field(None, ge=0, le=2)
    
    # Language and webhook
    language: Optional[str] = Field("en-US", description="Language code")
    webhook_url: Optional[str] = None
    webhook_timeout_ms: Optional[int] = Field(None, description="Webhook timeout in ms (1000-30000)")
    
    # Transcription and keywords
    boosted_keywords: Optional[List[str]] = None
    stt_mode: Optional[str] = Field("fast", description="Speech-to-text mode: fast or accurate")
    vocab_specialization: Optional[str] = Field("general", description="Vocabulary: general or medical")
    denoising_mode: Optional[str] = Field("noise-cancellation", description="Denoising mode")
    
    # Data storage
    data_storage_setting: Optional[str] = Field("everything", description="Data storage: everything, everything_except_pii, basic_attributes_only")
    opt_in_signed_url: Optional[bool] = None
    
    # Speech settings
    pronunciation_dictionary: Optional[List[Dict[str, Any]]] = None
    normalize_for_speech: Optional[bool] = None
    
    # Call settings
    end_call_after_silence_ms: Optional[int] = Field(600000, ge=10000, description="End call after silence (ms)")
    max_call_duration_ms: Optional[int] = Field(3600000, ge=60000, le=7200000, description="Max call duration (ms)")
    begin_message_delay_ms: Optional[int] = Field(None, ge=0, le=5000)
    ring_duration_ms: Optional[int] = Field(30000, ge=5000, le=90000)
    
    # Voicemail
    voicemail_option: Optional[Dict[str, Any]] = None
    
    # Post-call analysis
    post_call_analysis_data: Optional[List[Dict[str, Any]]] = None
    post_call_analysis_model: Optional[str] = Field("gpt-4o-mini", description="Model for post-call analysis")
    
    # DTMF
    allow_user_dtmf: Optional[bool] = Field(True, description="Allow DTMF input")
    user_dtmf_options: Optional[Dict[str, Any]] = None
    
    # PII
    pii_config: Optional[Dict[str, Any]] = None
    
    # Save to Agoralia
    save_to_agoralia: Optional[bool] = Field(True, description="Save agent to Agoralia database")
    connect_to_general_kb: Optional[bool] = Field(True, description="Connect to general knowledge base")
    
    # Additional metadata (for UI)
    role: Optional[str] = Field(None, description="Agent role: inbound, outbound, or both")
    mission: Optional[str] = Field(None, description="Agent mission/objective description")
    custom_prompt: Optional[str] = Field(None, description="Additional custom prompt instructions")


@router.post("/retell/agents")
async def retell_create_agent(
    request: Request,
    agent_name: str,
    language: Optional[str] = "en-US",
    voice_id: Optional[str] = None,
    webhook_url: Optional[str] = None,
    begin_message: Optional[str] = None,
    enable_transcription: Optional[bool] = None,
    enable_recording: Optional[bool] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    """Create a new Retell AI agent directly (legacy endpoint - use /retell/agents/create for full support)
    
    According to Retell AI docs:
    - POST /create-agent creates an agent with Retell LLM as response engine
    
    This endpoint creates an agent directly in Retell AI without creating an Agoralia agent.
    Use this when you want to manage Retell agents independently.
    
    Args:
        agent_name: Name of the agent (required)
        language: Language code (e.g., "en-US", "it-IT", default: "en-US")
        voice_id: Voice ID (e.g., "11labs-Adrian", default: uses default)
        webhook_url: Optional webhook URL for call events
        begin_message: Optional beginning message for the agent
        enable_transcription: Enable transcription (optional)
        enable_recording: Enable recording (optional)
        metadata: Optional metadata dict
    """
    from services.agents import create_retell_agent
    from utils.auth import extract_tenant_id
    
    tenant_id = extract_tenant_id(request)
    
    try:
        response = await create_retell_agent(
            name=agent_name,
            language=language or "en-US",
            voice_id=voice_id,
            webhook_url=webhook_url,
        )
        
        # Extract agent_id from response
        agent_id = (
            response.get("agent_id") or
            response.get("retell_llm_id") or
            response.get("llm_id") or
            response.get("id")
        )
        
        return {
            "success": True,
            "agent_id": agent_id,
            "response": response,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating Retell agent: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error creating agent: {str(e)}")


@router.post("/retell/agents/create")
async def retell_create_agent_full(request: Request, body: AgentCreateRequest):
    """Create a new Retell AI agent with full field support
    
    Creates an agent in RetellAI with all available configuration options.
    Optionally saves to Agoralia database and connects to general knowledge base.
    
    According to Retell AI docs:
    - POST /create-agent creates an agent with specified response engine
    """
    from utils.auth import extract_tenant_id
    from services.kb_sync import ensure_kb_synced
    from utils.retell import get_retell_base_url
    # KnowledgeBase is already imported at top of file from models.agents
    
    tenant_id = extract_tenant_id(request)
    
    try:
        # Ensure response_engine is defined
        if not body.response_engine:
            raise HTTPException(status_code=400, detail="response_engine is required")
        
        # If response_engine is retell-llm but doesn't have llm_id, create LLM first
        response_engine = body.response_engine.copy() if isinstance(body.response_engine, dict) else body.response_engine
        
        if not isinstance(response_engine, dict):
            raise HTTPException(status_code=400, detail="response_engine must be a dictionary")
        
        # Extract fields that belong to LLM (not to response_engine for agent creation)
        llm_model = response_engine.get("model", "gpt-4o-mini")
        llm_start_speaker = response_engine.get("start_speaker", "agent")
        llm_begin_message = response_engine.get("begin_message")
        llm_knowledge_base_ids = response_engine.get("knowledge_base_ids", []) or []
        
        # Connect to general knowledge base if requested (add KB IDs to LLM creation)
        if body.connect_to_general_kb and tenant_id:
            with Session(engine) as session:
                general_kb = session.query(KnowledgeBase).filter(
                    KnowledgeBase.tenant_id == tenant_id,
                    KnowledgeBase.scope == "general"
                ).first()
                
                if general_kb:
                    try:
                        retell_kb_id = await ensure_kb_synced(general_kb.id, session, tenant_id)
                        if retell_kb_id and retell_kb_id not in llm_knowledge_base_ids:
                            llm_knowledge_base_ids.append(retell_kb_id)
                            print(f"[DEBUG] [retell_create_agent_full] Added general KB to LLM: {retell_kb_id}", flush=True)
                    except Exception as e:
                        import logging
                        logging.warning(f"Failed to connect general KB to LLM: {e}")
        
        if response_engine.get("type") == "retell-llm" and not response_engine.get("llm_id"):
            # Create Retell LLM first with LLM-specific fields
            from utils.retell import retell_post_json
            
            llm_body = {
                "model": llm_model,
                "start_speaker": llm_start_speaker,
            }
            if llm_begin_message:
                llm_body["begin_message"] = llm_begin_message
            if llm_knowledge_base_ids:
                llm_body["knowledge_base_ids"] = llm_knowledge_base_ids
            
            print(f"[DEBUG] [retell_create_agent_full] Creating LLM with body: {json.dumps(llm_body, indent=2, default=str)}", flush=True)
            try:
                llm_response = await retell_post_json("/create-retell-llm", llm_body, tenant_id)
                print(f"[DEBUG] [retell_create_agent_full] LLM created successfully: {json.dumps(llm_response, indent=2, default=str)}", flush=True)
            except HTTPException as llm_he:
                if llm_he.status_code == 404:
                    # Try v2 endpoint
                    print(f"[DEBUG] [retell_create_agent_full] LLM v1 endpoint failed, trying v2", flush=True)
                    llm_response = await retell_post_json("/v2/create-retell-llm", llm_body, tenant_id)
                else:
                    raise
            
            retell_llm_id = llm_response.get("retell_llm_id") or llm_response.get("llm_id") or llm_response.get("id")
            if not retell_llm_id:
                raise HTTPException(status_code=500, detail="Failed to get retell_llm_id from response")
            
            # Save original version before cleaning
            original_version = response_engine.get("version")
            
            # Create clean response_engine per RetellAI API spec
            # response_engine should only contain: type, llm_id, and optionally version
            response_engine = {
                "type": "retell-llm",
                "llm_id": retell_llm_id,
            }
            # Add version if present in original
            if original_version is not None:
                response_engine["version"] = original_version
        else:
            # Clean response_engine - only include fields per RetellAI API spec
            # response_engine should only have: type, llm_id (or conversation_flow_id, or llm_websocket_url), and optionally version
            cleaned_response_engine = {
                "type": response_engine.get("type"),
            }
            if "llm_id" in response_engine:
                cleaned_response_engine["llm_id"] = response_engine["llm_id"]
            if "conversation_flow_id" in response_engine:
                cleaned_response_engine["conversation_flow_id"] = response_engine["conversation_flow_id"]
            if "llm_websocket_url" in response_engine:
                cleaned_response_engine["llm_websocket_url"] = response_engine["llm_websocket_url"]
            if "version" in response_engine:
                cleaned_response_engine["version"] = response_engine["version"]
            response_engine = cleaned_response_engine
        
        # Build agent body for RetellAI (per OpenAPI spec)
        agent_body: Dict[str, Any] = {
            "response_engine": response_engine,
            "voice_id": body.voice_id,
        }
        
        # Add optional fields only if provided
        if body.agent_name:
            agent_body["agent_name"] = body.agent_name
        if body.voice_model:
            agent_body["voice_model"] = body.voice_model
        if body.fallback_voice_ids:
            agent_body["fallback_voice_ids"] = body.fallback_voice_ids
        if body.voice_temperature is not None:
            agent_body["voice_temperature"] = body.voice_temperature
        if body.voice_speed is not None:
            agent_body["voice_speed"] = body.voice_speed
        if body.volume is not None:
            agent_body["volume"] = body.volume
        if body.responsiveness is not None:
            agent_body["responsiveness"] = body.responsiveness
        if body.interruption_sensitivity is not None:
            agent_body["interruption_sensitivity"] = body.interruption_sensitivity
        if body.enable_backchannel is not None:
            agent_body["enable_backchannel"] = body.enable_backchannel
        if body.backchannel_frequency is not None:
            agent_body["backchannel_frequency"] = body.backchannel_frequency
        if body.backchannel_words:
            agent_body["backchannel_words"] = body.backchannel_words
        if body.reminder_trigger_ms is not None:
            agent_body["reminder_trigger_ms"] = body.reminder_trigger_ms
        if body.reminder_max_count is not None:
            agent_body["reminder_max_count"] = body.reminder_max_count
        if body.ambient_sound:
            agent_body["ambient_sound"] = body.ambient_sound
        if body.ambient_sound_volume is not None:
            agent_body["ambient_sound_volume"] = body.ambient_sound_volume
        if body.language:
            agent_body["language"] = body.language
        if body.webhook_url:
            agent_body["webhook_url"] = body.webhook_url
        if body.webhook_timeout_ms is not None:
            agent_body["webhook_timeout_ms"] = body.webhook_timeout_ms
        if body.boosted_keywords:
            agent_body["boosted_keywords"] = body.boosted_keywords
        if body.stt_mode:
            agent_body["stt_mode"] = body.stt_mode
        if body.vocab_specialization:
            agent_body["vocab_specialization"] = body.vocab_specialization
        if body.denoising_mode:
            agent_body["denoising_mode"] = body.denoising_mode
        if body.data_storage_setting:
            agent_body["data_storage_setting"] = body.data_storage_setting
        if body.opt_in_signed_url is not None:
            agent_body["opt_in_signed_url"] = body.opt_in_signed_url
        if body.pronunciation_dictionary:
            agent_body["pronunciation_dictionary"] = body.pronunciation_dictionary
        if body.normalize_for_speech is not None:
            agent_body["normalize_for_speech"] = body.normalize_for_speech
        if body.end_call_after_silence_ms is not None:
            agent_body["end_call_after_silence_ms"] = body.end_call_after_silence_ms
        if body.max_call_duration_ms is not None:
            agent_body["max_call_duration_ms"] = body.max_call_duration_ms
        if body.begin_message_delay_ms is not None:
            agent_body["begin_message_delay_ms"] = body.begin_message_delay_ms
        if body.ring_duration_ms is not None:
            agent_body["ring_duration_ms"] = body.ring_duration_ms
        if body.voicemail_option:
            agent_body["voicemail_option"] = body.voicemail_option
        if body.post_call_analysis_data:
            agent_body["post_call_analysis_data"] = body.post_call_analysis_data
        if body.post_call_analysis_model:
            agent_body["post_call_analysis_model"] = body.post_call_analysis_model
        if body.allow_user_dtmf is not None:
            agent_body["allow_user_dtmf"] = body.allow_user_dtmf
        if body.user_dtmf_options:
            agent_body["user_dtmf_options"] = body.user_dtmf_options
        if body.pii_config:
            agent_body["pii_config"] = body.pii_config
        
        # Connect to general knowledge base if requested
        if body.connect_to_general_kb and tenant_id:
            with Session(engine) as session:
                # Find general knowledge base for tenant
                general_kb = session.query(KnowledgeBase).filter(
                    KnowledgeBase.tenant_id == tenant_id,
                    KnowledgeBase.scope == "general"
                ).first()
                
                if general_kb:
                    # Note: Knowledge bases are already handled above when creating the LLM
                    # They should be added to the LLM during creation (via llm_knowledge_base_ids),
                    # not to the agent's response_engine (which only contains type, llm_id, and optionally version per OpenAPI spec)
                    # This section is kept for backward compatibility but does nothing now
                    pass
        
        # Create agent in RetellAI
        # According to RetellAI docs: POST /create-agent
        # Note: LLM creation uses /create-retell-llm (no /v2 prefix), so trying that pattern first
        print(f"[DEBUG] [retell_create_agent_full] Creating agent with body: {json.dumps(agent_body, indent=2, default=str)}", flush=True)
        print(f"[DEBUG] [retell_create_agent_full] RetellAI base URL: {get_retell_base_url()}", flush=True)
        
        # Try different endpoint patterns
        # Note: LLM uses /create-retell-llm, so agent might use different pattern
        response = None
        endpoints_to_try = [
            "/create-agent",  # Per OpenAPI spec
            "/agent/create",  # Alternative REST pattern
            "/v2/create-agent",  # Versioned endpoint
            "/v2/agent/create",  # Versioned alternative pattern
        ]
        
        for endpoint in endpoints_to_try:
            full_url = f"{get_retell_base_url()}{endpoint}"
            print(f"[DEBUG] [retell_create_agent_full] Trying endpoint: {full_url}", flush=True)
            try:
                response = await retell_post_json(endpoint, agent_body, tenant_id)
                print(f"[DEBUG] [retell_create_agent_full] ✅ Success with {endpoint}: {json.dumps(response, indent=2, default=str)}", flush=True)
                break  # Success, exit loop
            except HTTPException as he:
                print(f"[DEBUG] [retell_create_agent_full] ❌ {endpoint} returned {he.status_code}: {he.detail}", flush=True)
                if he.status_code == 404 and endpoint != endpoints_to_try[-1]:
                    # Try next endpoint if 404 and not last
                    continue
                elif he.status_code != 404:
                    # Non-404 error, raise immediately
                    raise
                else:
                    # Last endpoint failed with 404, raise
                    raise HTTPException(
                        status_code=404, 
                        detail=f"Agent creation failed: All endpoints ({', '.join(endpoints_to_try)}) returned 404. Check RetellAI API documentation and API key permissions."
                    )
        
        if not response:
            raise HTTPException(status_code=500, detail="Failed to create agent: No response from RetellAI")
        
        agent_id = response.get("agent_id")
        
        if not agent_id:
            raise HTTPException(status_code=500, detail="No agent_id in RetellAI response")
        
        # Save to Agoralia if requested
        agoralia_agent_id = None
        if body.save_to_agoralia and tenant_id:
            with Session(engine) as session:
                from models.agents import Agent
                from services.agents import check_agent_limit
                from services.enforcement import enforce_subscription_or_raise
                
                enforce_subscription_or_raise(session, request)
                check_agent_limit(session, tenant_id)
                
                # Extract KB IDs from response_engine if present
                kb_ids = []
                if "response_engine" in agent_body and isinstance(agent_body["response_engine"], dict):
                    kb_ids = agent_body["response_engine"].get("knowledge_base_ids", [])
                
                # Extract begin_message and start_speaker from response_engine
                begin_msg = None
                start_spkr = None
                if "response_engine" in agent_body and isinstance(agent_body["response_engine"], dict):
                    begin_msg = agent_body["response_engine"].get("begin_message")
                    start_spkr = agent_body["response_engine"].get("start_speaker")
                
                # Extract role, mission, custom_prompt from body (if present in AgentCreateRequest)
                # These are not in AgentCreateRequest yet, but we'll add them
                role = getattr(body, 'role', None)
                mission = getattr(body, 'mission', None)
                custom_prompt = getattr(body, 'custom_prompt', None)
                
                agoralia_agent = Agent(
                    name=body.agent_name or f"Agent {agent_id[:8]}",
                    lang=body.language or "en-US",
                    voice_id=body.voice_id,
                    tenant_id=tenant_id,
                    retell_agent_id=agent_id,
                    # Response Engine
                    response_engine=agent_body.get("response_engine"),
                    begin_message=begin_msg,
                    start_speaker=start_spkr or "agent",
                    begin_message_delay_ms=body.begin_message_delay_ms,
                    # Voice Settings
                    voice_model=body.voice_model,
                    fallback_voice_ids=body.fallback_voice_ids,
                    voice_temperature=body.voice_temperature,
                    voice_speed=body.voice_speed,
                    volume=body.volume,
                    # Agent Behavior
                    responsiveness=body.responsiveness,
                    interruption_sensitivity=body.interruption_sensitivity,
                    enable_backchannel=body.enable_backchannel,
                    backchannel_frequency=body.backchannel_frequency,
                    backchannel_words=body.backchannel_words,
                    reminder_trigger_ms=body.reminder_trigger_ms,
                    reminder_max_count=body.reminder_max_count,
                    # Ambient Sound
                    ambient_sound=body.ambient_sound,
                    ambient_sound_volume=body.ambient_sound_volume,
                    # Language & Webhook
                    webhook_url=body.webhook_url,
                    webhook_timeout_ms=body.webhook_timeout_ms,
                    # Transcription & Keywords
                    boosted_keywords=body.boosted_keywords,
                    stt_mode=body.stt_mode,
                    vocab_specialization=body.vocab_specialization,
                    denoising_mode=body.denoising_mode,
                    # Data Storage
                    data_storage_setting=body.data_storage_setting,
                    opt_in_signed_url=body.opt_in_signed_url,
                    # Speech Settings
                    pronunciation_dictionary=body.pronunciation_dictionary,
                    normalize_for_speech=body.normalize_for_speech,
                    # Call Settings
                    end_call_after_silence_ms=body.end_call_after_silence_ms,
                    max_call_duration_ms=body.max_call_duration_ms,
                    ring_duration_ms=body.ring_duration_ms,
                    # Voicemail
                    voicemail_option=body.voicemail_option,
                    # Post-Call Analysis
                    post_call_analysis_data=body.post_call_analysis_data,
                    post_call_analysis_model=body.post_call_analysis_model,
                    # DTMF
                    allow_user_dtmf=body.allow_user_dtmf,
                    user_dtmf_options=body.user_dtmf_options,
                    # PII
                    pii_config=body.pii_config,
                    # Knowledge Base
                    knowledge_base_ids=kb_ids if kb_ids else None,
                    # Additional metadata
                    role=role,
                    mission=mission,
                    custom_prompt=custom_prompt,
                )
                session.add(agoralia_agent)
                session.commit()
                session.refresh(agoralia_agent)
                agoralia_agent_id = agoralia_agent.id
        
        return {
            "success": True,
            "agent_id": agent_id,
            "agoralia_agent_id": agoralia_agent_id,
            "response": response,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating Retell agent: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error creating agent: {str(e)}")


class AgentTestCallRequest(BaseModel):
    """Request body for testing an agent with a call"""
    to_number: str = Field(..., description="Phone number to call (E.164 format)")
    from_number: Optional[str] = Field(None, description="Caller ID (optional, uses default if not provided)")


@router.post("/retell/agents/{agent_id}/test-call")
async def retell_test_agent_call(
    request: Request,
    agent_id: str,
    body: AgentTestCallRequest,
):
    """Make a test call to an agent
    
    Creates an outbound call using the specified agent for testing purposes.
    Uses the default from_number if not provided.
    """
    from utils.auth import extract_tenant_id
    from utils.helpers import _resolve_from_number
    
    tenant_id = extract_tenant_id(request)
    
    try:
        # Resolve from_number
        with Session(engine) as session:
            from_num = _resolve_from_number(
                session,
                from_number=body.from_number,
                campaign_id=None,
                lead_id=None,
                tenant_id=tenant_id,
            )
            if not from_num:
                raise HTTPException(
                    status_code=400,
                    detail="from_number mancante: imposta DEFAULT_FROM_NUMBER nelle settings/env o passa un Caller ID valido"
                )
        
        # Build call request
        call_body = {
            "from_number": from_num,
            "to_number": body.to_number,
            "override_agent_id": agent_id,
        }
        
        # Create call via RetellAI
        response = await retell_post_json("/v2/create-phone-call", call_body)
        
        return {
            "success": True,
            "call_id": response.get("call_id"),
            "response": response,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error making test call: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error making test call: {str(e)}")


@router.patch("/retell/agents/{agent_id}")
async def retell_update_agent(
    request: Request,
    agent_id: str,
    agent_name: Optional[str] = None,
    language: Optional[str] = None,
    voice_id: Optional[str] = None,
    webhook_url: Optional[str] = None,
):
    """Update a Retell AI agent directly
    
    According to Retell AI docs:
    - PATCH /update-agent/{agent_id} updates an agent
    
    This endpoint updates an agent directly in Retell AI without updating Agoralia agents.
    
    Args:
        agent_id: Retell agent ID (required)
        agent_name: New name (optional)
        language: New language code (optional)
        voice_id: New voice ID (optional)
        webhook_url: New webhook URL (optional)
    """
    from services.agents import update_retell_agent
    from utils.auth import extract_tenant_id
    
    tenant_id = extract_tenant_id(request)
    
    try:
        response = await update_retell_agent(
            retell_agent_id=agent_id,
            name=agent_name,
            language=language,
            voice_id=voice_id,
            webhook_url=webhook_url,
        )
        
        return {
            "success": True,
            "agent_id": agent_id,
            "response": response,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error updating Retell agent: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error updating agent: {str(e)}")


@router.delete("/retell/agents/{agent_id}")
async def retell_delete_agent(
    request: Request,
    agent_id: str,
):
    """Delete a Retell AI agent directly
    
    According to Retell AI docs:
    - DELETE /delete-agent/{agent_id} deletes an agent
    
    This endpoint deletes an agent directly from Retell AI without deleting Agoralia agents.
    Use with caution: this action cannot be undone.
    
    Args:
        agent_id: Retell agent ID (required)
    """
    from services.agents import delete_retell_agent
    from utils.auth import extract_tenant_id
    
    tenant_id = extract_tenant_id(request)
    
    try:
        await delete_retell_agent(retell_agent_id=agent_id)
        
        return {
            "success": True,
            "agent_id": agent_id,
            "message": "Agent deleted successfully",
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error deleting Retell agent: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error deleting agent: {str(e)}")


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


@router.get("/retell/phone-numbers/{phone_number}")
async def get_retell_phone_number(phone_number: str):
    """Get phone number details from Retell AI
    
    According to Retell AI docs:
    - GET /get-phone-number/{phone_number} retrieves phone number details
    
    For custom telephony numbers, also provides SIP inbound URI for configuring forwarding.
    """
    try:
        # Use path parameter as per official docs
        data = await retell_get_json(f"/get-phone-number/{urllib.parse.quote(phone_number)}")
        
        # For custom telephony numbers, add SIP inbound URI if not present
        if data.get("phone_number_type") == "custom":
            if "sip_inbound_uri" not in data:
                # Default format: sip:{phone_number}@sip.retellai.com
                # Note: Check RetellAI dashboard for actual URI, as it may vary
                data["sip_inbound_uri"] = f"sip:{phone_number}@sip.retellai.com"
        
        return data
    except HTTPException as e:
        # Fallback to query param format if path param doesn't work
        try:
            data = await retell_get_json(f"/get-phone-number?phone_number={urllib.parse.quote(phone_number)}")
            
            # For custom telephony numbers, add SIP inbound URI if not present
            if data.get("phone_number_type") == "custom":
                if "sip_inbound_uri" not in data:
                    data["sip_inbound_uri"] = f"sip:{phone_number}@sip.retellai.com"
            
            return data
        except Exception:
            raise e


@router.get("/retell/phone-numbers")
async def list_retell_phone_numbers():
    """List all phone numbers from Retell AI
    
    According to Retell AI docs:
    - GET /list-phone-numbers lists all phone numbers
    """
    try:
        data = await retell_get_json("/list-phone-numbers")
        return data
    except HTTPException as e:
        # Try v2 endpoint if available
        try:
            data = await retell_get_json("/v2/list-phone-numbers")
            return data
        except Exception:
            raise e


@router.patch("/retell/phone-numbers/{phone_number}")
async def update_retell_phone_number(
    phone_number: str,
    inbound_agent_id: Optional[str] = None,
    outbound_agent_id: Optional[str] = None,
    inbound_agent_version: Optional[int] = None,
    outbound_agent_version: Optional[int] = None,
    nickname: Optional[str] = None,
    inbound_webhook_url: Optional[str] = None,
):
    """Update phone number configuration in Retell AI (bind agents)
    
    According to Retell AI docs:
    - PATCH /update-phone-number/{phone_number} updates phone number
    
    Args:
        phone_number: E.164 format number (e.g., +14158735112)
        inbound_agent_id: Agent ID for inbound calls (null to disable inbound)
        outbound_agent_id: Agent ID for outbound calls (null to disable outbound)
        inbound_agent_version: Version of inbound agent
        outbound_agent_version: Version of outbound agent
        nickname: Optional nickname
        inbound_webhook_url: Optional webhook URL for inbound calls
    """
    try:
        # Use path parameter as per official docs
        body: Dict[str, Any] = {}
        
        if inbound_agent_id is not None:
            body["inbound_agent_id"] = inbound_agent_id
        if outbound_agent_id is not None:
            body["outbound_agent_id"] = outbound_agent_id
        if inbound_agent_version is not None:
            body["inbound_agent_version"] = inbound_agent_version
        if outbound_agent_version is not None:
            body["outbound_agent_version"] = outbound_agent_version
        if nickname is not None:
            body["nickname"] = nickname
        if inbound_webhook_url is not None:
            body["inbound_webhook_url"] = inbound_webhook_url
        
        data = await retell_patch_json(f"/update-phone-number/{urllib.parse.quote(phone_number)}", body)
        return {
            "success": True,
            "response": data,
        }
    except HTTPException as e:
        # Fallback to query param format if path param doesn't work
        try:
            body = {"phone_number": phone_number}
            if inbound_agent_id is not None:
                body["inbound_agent_id"] = inbound_agent_id
            if outbound_agent_id is not None:
                body["outbound_agent_id"] = outbound_agent_id
            if inbound_agent_version is not None:
                body["inbound_agent_version"] = inbound_agent_version
            if outbound_agent_version is not None:
                body["outbound_agent_version"] = outbound_agent_version
            if nickname is not None:
                body["nickname"] = nickname
            if inbound_webhook_url is not None:
                body["inbound_webhook_url"] = inbound_webhook_url
            
            data = await retell_patch_json("/update-phone-number", body)
            return {
                "success": True,
                "response": data,
            }
        except Exception:
            raise e


@router.delete("/retell/phone-numbers/{phone_number}")
async def delete_retell_phone_number(phone_number: str):
    """Delete a phone number from Retell AI
    
    According to Retell AI docs:
    - DELETE /delete-phone-number/{phone_number} deletes a phone number
    - Returns 204 No Content on success
    """
    try:
        # Use path parameter as per official docs
        data = await retell_delete_json(f"/delete-phone-number/{urllib.parse.quote(phone_number)}")
        return {
            "success": True,
            "message": "Phone number deleted successfully",
            "response": data,
        }
    except HTTPException as e:
        # Fallback to query param format if path param doesn't work
        try:
            path = f"/delete-phone-number?phone_number={urllib.parse.quote(phone_number)}"
            data = await retell_delete_json(path)
            return {
                "success": True,
                "message": "Phone number deleted successfully",
                "response": data,
            }
        except Exception:
            raise e


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
# Retell Knowledge Base Endpoints
# ============================================================================

class KnowledgeBaseCreate(BaseModel):
    """Request body for creating a knowledge base"""
    knowledge_base_name: str = Field(..., max_length=40, description="Name of the KB (max 40 chars)")
    knowledge_base_texts: Optional[List[Dict[str, str]]] = Field(None, description="Array of {text, title} objects")
    knowledge_base_urls: Optional[List[str]] = Field(None, description="Array of URLs to scrape")
    enable_auto_refresh: Optional[bool] = Field(None, description="Enable auto-refresh for URLs every 12h")


class KnowledgeBaseSourcesAdd(BaseModel):
    """Request body for adding sources to a knowledge base"""
    knowledge_base_texts: Optional[List[Dict[str, str]]] = Field(None, description="Array of {text, title} objects")
    knowledge_base_urls: Optional[List[str]] = Field(None, description="Array of URLs to scrape")


@router.post("/retell/knowledge-bases")
async def retell_create_knowledge_base(
    request: Request,
    body: KnowledgeBaseCreate,
):
    """Create a new knowledge base in Retell AI
    
    According to Retell AI docs:
    - POST /create-knowledge-base creates a KB with texts, URLs, or files
    - Returns knowledge_base_id and status
    
    Args:
        knowledge_base_name: Name of the KB (required, max 40 chars)
        knowledge_base_texts: Array of {text, title} objects (optional)
        knowledge_base_urls: Array of URLs to scrape (optional)
        enable_auto_refresh: Enable auto-refresh for URLs every 12h (optional)
    
    Note: File uploads (knowledge_base_files) not yet supported via this endpoint.
    Use multipart/form-data directly if files are needed.
    """
    tenant_id = extract_tenant_id(request)
    
    # Prepare form data for Retell API (multipart/form-data)
    form_data: Dict[str, Any] = {
        "knowledge_base_name": body.knowledge_base_name,
    }
    
    # Add texts if provided
    if body.knowledge_base_texts:
        # For multipart, we need to send as JSON string array
        form_data["knowledge_base_texts"] = json.dumps(body.knowledge_base_texts)
    
    # Add URLs if provided
    if body.knowledge_base_urls:
        # Convert to JSON string for consistency with Retell API format
        form_data["knowledge_base_urls"] = json.dumps(body.knowledge_base_urls)
    
    # Add auto-refresh if provided
    if body.enable_auto_refresh is not None:
        form_data["enable_auto_refresh"] = "true" if body.enable_auto_refresh else "false"
    
    try:
        # Log form data for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[retell_create_kb] Form data: {form_data}")
        print(f"[DEBUG] [retell_create_kb] Form data: {form_data}", flush=True)
        
        # Use multipart helper even without files
        data = await retell_post_multipart(
            "/create-knowledge-base",
            data=form_data,
            tenant_id=tenant_id
        )
        
        logger.info(f"[retell_create_kb] Retell response: {data}")
        print(f"[DEBUG] [retell_create_kb] Retell response: {data}", flush=True)
        
        # Extract KB ID
        kb_id = data.get("knowledge_base_id")
        
        return {
            "success": True,
            "knowledge_base_id": kb_id,
            "response": data,
        }
    except HTTPException as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[retell_create_kb] HTTPException: {e.status_code} - {e.detail}")
        print(f"[DEBUG] [retell_create_kb] HTTPException: {e.status_code} - {e.detail}", flush=True)
        # Propagate the original error from Retell API
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        error_msg = str(e)
        error_traceback = traceback.format_exc()
        logger.error(f"[retell_create_kb] Exception: {error_msg}\n{error_traceback}")
        print(f"[DEBUG] [retell_create_kb] Exception: {error_msg}", flush=True)
        print(f"[DEBUG] Traceback:\n{error_traceback}", flush=True)
        # Return more detailed error for debugging
        error_detail = f"Error creating knowledge base: {error_msg}"
        try:
            # Try to extract Retell error message if available
            if "retell" in error_msg.lower() or "knowledge_base" in error_msg.lower():
                error_detail = error_msg
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=error_detail)


@router.get("/retell/knowledge-bases/{kb_id}")
async def retell_get_knowledge_base(request: Request, kb_id: str):
    """Get knowledge base details from Retell AI
    
    According to Retell AI docs:
    - GET /get-knowledge-base/{kb_id} retrieves KB details
    - Returns KB info including status and sources
    """
    tenant_id = extract_tenant_id(request)
    
    try:
        data = await retell_get_json(f"/get-knowledge-base/{urllib.parse.quote(kb_id)}")
        return {
            "success": True,
            "response": data,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting Retell KB: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error getting knowledge base: {str(e)}")


@router.get("/retell/knowledge-bases")
async def retell_list_knowledge_bases(request: Request):
    """List all knowledge bases from Retell AI
    
    According to Retell AI docs:
    - GET /list-knowledge-bases returns all KBs
    - Returns array of KB objects
    """
    tenant_id = extract_tenant_id(request)
    
    try:
        data = await retell_get_json("/list-knowledge-bases")
        # Ensure we return an array
        if isinstance(data, list):
            return data
        return data.get("knowledge_bases", []) if isinstance(data, dict) else []
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error listing Retell KBs: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error listing knowledge bases: {str(e)}")


@router.delete("/retell/knowledge-bases/{kb_id}")
async def retell_delete_knowledge_base(request: Request, kb_id: str):
    """Delete a knowledge base from Retell AI
    
    According to Retell AI docs:
    - DELETE /delete-knowledge-base/{kb_id} deletes a KB
    - Returns 204 No Content on success
    """
    tenant_id = extract_tenant_id(request)
    
    try:
        data = await retell_delete_json(f"/delete-knowledge-base/{urllib.parse.quote(kb_id)}")
        return {
            "success": True,
            "message": "Knowledge base deleted successfully",
            "response": data,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error deleting Retell KB: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error deleting knowledge base: {str(e)}")


@router.post("/retell/knowledge-bases/{kb_id}/sources")
async def retell_add_knowledge_base_sources(
    request: Request,
    kb_id: str,
    body: KnowledgeBaseSourcesAdd,
):
    """Add sources to a knowledge base in Retell AI
    
    According to Retell AI docs:
    - POST /add-knowledge-base-sources/{kb_id} adds texts, URLs, or files
    - Returns updated KB info
    
    Args:
        kb_id: Retell KB ID (required)
        knowledge_base_texts: Array of {text, title} objects (optional)
        knowledge_base_urls: Array of URLs to scrape (optional)
    
    Note: File uploads not yet supported via this endpoint.
    """
    tenant_id = extract_tenant_id(request)
    
    # Prepare form data for Retell API (multipart/form-data)
    form_data: Dict[str, Any] = {}
    
    # Add texts if provided
    if body.knowledge_base_texts:
        form_data["knowledge_base_texts"] = json.dumps(body.knowledge_base_texts)
    
    # Add URLs if provided
    if body.knowledge_base_urls:
        # Convert to JSON string for consistency with Retell API format
        form_data["knowledge_base_urls"] = json.dumps(body.knowledge_base_urls)
    
    if not form_data:
        raise HTTPException(status_code=400, detail="At least one source (texts or URLs) must be provided")
    
    try:
        data = await retell_post_multipart(
            f"/add-knowledge-base-sources/{urllib.parse.quote(kb_id)}",
            data=form_data,
            tenant_id=tenant_id
        )
        
        return {
            "success": True,
            "knowledge_base_id": kb_id,
            "response": data,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error adding sources to Retell KB: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error adding sources: {str(e)}")


@router.delete("/retell/knowledge-bases/{kb_id}/sources/{source_id}")
async def retell_delete_knowledge_base_source(request: Request, kb_id: str, source_id: str):
    """Delete a source from a knowledge base in Retell AI
    
    According to Retell AI docs:
    - DELETE /delete-knowledge-base-source/{kb_id}/source/{source_id} deletes a source
    - Returns updated KB info
    """
    tenant_id = extract_tenant_id(request)
    
    try:
        data = await retell_delete_json(
            f"/delete-knowledge-base-source/{urllib.parse.quote(kb_id)}/source/{urllib.parse.quote(source_id)}"
        )
        return {
            "success": True,
            "message": "Source deleted successfully",
            "knowledge_base_id": kb_id,
            "source_id": source_id,
            "response": data,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error deleting source from Retell KB: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error deleting source: {str(e)}")


# ============================================================================
# Batch Calls API
# ============================================================================

class BatchCallTask(BaseModel):
    """A single call task in a batch call"""
    to_number: str = Field(..., description="E.164 destination number")
    dynamic_variables: Optional[Dict[str, str]] = Field(None, description="Dynamic variables for personalization")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Call metadata")


class BatchCallCreate(BaseModel):
    """Request body for creating a batch call"""
    from_number: str = Field(..., description="E.164 caller ID (must be owned by Retell)")
    tasks: List[BatchCallTask] = Field(..., min_items=1, description="List of call tasks")
    name: Optional[str] = Field(None, description="Batch call name (for reference)")
    trigger_timestamp: Optional[int] = Field(None, description="Unix timestamp in milliseconds (scheduled time)")


@router.post("/retell/batch")
async def retell_create_batch_call(request: Request, body: BatchCallCreate):
    """Create a batch call in Retell AI
    
    According to Retell AI docs:
    - POST /create-batch-call creates a batch of calls
    - Returns batch_call_id, name, from_number, scheduled_timestamp, total_task_count
    
    Args:
        from_number: E.164 format number (must be owned by Retell)
        tasks: List of call tasks (each with to_number and optional dynamic_variables/metadata)
        name: Optional batch call name (for reference)
        trigger_timestamp: Optional Unix timestamp in milliseconds (scheduled time, defaults to now)
    
    Returns:
        batch_call_id, name, from_number, scheduled_timestamp, total_task_count
    """
    tenant_id = extract_tenant_id(request)
    
    # Prepare body for Retell API
    retell_body: Dict[str, Any] = {
        "from_number": body.from_number,
        "tasks": [
            {
                "to_number": task.to_number,
                **({"dynamic_variables": task.dynamic_variables} if task.dynamic_variables else {}),
                **({"metadata": task.metadata} if task.metadata else {}),
            }
            for task in body.tasks
        ]
    }
    
    if body.name:
        retell_body["name"] = body.name
    
    if body.trigger_timestamp is not None:
        retell_body["trigger_timestamp"] = body.trigger_timestamp
    
    try:
        data = await retell_post_json("/create-batch-call", retell_body, tenant_id=tenant_id)
        return {
            "success": True,
            "batch_call_id": data.get("batch_call_id"),
            "name": data.get("name"),
            "from_number": data.get("from_number"),
            "scheduled_timestamp": data.get("scheduled_timestamp"),
            "total_task_count": data.get("total_task_count"),
            "response": data,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating batch call: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error creating batch call: {str(e)}")


# ============================================================================
# Voice Management
# ============================================================================

@router.get("/retell/voices")
async def retell_list_voices(request: Request):
    """List all voices available in Retell AI
    
    According to Retell AI docs:
    - GET /list-voices returns all available voices
    - Returns array of voice objects with voice_id, voice_name, provider, gender, accent, age, preview_audio_url
    
    Use Case: UI for voice selection, filters by language/gender/provider
    """
    tenant_id = extract_tenant_id(request)
    
    try:
        data = await retell_get_json("/list-voices", tenant_id=tenant_id)
        # Ensure we return an array
        if isinstance(data, list):
            return data
        return data.get("voices", []) if isinstance(data, dict) else []
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error listing voices: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error listing voices: {str(e)}")


@router.get("/retell/voices/{voice_id}")
async def retell_get_voice(request: Request, voice_id: str):
    """Get details of a specific voice
    
    According to Retell AI docs:
    - GET /get-voice/{voice_id} returns voice details
    - Returns voice object with voice_id, voice_name, provider, gender, accent, age, preview_audio_url
    
    Args:
        voice_id: Unique voice ID (e.g., "11labs-Adrian")
    
    Use Case: UI for voice selection, preview audio
    """
    tenant_id = extract_tenant_id(request)
    
    try:
        data = await retell_get_json(f"/get-voice/{urllib.parse.quote(voice_id)}", tenant_id=tenant_id)
        return {
            "success": True,
            "response": data,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting voice: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error getting voice: {str(e)}")


# ============================================================================
# Custom Telephony
# ============================================================================

class RegisterPhoneCallRequest(BaseModel):
    """Request body for registering a phone call (Custom Telephony)"""
    agent_id: str = Field(..., description="Retell agent ID")
    from_number: Optional[str] = Field(None, description="E.164 caller number (optional)")
    to_number: Optional[str] = Field(None, description="E.164 destination number (optional)")
    direction: Optional[str] = Field(None, description="Call direction: inbound or outbound (optional)")


@router.post("/retell/custom-telephony/register")
async def retell_register_phone_call(request: Request, body: RegisterPhoneCallRequest):
    """Register a phone call for Custom Telephony (Dial to SIP URI)
    
    According to Retell AI docs:
    - POST /register-phone-call registers a call and returns call_id
    - Use call_id to construct SIP URI: sip:{call_id}@sip.retellai.com
    - Use this SIP URI in your telephony provider (Twilio/Telnyx/etc.) to dial the call
    
    Args:
        agent_id: Retell agent ID (required)
        from_number: E.164 caller number (optional)
        to_number: E.164 destination number (optional)
        direction: Call direction: "inbound" or "outbound" (optional)
    
    Returns:
        call_id: Use this to construct SIP URI (sip:{call_id}@sip.retellai.com)
    
    Use Case: Custom Telephony integration (Twilio/Telnyx/etc.) for international calls
    """
    tenant_id = extract_tenant_id(request)
    
    retell_body: Dict[str, Any] = {
        "agent_id": body.agent_id,
    }
    
    if body.from_number:
        retell_body["from_number"] = body.from_number
    
    if body.to_number:
        retell_body["to_number"] = body.to_number
    
    if body.direction:
        retell_body["direction"] = body.direction
    
    try:
        # Try /v2/register-phone-call first (v2 endpoint)
        try:
            data = await retell_post_json("/v2/register-phone-call", retell_body, tenant_id=tenant_id)
        except HTTPException as e:
            if e.status_code == 404:
                # Fallback to /register-phone-call (without v2)
                data = await retell_post_json("/register-phone-call", retell_body, tenant_id=tenant_id)
            else:
                raise e
        
        call_id = data.get("call_id") or data.get("id")
        sip_uri = f"sip:{call_id}@sip.retellai.com" if call_id else None
        
        return {
            "success": True,
            "call_id": call_id,
            "sip_uri": sip_uri,
            "response": data,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error registering phone call: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error registering phone call: {str(e)}")


class ImportPhoneNumberRequest(BaseModel):
    """Request body for importing a phone number via SIP Trunking (Custom Telephony)
    
    Matches RetellAI UI form fields for connecting numbers via SIP trunking.
    """
    phone_number: str = Field(..., description="E.164 format number to import (e.g., +390289744903)")
    termination_uri: str = Field(..., description="Termination URI (NOT Retell SIP server URI) - where calls should be routed")
    sip_trunk_user_name: Optional[str] = Field(None, description="SIP Trunk User Name (optional)")
    sip_trunk_password: Optional[str] = Field(None, description="SIP Trunk Password (optional)")
    nickname: Optional[str] = Field(None, description="Nickname for the number (optional, for reference only)")
    inbound_agent_id: Optional[str] = Field(None, description="Retell agent ID for inbound calls")
    outbound_agent_id: Optional[str] = Field(None, description="Retell agent ID for outbound calls")
    inbound_agent_version: Optional[int] = Field(None, description="Version of inbound agent")
    outbound_agent_version: Optional[int] = Field(None, description="Version of outbound agent")
    inbound_webhook_url: Optional[str] = Field(None, description="Webhook URL for inbound calls")
    # Legacy fields (kept for backward compatibility)
    provider: Optional[str] = Field(None, description="Provider name: twilio, telnyx, vonage, etc. (deprecated, use termination_uri instead)")
    provider_account_id: Optional[str] = Field(None, description="Provider account ID (deprecated)")
    sip_uri: Optional[str] = Field(None, description="SIP URI (deprecated, use termination_uri instead)")


@router.post("/retell/phone-numbers/import")
async def retell_import_phone_number(request: Request, body: ImportPhoneNumberRequest):
    """Import a phone number from Custom Telephony provider to Retell
    
    According to Retell AI docs:
    - POST /import-phone-number imports a number from Twilio/Telnyx/etc.
    - Requires Elastic SIP Trunking setup with your provider
    - Returns imported number details
    
    Args:
        phone_number: E.164 format number to import (required)
        provider: Provider name (optional, e.g., "twilio", "telnyx", "vonage")
        provider_account_id: Provider account ID (optional, if needed)
        sip_uri: SIP URI for the number (optional, if needed)
        inbound_agent_id: Retell agent ID for inbound calls (optional)
    
    Returns:
        Imported number details
    
    Use Case: Import existing numbers from Twilio/Telnyx for international calls
    Note: Requires Elastic SIP Trunking setup. See Retell Custom Telephony docs.
    """
    tenant_id = extract_tenant_id(request)
    
    # Build request body for RetellAI import-phone-number API
    retell_body: Dict[str, Any] = {
        "phone_number": body.phone_number,
        "termination_uri": body.termination_uri,
    }
    
    # Optional SIP trunking fields
    if body.sip_trunk_user_name:
        retell_body["sip_trunk_user_name"] = body.sip_trunk_user_name
    
    if body.sip_trunk_password:
        retell_body["sip_trunk_password"] = body.sip_trunk_password
    
    # Optional agent binding
    if body.inbound_agent_id:
        retell_body["inbound_agent_id"] = body.inbound_agent_id
    
    if body.outbound_agent_id:
        retell_body["outbound_agent_id"] = body.outbound_agent_id
    
    if body.inbound_agent_version is not None:
        retell_body["inbound_agent_version"] = body.inbound_agent_version
    
    if body.outbound_agent_version is not None:
        retell_body["outbound_agent_version"] = body.outbound_agent_version
    
    if body.nickname:
        retell_body["nickname"] = body.nickname
    
    if body.inbound_webhook_url:
        retell_body["inbound_webhook_url"] = body.inbound_webhook_url
    
    # Legacy fields (for backward compatibility)
    if body.provider:
        retell_body["provider"] = body.provider
    
    if body.provider_account_id:
        retell_body["provider_account_id"] = body.provider_account_id
    
    if body.sip_uri:
        retell_body["sip_uri"] = body.sip_uri
    
    try:
        data = await retell_post_json("/import-phone-number", retell_body, tenant_id=tenant_id)
        
        # Save phone number to our database (same logic as purchase)
        imported_number = data.get("phone_number") or body.phone_number
        if imported_number:
            with Session(engine) as session:
                from models.agents import PhoneNumber
                from utils.helpers import country_iso_from_e164
                
                # Check if number already exists
                existing = session.query(PhoneNumber).filter(
                    PhoneNumber.e164 == imported_number
                ).first()
                
                if not existing:
                    new_number = PhoneNumber(
                        e164=imported_number,
                        type="retell",
                        verified=1,
                        tenant_id=tenant_id,
                        country=country_iso_from_e164(imported_number),
                    )
                    session.add(new_number)
                    session.commit()
                elif existing.tenant_id != tenant_id:
                    # Update tenant_id if different (number already exists but for different tenant)
                    existing.tenant_id = tenant_id
                    session.commit()
        
        # Extract SIP inbound URI if available (for configuring Zadarma forwarding)
        # RetellAI format for custom telephony: sip:{phone_number}@sip.retellai.com
        sip_inbound_uri = None
        if "sip_inbound_uri" in data:
            sip_inbound_uri = data["sip_inbound_uri"]
        elif "sip_inbound_trunk_config" in data:
            inbound_config = data["sip_inbound_trunk_config"]
            if "sip_uri" in inbound_config:
                sip_inbound_uri = inbound_config["sip_uri"]
        else:
            # Default format for custom telephony numbers: sip:{phone_number}@sip.retellai.com
            # Note: Check RetellAI dashboard for actual URI, as it may vary
            sip_inbound_uri = f"sip:{imported_number}@sip.retellai.com"
        
        return {
            "success": True,
            "phone_number": imported_number,
            "phone_number_type": data.get("phone_number_type", "custom"),
            "sip_inbound_uri": sip_inbound_uri,  # For configuring Zadarma inbound forwarding
            "response": data,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error importing phone number: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error importing phone number: {str(e)}")


class TestPhoneNumberSetupRequest(BaseModel):
    """Request body for testing phone number setup and making a test call"""
    phone_number: Optional[str] = Field(None, description="E.164 format number to import (if importing)")
    termination_uri: Optional[str] = Field(None, description="Termination URI for imported number (required if importing)")
    sip_trunk_user_name: Optional[str] = Field(None, description="SIP Trunk User Name (optional)")
    sip_trunk_password: Optional[str] = Field(None, description="SIP Trunk Password (optional)")
    purchase_phone: Optional[bool] = Field(False, description="Purchase a new number via Retell instead of importing")
    number_provider: str = Field("twilio", description="Provider for purchase: twilio or telnyx")
    test_call_to: str = Field(..., description="E.164 format number to call for test (e.g., +393408994869)")
    agent_id: Optional[str] = Field(None, description="Retell agent ID for calls")
    nickname: Optional[str] = Field(None, description="Nickname for the number")


@router.post("/retell/phone-numbers/test-setup")
async def test_phone_number_setup(request: Request, body: TestPhoneNumberSetupRequest):
    """Test phone number setup: import/create number and make a test call
    
    This endpoint helps test the complete flow:
    1. Import an existing number OR purchase a new number via Retell
    2. Make a test call to verify everything works
    
    Args:
        phone_number: E.164 format number to import (if importing existing number)
        termination_uri: Termination URI for imported number (required if importing)
        purchase_phone: If True, purchase a new number via Retell (instead of importing)
        number_provider: Provider for purchase (twilio or telnyx)
        test_call_to: E.164 format number to call for test
        agent_id: Retell agent ID for calls
        nickname: Nickname for the number
    
    Returns:
        Setup results and test call results
    """
    tenant_id = extract_tenant_id(request)
    results = {
        "setup": None,
        "test_call": None,
        "errors": [],
    }
    
    # Step 1: Import or purchase phone number
    try:
        if body.purchase_phone:
            # Purchase a new number via Retell
            # For US numbers, we need area_code (or phone_number in E.164)
            # Let's use a default area code for testing (415 = San Francisco)
            purchase_request = PhoneNumberPurchase(
                area_code=415,  # San Francisco area code for testing
                country_code="US",
                number_provider=body.number_provider,
                inbound_agent_id=body.agent_id,
                outbound_agent_id=body.agent_id,
                nickname=body.nickname or "Test Number",
            )
            purchase_result = await purchase_phone_number(request, purchase_request)
            results["setup"] = purchase_result
            if not purchase_result.get("success"):
                results["errors"].append(f"Failed to purchase number: {purchase_result.get('error')}")
                return results
            phone_number = purchase_result.get("response", {}).get("phone_number")
        else:
            # Import existing number
            if not body.phone_number or not body.termination_uri:
                results["errors"].append("phone_number and termination_uri are required for import")
                return results
            
            import_request = ImportPhoneNumberRequest(
                phone_number=body.phone_number,
                termination_uri=body.termination_uri,
                sip_trunk_user_name=body.sip_trunk_user_name,
                sip_trunk_password=body.sip_trunk_password,
                inbound_agent_id=body.agent_id,
                outbound_agent_id=body.agent_id,
                nickname=body.nickname or "Test Number",
            )
            import_result = await retell_import_phone_number(request, import_request)
            results["setup"] = import_result
            if not import_result.get("success"):
                results["errors"].append(f"Failed to import number: {import_result}")
                return results
            phone_number = import_result.get("phone_number")
        
        if not phone_number:
            results["errors"].append("No phone number returned from setup")
            return results
        
        # Step 2: Make test call
        try:
            # Normalize test_call_to to E.164 if needed
            test_to = body.test_call_to
            if not test_to.startswith("+"):
                # Assume Italian number if no country code
                test_to = "+39" + test_to.lstrip("0")
            
            call_request = OutboundCallRequest(
                to=test_to,
                from_number=phone_number,
                agent_id=body.agent_id,
            )
            call_result = await create_outbound_call(request, call_request)
            results["test_call"] = call_result
        except Exception as e:
            results["errors"].append(f"Test call failed: {str(e)}")
            import traceback
            results["test_call_error"] = traceback.format_exc()
    
    except Exception as e:
        results["errors"].append(f"Setup failed: {str(e)}")
        import traceback
        results["setup_error"] = traceback.format_exc()
    
    return results


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

