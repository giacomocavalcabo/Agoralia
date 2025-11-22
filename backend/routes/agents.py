"""Agent, Knowledge Base, and Phone Number endpoints"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import json
import urllib.parse

from config.database import engine
from models.agents import Agent, KnowledgeBase, KnowledgeSection, PhoneNumber
from utils.auth import extract_tenant_id, extract_user_id
from utils.helpers import country_iso_from_e164
from services.agents import check_agent_limit, create_retell_agent, update_retell_agent, delete_retell_agent
from services.enforcement import enforce_subscription_or_raise

router = APIRouter()


# ============================================================================
# Agents CRUD
# ============================================================================

@router.get("/agents")
async def list_agents(request: Request) -> List[Dict[str, Any]]:
    """List agents with all configuration"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        q = session.query(Agent)
        if tenant_id is not None:
            q = q.filter(Agent.tenant_id == tenant_id)
        rows = q.order_by(Agent.id.desc()).limit(200).all()
        return [_agent_to_dict(a) for a in rows]


def _agent_to_dict(a: Agent) -> Dict[str, Any]:
    """Convert Agent model to dictionary with all fields"""
    return {
        "id": a.id,
        "tenant_id": a.tenant_id,
        "name": a.name,
        "lang": a.lang,
        "voice_id": a.voice_id,
        "retell_agent_id": a.retell_agent_id,
        # Response Engine
        "response_engine": a.response_engine,
        "begin_message": a.begin_message,
        "start_speaker": a.start_speaker,
        "begin_message_delay_ms": a.begin_message_delay_ms,
        # Voice Settings
        "voice_model": a.voice_model,
        "fallback_voice_ids": a.fallback_voice_ids,
        "voice_temperature": a.voice_temperature,
        "voice_speed": a.voice_speed,
        "volume": a.volume,
        # Agent Behavior
        "responsiveness": a.responsiveness,
        "interruption_sensitivity": a.interruption_sensitivity,
        "enable_backchannel": a.enable_backchannel,
        "backchannel_frequency": a.backchannel_frequency,
        "backchannel_words": a.backchannel_words,
        "reminder_trigger_ms": a.reminder_trigger_ms,
        "reminder_max_count": a.reminder_max_count,
        # Ambient Sound
        "ambient_sound": a.ambient_sound,
        "ambient_sound_volume": a.ambient_sound_volume,
        # Language & Webhook
        "webhook_url": a.webhook_url,
        "webhook_timeout_ms": a.webhook_timeout_ms,
        # Transcription & Keywords
        "boosted_keywords": a.boosted_keywords,
        "stt_mode": a.stt_mode,
        "vocab_specialization": a.vocab_specialization,
        "denoising_mode": a.denoising_mode,
        # Data Storage
        "data_storage_setting": a.data_storage_setting,
        "opt_in_signed_url": a.opt_in_signed_url,
        # Speech Settings
        "pronunciation_dictionary": a.pronunciation_dictionary,
        "normalize_for_speech": a.normalize_for_speech,
        # Call Settings
        "end_call_after_silence_ms": a.end_call_after_silence_ms,
        "max_call_duration_ms": a.max_call_duration_ms,
        "ring_duration_ms": a.ring_duration_ms,
        # Voicemail
        "voicemail_option": a.voicemail_option,
        # Post-Call Analysis
        "post_call_analysis_data": a.post_call_analysis_data,
        "post_call_analysis_model": a.post_call_analysis_model,
        # DTMF
        "allow_user_dtmf": a.allow_user_dtmf,
        "user_dtmf_options": a.user_dtmf_options,
        # PII
        "pii_config": a.pii_config,
        # Knowledge Base
        "knowledge_base_ids": a.knowledge_base_ids,
        # Additional metadata
        "role": a.role,
        "mission": a.mission,
        "custom_prompt": a.custom_prompt,
        # Timestamps
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.get("/agents/{agent_id}")
async def get_agent(request: Request, agent_id: int) -> Dict[str, Any]:
    """Get agent details with all configuration"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        a = session.get(Agent, agent_id)
        if not a or (tenant_id is not None and a.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Agent not found")
        return _agent_to_dict(a)


class AgentCreate(BaseModel):
    name: str
    lang: Optional[str] = None
    voice_id: Optional[str] = None


@router.post("/agents")
async def create_agent(request: Request, body: AgentCreate):
    """Create agent in Agoralia and corresponding Retell AI agent"""
    tenant_id = extract_tenant_id(request)
    
    # Subscription gating
    with Session(engine) as session:
        enforce_subscription_or_raise(session, request)
        
        # Check agent limit based on plan
        check_agent_limit(session, tenant_id)
        
        # Determine language and voice defaults
        lang = body.lang or "it-IT"
        voice_id = body.voice_id or "11labs-Adrian"  # Default voice
        
        # Create agent in Retell AI first
        try:
            retell_response = await create_retell_agent(
                name=body.name,
                language=lang,
                voice_id=voice_id,
            )
            # Log full response for debugging
            import logging
            import json as json_lib
            logging.info(f"Retell AI create response: {retell_response}")
            print(f"[DEBUG] Retell AI create response: {json_lib.dumps(retell_response, indent=2)}", flush=True)
            
            # Extract Retell agent ID from response
            # Retell API returns: {"agent_id": "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD", ...}
            retell_agent_id = None
            if isinstance(retell_response, dict):
                # The correct key is "agent_id" (not "retell_llm_id" or "llm_id")
                retell_agent_id = retell_response.get("agent_id")
                
                # Debug: log all keys in response
                all_keys = list(retell_response.keys())
                logging.info(f"Response keys: {all_keys}")
                print(f"[DEBUG] Response keys: {all_keys}", flush=True)
                
                if not retell_agent_id:
                    logging.error(f"No agent_id in response! Available keys: {all_keys}")
                    print(f"[DEBUG] ERROR: No agent_id in response! Available keys: {all_keys}", flush=True)
                    print(f"[DEBUG] Full response: {json_lib.dumps(retell_response, indent=2)}", flush=True)
        except Exception as e:
            # If Retell creation fails, still create local agent but without retell_agent_id
            # This allows users to retry or fix configuration
            retell_agent_id = None
            # Log error but don't block agent creation in Agoralia
            import logging
            import traceback
            logging.error(f"Failed to create Retell agent for {body.name}: {e}\n{traceback.format_exc()}")
            print(f"[DEBUG] Failed to create Retell agent: {e}", flush=True)
        
        # Create agent in Agoralia database
        a = Agent(
            name=body.name,
            lang=lang,
            voice_id=voice_id,
            tenant_id=tenant_id,
            retell_agent_id=retell_agent_id,
        )
        session.add(a)
        session.commit()
        session.refresh(a)
        
        return {
            "ok": True,
            "id": a.id,
            "name": a.name,
            "retell_agent_id": a.retell_agent_id,
            "retell_created": retell_agent_id is not None,
        }


class AgentUpdate(BaseModel):
    """Update agent with all RetellAI fields"""
    # Basic fields
    name: Optional[str] = None
    lang: Optional[str] = None
    voice_id: Optional[str] = None
    
    # Response Engine (full JSON)
    response_engine: Optional[Dict[str, Any]] = None
    begin_message: Optional[str] = None
    start_speaker: Optional[str] = None
    begin_message_delay_ms: Optional[int] = None
    
    # Voice Settings
    voice_model: Optional[str] = None
    fallback_voice_ids: Optional[List[str]] = None
    voice_temperature: Optional[float] = None
    voice_speed: Optional[float] = None
    volume: Optional[float] = None
    
    # Agent Behavior
    responsiveness: Optional[float] = None
    interruption_sensitivity: Optional[float] = None
    enable_backchannel: Optional[bool] = None
    backchannel_frequency: Optional[float] = None
    backchannel_words: Optional[List[str]] = None
    reminder_trigger_ms: Optional[int] = None
    reminder_max_count: Optional[int] = None
    
    # Ambient Sound
    ambient_sound: Optional[str] = None
    ambient_sound_volume: Optional[float] = None
    
    # Language & Webhook
    webhook_url: Optional[str] = None
    webhook_timeout_ms: Optional[int] = None
    
    # Transcription & Keywords
    boosted_keywords: Optional[List[str]] = None
    stt_mode: Optional[str] = None
    vocab_specialization: Optional[str] = None
    denoising_mode: Optional[str] = None
    
    # Data Storage
    data_storage_setting: Optional[str] = None
    opt_in_signed_url: Optional[bool] = None
    
    # Speech Settings
    pronunciation_dictionary: Optional[List[Dict[str, Any]]] = None
    normalize_for_speech: Optional[bool] = None
    
    # Call Settings
    end_call_after_silence_ms: Optional[int] = None
    max_call_duration_ms: Optional[int] = None
    ring_duration_ms: Optional[int] = None
    
    # Voicemail
    voicemail_option: Optional[Dict[str, Any]] = None
    
    # Post-Call Analysis
    post_call_analysis_data: Optional[List[Dict[str, Any]]] = None
    post_call_analysis_model: Optional[str] = None
    
    # DTMF
    allow_user_dtmf: Optional[bool] = None
    user_dtmf_options: Optional[Dict[str, Any]] = None
    
    # PII
    pii_config: Optional[Dict[str, Any]] = None
    
    # Knowledge Base
    knowledge_base_ids: Optional[List[str]] = None
    
    # Additional metadata
    role: Optional[str] = None
    mission: Optional[str] = None
    custom_prompt: Optional[str] = None


@router.patch("/agents/{agent_id}")
async def update_agent(request: Request, agent_id: int, body: AgentUpdate):
    """Update agent in Agoralia and corresponding Retell AI agent with all fields"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        a = session.get(Agent, agent_id)
        if not a or (tenant_id is not None and a.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Build update dict for RetellAI
        retell_updates = {}
        
        # Update local agent fields (update all provided fields)
        if body.name is not None:
            a.name = body.name
            retell_updates["agent_name"] = body.name
        if body.lang is not None:
            a.lang = body.lang
            retell_updates["language"] = body.lang
        if body.voice_id is not None:
            a.voice_id = body.voice_id
            retell_updates["voice_id"] = body.voice_id
        
        # Response Engine fields - need to update response_engine if any of its fields change
        response_engine_needs_update = False
        current_response_engine = a.response_engine.copy() if isinstance(a.response_engine, dict) and a.response_engine else {}
        
        # Ensure we have the existing llm_id if response_engine exists
        existing_llm_id = current_response_engine.get("llm_id") if isinstance(current_response_engine, dict) else None
        
        if body.response_engine is not None:
            # Full response_engine replacement
            a.response_engine = body.response_engine
            retell_updates["response_engine"] = body.response_engine
            response_engine_needs_update = True
        else:
            # Partial response_engine update - build updated response_engine from current or create new
            if not current_response_engine:
                # No existing response_engine, create new structure
                current_response_engine = {
                    "type": "retell-llm",
                }
                # If we have existing llm_id from agent, try to get it from RetellAI
                # For now, we'll need to create a new LLM or get the existing one
                # This is a limitation - we might need to fetch from RetellAI or store llm_id separately
                if existing_llm_id:
                    current_response_engine["llm_id"] = existing_llm_id
            else:
                # Preserve existing llm_id
                if "llm_id" in current_response_engine:
                    existing_llm_id = current_response_engine["llm_id"]
            
            # Update begin_message
            if body.begin_message is not None:
                a.begin_message = body.begin_message
                if "type" not in current_response_engine:
                    current_response_engine["type"] = "retell-llm"
                current_response_engine["begin_message"] = body.begin_message
                response_engine_needs_update = True
            
            # Update start_speaker
            if body.start_speaker is not None:
                a.start_speaker = body.start_speaker
                if "type" not in current_response_engine:
                    current_response_engine["type"] = "retell-llm"
                current_response_engine["start_speaker"] = body.start_speaker
                response_engine_needs_update = True
            
            # If knowledge_base_ids change, update response_engine
            if body.knowledge_base_ids is not None:
                a.knowledge_base_ids = body.knowledge_base_ids
                if "type" not in current_response_engine:
                    current_response_engine["type"] = "retell-llm"
                current_response_engine["knowledge_base_ids"] = body.knowledge_base_ids
                response_engine_needs_update = True
                
                # Preserve llm_id when updating knowledge_base_ids
                if existing_llm_id and "llm_id" not in current_response_engine:
                    current_response_engine["llm_id"] = existing_llm_id
        
        if body.begin_message_delay_ms is not None:
            a.begin_message_delay_ms = body.begin_message_delay_ms
            retell_updates["begin_message_delay_ms"] = body.begin_message_delay_ms
        
        # If response_engine was updated, include it in retell_updates
        # NOTE: For update, we need to ensure we have llm_id in response_engine
        # If response_engine exists but doesn't have llm_id, we might need to fetch it or create it
        if response_engine_needs_update and current_response_engine:
            # If we don't have llm_id and need to update response_engine, we might need to create/update LLM first
            # For now, if llm_id is missing and we're updating begin_message or start_speaker, 
            # we should update the existing LLM or create a new one
            if current_response_engine.get("type") == "retell-llm" and not current_response_engine.get("llm_id") and a.retell_agent_id:
                # Try to get current agent from RetellAI to extract llm_id
                try:
                    from utils.retell import retell_get_json
                    retell_agent = await retell_get_json(f"/get-agent/{a.retell_agent_id}", tenant_id)
                    if retell_agent and isinstance(retell_agent.get("response_engine"), dict):
                        existing_llm_id_from_retell = retell_agent["response_engine"].get("llm_id")
                        if existing_llm_id_from_retell:
                            current_response_engine["llm_id"] = existing_llm_id_from_retell
                except Exception as e:
                    import logging
                    logging.warning(f"Could not fetch llm_id from RetellAI: {e}")
                    # Continue anyway - RetellAI might handle it
                    
            retell_updates["response_engine"] = current_response_engine
            a.response_engine = current_response_engine
        
        # Voice Settings
        if body.voice_model is not None:
            a.voice_model = body.voice_model
            retell_updates["voice_model"] = body.voice_model
        if body.fallback_voice_ids is not None:
            a.fallback_voice_ids = body.fallback_voice_ids
            retell_updates["fallback_voice_ids"] = body.fallback_voice_ids
        if body.voice_temperature is not None:
            a.voice_temperature = body.voice_temperature
            retell_updates["voice_temperature"] = body.voice_temperature
        if body.voice_speed is not None:
            a.voice_speed = body.voice_speed
            retell_updates["voice_speed"] = body.voice_speed
        if body.volume is not None:
            a.volume = body.volume
            retell_updates["volume"] = body.volume
        
        # Agent Behavior
        if body.responsiveness is not None:
            a.responsiveness = body.responsiveness
            retell_updates["responsiveness"] = body.responsiveness
        if body.interruption_sensitivity is not None:
            a.interruption_sensitivity = body.interruption_sensitivity
            retell_updates["interruption_sensitivity"] = body.interruption_sensitivity
        if body.enable_backchannel is not None:
            a.enable_backchannel = body.enable_backchannel
            retell_updates["enable_backchannel"] = body.enable_backchannel
        if body.backchannel_frequency is not None:
            a.backchannel_frequency = body.backchannel_frequency
            retell_updates["backchannel_frequency"] = body.backchannel_frequency
        if body.backchannel_words is not None:
            a.backchannel_words = body.backchannel_words
            retell_updates["backchannel_words"] = body.backchannel_words
        if body.reminder_trigger_ms is not None:
            a.reminder_trigger_ms = body.reminder_trigger_ms
            retell_updates["reminder_trigger_ms"] = body.reminder_trigger_ms
        if body.reminder_max_count is not None:
            a.reminder_max_count = body.reminder_max_count
            retell_updates["reminder_max_count"] = body.reminder_max_count
        
        # Ambient Sound
        if body.ambient_sound is not None:
            a.ambient_sound = body.ambient_sound
            retell_updates["ambient_sound"] = body.ambient_sound
        if body.ambient_sound_volume is not None:
            a.ambient_sound_volume = body.ambient_sound_volume
            retell_updates["ambient_sound_volume"] = body.ambient_sound_volume
        
        # Language & Webhook
        if body.webhook_url is not None:
            a.webhook_url = body.webhook_url
            retell_updates["webhook_url"] = body.webhook_url
        if body.webhook_timeout_ms is not None:
            a.webhook_timeout_ms = body.webhook_timeout_ms
            retell_updates["webhook_timeout_ms"] = body.webhook_timeout_ms
        
        # Transcription & Keywords
        if body.boosted_keywords is not None:
            a.boosted_keywords = body.boosted_keywords
            retell_updates["boosted_keywords"] = body.boosted_keywords
        if body.stt_mode is not None:
            a.stt_mode = body.stt_mode
            retell_updates["stt_mode"] = body.stt_mode
        if body.vocab_specialization is not None:
            a.vocab_specialization = body.vocab_specialization
            retell_updates["vocab_specialization"] = body.vocab_specialization
        if body.denoising_mode is not None:
            a.denoising_mode = body.denoising_mode
            retell_updates["denoising_mode"] = body.denoising_mode
        
        # Data Storage
        if body.data_storage_setting is not None:
            a.data_storage_setting = body.data_storage_setting
            retell_updates["data_storage_setting"] = body.data_storage_setting
        if body.opt_in_signed_url is not None:
            a.opt_in_signed_url = body.opt_in_signed_url
            retell_updates["opt_in_signed_url"] = body.opt_in_signed_url
        
        # Speech Settings
        if body.pronunciation_dictionary is not None:
            a.pronunciation_dictionary = body.pronunciation_dictionary
            retell_updates["pronunciation_dictionary"] = body.pronunciation_dictionary
        if body.normalize_for_speech is not None:
            a.normalize_for_speech = body.normalize_for_speech
            retell_updates["normalize_for_speech"] = body.normalize_for_speech
        
        # Call Settings
        if body.end_call_after_silence_ms is not None:
            a.end_call_after_silence_ms = body.end_call_after_silence_ms
            retell_updates["end_call_after_silence_ms"] = body.end_call_after_silence_ms
        if body.max_call_duration_ms is not None:
            a.max_call_duration_ms = body.max_call_duration_ms
            retell_updates["max_call_duration_ms"] = body.max_call_duration_ms
        if body.ring_duration_ms is not None:
            a.ring_duration_ms = body.ring_duration_ms
            retell_updates["ring_duration_ms"] = body.ring_duration_ms
        
        # Voicemail
        if body.voicemail_option is not None:
            a.voicemail_option = body.voicemail_option
            retell_updates["voicemail_option"] = body.voicemail_option
        
        # Post-Call Analysis
        if body.post_call_analysis_data is not None:
            a.post_call_analysis_data = body.post_call_analysis_data
            retell_updates["post_call_analysis_data"] = body.post_call_analysis_data
        if body.post_call_analysis_model is not None:
            a.post_call_analysis_model = body.post_call_analysis_model
            retell_updates["post_call_analysis_model"] = body.post_call_analysis_model
        
        # DTMF
        if body.allow_user_dtmf is not None:
            a.allow_user_dtmf = body.allow_user_dtmf
            retell_updates["allow_user_dtmf"] = body.allow_user_dtmf
        if body.user_dtmf_options is not None:
            a.user_dtmf_options = body.user_dtmf_options
            retell_updates["user_dtmf_options"] = body.user_dtmf_options
        
        # PII
        if body.pii_config is not None:
            a.pii_config = body.pii_config
            retell_updates["pii_config"] = body.pii_config
        
        # Knowledge Base (already handled above in response_engine section)
        # Keeping this for backwards compatibility but it's redundant now
        
        # Additional metadata
        if body.role is not None:
            a.role = body.role
        if body.mission is not None:
            a.mission = body.mission
        if body.custom_prompt is not None:
            a.custom_prompt = body.custom_prompt
        
        # Update timestamp
        from datetime import datetime, timezone
        a.updated_at = datetime.now(timezone.utc)
        
        # Update Retell AI agent if retell_agent_id exists and we have updates
        retell_updated = False
        if a.retell_agent_id and (retell_updates or response_engine_needs_update):
            try:
                from utils.retell import retell_patch_json, retell_get_json
                
                # If response_engine needs update, we need to handle it carefully
                # For retell-llm, if begin_message or start_speaker change, we might need to update the LLM first
                if response_engine_needs_update and current_response_engine:
                    # If response_engine has llm_id, we might need to update the LLM separately
                    # But according to RetellAI docs, we can update response_engine directly in the agent
                    # So we'll include it in retell_updates
                    if "response_engine" not in retell_updates:
                        retell_updates["response_engine"] = current_response_engine
                    
                    # If begin_message or start_speaker changed and we have llm_id, update LLM too
                    llm_id = current_response_engine.get("llm_id")
                    if llm_id and (body.begin_message is not None or body.start_speaker is not None):
                        # Update Retell LLM directly
                        try:
                            llm_update = {}
                            if body.begin_message is not None:
                                llm_update["begin_message"] = body.begin_message
                            if body.start_speaker is not None:
                                llm_update["start_speaker"] = body.start_speaker
                            if llm_update:
                                await retell_patch_json(f"/update-retell-llm/{llm_id}", llm_update, tenant_id)
                        except Exception as llm_e:
                            import logging
                            logging.warning(f"Failed to update Retell LLM {llm_id}: {llm_e}, continuing with agent update")
                
                # Update Retell AI agent
                if retell_updates:
                    await retell_patch_json(f"/update-agent/{a.retell_agent_id}", retell_updates, tenant_id)
                retell_updated = True
            except Exception as e:
                import logging
                import traceback
                logging.error(f"Failed to update Retell agent {a.retell_agent_id}: {e}\n{traceback.format_exc()}")
                # Continue with local update
        
        session.commit()
        
        return {
            "ok": True,
            "retell_updated": retell_updated,
        }


@router.delete("/agents/{agent_id}")
async def delete_agent(request: Request, agent_id: int):
    """Delete agent from Agoralia and corresponding Retell AI agent"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        a = session.get(Agent, agent_id)
        if not a or (tenant_id is not None and a.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Delete Retell AI agent if retell_agent_id exists
        retell_agent_id = a.retell_agent_id
        if retell_agent_id:
            try:
                await delete_retell_agent(retell_agent_id)
            except Exception as e:
                # Log error but continue with local deletion
                import logging
                logging.error(f"Failed to delete Retell agent {retell_agent_id}: {e}")
                # Continue with local deletion
        
        # Delete local agent
        session.delete(a)
        session.commit()
        
        return {
            "ok": True,
            "retell_deleted": retell_agent_id is not None,
        }


# ============================================================================
# Knowledge Bases CRUD
# ============================================================================

def _kb_to_dict(k: KnowledgeBase) -> Dict[str, Any]:
    """Convert KnowledgeBase model to dictionary with all fields"""
    return {
        "id": k.id,
        "tenant_id": k.tenant_id,
        "name": k.name,
        "lang": k.lang,
        "scope": k.scope,
        "retell_kb_id": k.retell_kb_id,
        "status": k.status,
        "knowledge_base_sources": k.knowledge_base_sources,
        "enable_auto_refresh": k.enable_auto_refresh,
        "last_refreshed_timestamp": k.last_refreshed_timestamp,
        "created_by_user_id": k.created_by_user_id,
        "created_by_user_name": k.created_by_user_name,
        "created_at": k.created_at.isoformat() if k.created_at else None,
        "updated_at": k.updated_at.isoformat() if k.updated_at else None,
        "synced": k.retell_kb_id is not None,
    }


@router.get("/kbs")
async def list_kbs(request: Request) -> List[Dict[str, Any]]:
    """List knowledge bases for the current tenant"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        q = session.query(KnowledgeBase)
        if tenant_id is not None:
            q = q.filter(KnowledgeBase.tenant_id == tenant_id)
        rows = q.order_by(KnowledgeBase.id.desc()).limit(200).all()
        return [_kb_to_dict(k) for k in rows]


class KbCreate(BaseModel):
    """Request body for creating a knowledge base in Agoralia and RetellAI"""
    name: str = Field(..., max_length=40, description="Name of the knowledge base (max 40 chars, required)")
    lang: Optional[str] = Field(None, description="Language code (e.g., 'it-IT', 'en-US')")
    scope: Optional[str] = Field(None, description="Scope: 'general' for workspace-wide KB, or specific scope")
    
    # RetellAI fields
    knowledge_base_texts: Optional[List[Dict[str, str]]] = Field(None, description="Array of {title, text} objects to add to KB")
    knowledge_base_urls: Optional[List[str]] = Field(None, description="Array of URLs to scrape and add to KB")
    enable_auto_refresh: Optional[bool] = Field(None, description="Enable auto-refresh for URLs every 12 hours")


@router.post("/kbs")
async def create_kb(
    request: Request,
    # Form fields for multipart/form-data (when files are present)
    name: Optional[str] = Form(None),
    lang: Optional[str] = Form(None),
    scope: Optional[str] = Form(None),
    knowledge_base_texts: Optional[str] = Form(None),  # JSON string
    knowledge_base_urls: Optional[str] = Form(None),  # JSON string
    enable_auto_refresh: Optional[str] = Form(None),  # "true" or "false"
    knowledge_base_files: Optional[List[UploadFile]] = File(None),
):
    """Create knowledge base in Agoralia and RetellAI
    
    Creates a knowledge base in both systems:
    1. Creates KB in RetellAI with provided texts/URLs/files
    2. Saves KB metadata in Agoralia database
    3. Links them via retell_kb_id
    
    Supports both JSON (application/json) and multipart/form-data (when files are present).
    For JSON requests, data should be sent as form fields (name, lang, etc.) with empty file list.
    """
    tenant_id = extract_tenant_id(request)
    
    # Determine if this is multipart/form-data (has files) or JSON
    has_files = knowledge_base_files is not None and len(knowledge_base_files) > 0
    
    # Check content type to determine request format
    content_type = request.headers.get("content-type", "").lower()
    is_multipart = "multipart/form-data" in content_type
    is_json_content = "application/json" in content_type
    
    # Extract data from either JSON body or form fields
    # If form fields are present (name is not None), use form fields (multipart)
    # Otherwise, if content-type is JSON, parse JSON body
    if is_multipart or (name is not None) or has_files:
        # Multipart/form-data request (or form fields)
        kb_name = name
        kb_lang = lang
        kb_scope = scope or "general"
        kb_texts = None
        kb_urls = None
        kb_auto_refresh = None
        
        if knowledge_base_texts:
            try:
                kb_texts = json.loads(knowledge_base_texts)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON in knowledge_base_texts")
        
        if knowledge_base_urls:
            try:
                kb_urls = json.loads(knowledge_base_urls)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON in knowledge_base_urls")
        
        if enable_auto_refresh:
            kb_auto_refresh = enable_auto_refresh.lower() == "true"
    elif is_json_content:
        # JSON request - parse body manually
        try:
            body_data = await request.json()
            kb_name = body_data.get("name")
            kb_lang = body_data.get("lang")
            kb_scope = body_data.get("scope", "general")
            kb_texts = body_data.get("knowledge_base_texts")
            kb_urls = body_data.get("knowledge_base_urls")
            kb_auto_refresh = body_data.get("enable_auto_refresh")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON body: {str(e)}")
    else:
        # Unknown content type - try form fields first, then JSON as fallback
        if name is not None:
            # Use form fields
            kb_name = name
            kb_lang = lang
            kb_scope = scope or "general"
            kb_texts = None
            kb_urls = None
            kb_auto_refresh = None
            
            if knowledge_base_texts:
                try:
                    kb_texts = json.loads(knowledge_base_texts)
                except json.JSONDecodeError:
                    raise HTTPException(status_code=400, detail="Invalid JSON in knowledge_base_texts")
            
            if knowledge_base_urls:
                try:
                    kb_urls = json.loads(knowledge_base_urls)
                except json.JSONDecodeError:
                    raise HTTPException(status_code=400, detail="Invalid JSON in knowledge_base_urls")
            
            if enable_auto_refresh:
                kb_auto_refresh = enable_auto_refresh.lower() == "true"
        else:
            # Try JSON as fallback
            try:
                body_data = await request.json()
                kb_name = body_data.get("name")
                kb_lang = body_data.get("lang")
                kb_scope = body_data.get("scope", "general")
                kb_texts = body_data.get("knowledge_base_texts")
                kb_urls = body_data.get("knowledge_base_urls")
                kb_auto_refresh = body_data.get("enable_auto_refresh")
            except Exception:
                raise HTTPException(status_code=400, detail="Unable to parse request. Please provide either form fields or JSON body.")
    
    # Validate required fields
    if not kb_name:
        raise HTTPException(status_code=400, detail="name is required")
    
    # Prepare form data for RetellAI API (multipart/form-data)
    from utils.retell import retell_post_multipart
    import logging
    
    logger = logging.getLogger(__name__)
    
    form_data: Dict[str, Any] = {
        "knowledge_base_name": kb_name,
    }
    
    # Add texts if provided
    if kb_texts:
        form_data["knowledge_base_texts"] = json.dumps(kb_texts)
    
    # Add URLs if provided
    if kb_urls:
        form_data["knowledge_base_urls"] = json.dumps(kb_urls)
    
    # Add auto-refresh if provided
    if kb_auto_refresh is not None:
        form_data["enable_auto_refresh"] = "true" if kb_auto_refresh else "false"
    
    # Prepare files for RetellAI (if any)
    retell_files: Optional[Dict[str, Any]] = None
    if has_files and knowledge_base_files:
        # Convert UploadFile to format expected by httpx
        # httpx expects: {"field_name": [(filename, content, content_type), ...]} for arrays
        # RetellAI expects knowledge_base_files as an array of files
        file_list = []
        for file in knowledge_base_files:
            if file.size and file.size > 50 * 1024 * 1024:  # 50MB limit
                raise HTTPException(status_code=400, detail=f"File {file.filename} exceeds 50MB limit")
            file_content = await file.read()
            content_type = file.content_type or "application/octet-stream"
            filename = file.filename or "file"
            # httpx expects list of tuples for array fields
            file_list.append((filename, file_content, content_type))
        
        if file_list:
            retell_files = {"knowledge_base_files": file_list}
    
    try:
        # Create KB in RetellAI first
        logger.info(f"[create_kb] Creating KB in RetellAI: {kb_name}")
        print(f"[DEBUG] [create_kb] Creating KB in RetellAI: {kb_name}", flush=True)
        
        retell_data = await retell_post_multipart(
            "/create-knowledge-base",
            data=form_data,
            files=retell_files,
            tenant_id=tenant_id
        )
        
        retell_kb_id = retell_data.get("knowledge_base_id")
        retell_status = retell_data.get("status", "in_progress")
        retell_sources = retell_data.get("knowledge_base_sources", [])
        retell_auto_refresh = retell_data.get("enable_auto_refresh", False)
        retell_last_refresh = retell_data.get("last_refreshed_timestamp")
        
        logger.info(f"[create_kb] RetellAI KB created: {retell_kb_id}, status: {retell_status}")
        print(f"[DEBUG] [create_kb] RetellAI KB created: {retell_kb_id}, status: {retell_status}", flush=True)
        
        # Get user info for tracking who created this KB
        user_id = extract_user_id(request)
        user_name = None
        if user_id:
            with Session(engine) as session:
                from models.users import User
                user = session.query(User).filter(User.id == user_id).first()
                if user:
                    # Build full name from first_name and last_name
                    parts = [p for p in [user.first_name, user.last_name] if p]
                    user_name = ' '.join(parts) if parts else None
        
        # Save KB in Agoralia database
        with Session(engine) as session:
            kb = KnowledgeBase(
                tenant_id=tenant_id,
                name=kb_name,
                lang=kb_lang,
                scope=kb_scope,
                retell_kb_id=retell_kb_id,
                status=retell_status,
                knowledge_base_sources=retell_sources,
                enable_auto_refresh=retell_auto_refresh,
                last_refreshed_timestamp=retell_last_refresh,
                created_by_user_id=user_id,
                created_by_user_name=user_name,
            )
            session.add(kb)
            session.commit()
            kb_id = kb.id
        
        logger.info(f"[create_kb] Agoralia KB created: {kb_id}, linked to RetellAI: {retell_kb_id}")
        print(f"[DEBUG] [create_kb] Agoralia KB created: {kb_id}, linked to RetellAI: {retell_kb_id}", flush=True)
        
        return {
            "ok": True,
            "id": kb_id,
            "retell_kb_id": retell_kb_id,
            "status": retell_status,
            "name": kb_name,
        }
    except HTTPException as e:
        logger.error(f"[create_kb] HTTPException: {e.status_code} - {e.detail}")
        raise e
    except Exception as e:
        import traceback
        logger.error(f"[create_kb] Error creating KB: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error creating knowledge base: {str(e)}")


class KbUpdate(BaseModel):
    """Request body for updating a knowledge base"""
    name: Optional[str] = Field(None, max_length=40, description="Name of the knowledge base (max 40 chars)")
    lang: Optional[str] = None
    scope: Optional[str] = None
    enable_auto_refresh: Optional[bool] = None


@router.patch("/kbs/{kb_id}")
async def update_kb(request: Request, kb_id: int, body: KbUpdate):
    """Update knowledge base in Agoralia
    
    Updates KB metadata in Agoralia. If KB is synced to RetellAI (has retell_kb_id),
    some fields (like name) may need to be updated in RetellAI as well.
    
    Note: To update KB sources (texts, URLs, files), use:
    - POST /kbs/{kb_id}/sources to add sources
    - DELETE /kbs/{kb_id}/sources/{source_id} to remove sources
    """
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        k = session.get(KnowledgeBase, kb_id)
        if not k or (tenant_id is not None and k.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="KB not found")
        
        updated = False
        
        if body.name is not None:
            k.name = body.name
            updated = True
        
        if body.lang is not None:
            k.lang = body.lang
            updated = True
        
        if body.scope is not None:
            k.scope = body.scope
            updated = True
        
        if body.enable_auto_refresh is not None:
            k.enable_auto_refresh = body.enable_auto_refresh
            updated = True
        
        if updated:
            k.updated_at = datetime.now(timezone.utc)
            session.commit()
    
    return {"ok": True}


@router.get("/kbs/{kb_id}")
async def get_kb(request: Request, kb_id: int) -> Dict[str, Any]:
    """Get knowledge base details by ID
    
    Also refreshes KB status and sources from RetellAI if synced.
    """
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        k = session.get(KnowledgeBase, kb_id)
        if not k or (tenant_id is not None and k.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="KB not found")
        
        # Refresh KB data from RetellAI if synced
        if k.retell_kb_id:
            try:
                from utils.retell import retell_get_json
                retell_data = await retell_get_json(f"/get-knowledge-base/{urllib.parse.quote(k.retell_kb_id)}", tenant_id=tenant_id)
                
                # Update local KB with RetellAI data
                k.status = retell_data.get("status", k.status)
                k.knowledge_base_sources = retell_data.get("knowledge_base_sources", k.knowledge_base_sources)
                k.enable_auto_refresh = retell_data.get("enable_auto_refresh", k.enable_auto_refresh)
                k.last_refreshed_timestamp = retell_data.get("last_refreshed_timestamp", k.last_refreshed_timestamp)
                k.updated_at = datetime.now(timezone.utc)
                session.commit()
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"[get_kb] Could not refresh KB from RetellAI: {e}")
                # Continue with local data
        
        return _kb_to_dict(k)


@router.delete("/kbs/{kb_id}")
async def delete_kb(request: Request, kb_id: int):
    """Delete knowledge base
    
    Also deletes corresponding Retell KB if retell_kb_id exists.
    """
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        k = session.get(KnowledgeBase, kb_id)
        if not k or (tenant_id is not None and k.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="KB not found")
        
        # Delete from Retell if synced
        if k.retell_kb_id:
            try:
                from services.kb_sync import sync_kb_delete_from_retell
                await sync_kb_delete_from_retell(kb_id, session, tenant_id)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"[delete_kb] Error deleting Retell KB: {e}")
                # Continue with Agoralia KB deletion even if Retell deletion fails
        
        session.delete(k)
        session.commit()
    return {"ok": True}


@router.post("/kbs/{kb_id}/sections")
async def add_kb_section(request: Request, kb_id: int, kind: str, content_text: str):
    """Add a section to a knowledge base (for testing)
    
    Args:
        kb_id: KB ID
        kind: Section kind (knowledge | rules | style)
        content_text: Section content
    """
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        kb = session.get(KnowledgeBase, kb_id)
        if not kb or (tenant_id is not None and kb.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="KB not found")
        
        if kind not in ["knowledge", "rules", "style"]:
            raise HTTPException(status_code=400, detail="kind must be: knowledge, rules, or style")
        
        sec = KnowledgeSection(
            kb_id=kb_id,
            tenant_id=kb.tenant_id,
            kind=kind,
            content_text=content_text
        )
        session.add(sec)
        session.commit()
        return {"ok": True, "section_id": sec.id}


@router.post("/kbs/{kb_id}/sync")
async def sync_kb(request: Request, kb_id: int, force: bool = False):
    """Synchronize Agoralia KB to Retell AI
    
    Creates or updates Retell KB from Agoralia KB.
    - If KB has no retell_kb_id: creates new Retell KB
    - If KB has retell_kb_id and force=False: updates existing Retell KB
    - If KB has retell_kb_id and force=True: recreates Retell KB
    
    Args:
        kb_id: Agoralia KB ID
        force: Force recreation of Retell KB even if retell_kb_id exists
    
    Returns:
        retell_kb_id: Retell KB ID
    """
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        from services.kb_sync import sync_kb_to_retell
        
        try:
            retell_kb_id = await sync_kb_to_retell(kb_id, session, tenant_id, force=force)
            return {
                "ok": True,
                "kb_id": kb_id,
                "retell_kb_id": retell_kb_id,
                "message": "KB synchronized successfully"
            }
        except HTTPException:
            raise
        except Exception as e:
            import traceback
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"[sync_kb] Error syncing KB {kb_id}: {e}\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Error syncing KB: {str(e)}")


# ============================================================================
# Phone Numbers CRUD
# ============================================================================



@router.get("/numbers")
async def list_numbers(request: Request) -> List[Dict[str, Any]]:
    """List phone numbers"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        q = session.query(PhoneNumber)
        if tenant_id is not None:
            q = q.filter(PhoneNumber.tenant_id == tenant_id)
        rows = q.order_by(PhoneNumber.id.desc()).limit(200).all()
        return [{"id": n.id, "e164": n.e164, "type": n.type, "verified": bool(n.verified), "country": n.country} for n in rows]


@router.get("/numbers/renewal-alerts")
async def get_renewal_alerts(request: Request) -> List[Dict[str, Any]]:
    """Get phone number renewal alerts for dashboard
    
    Returns phone numbers that are due for renewal within 5 days.
    Shows alerts at -5, -4, -3, -2, -1 days before renewal.
    """
    tenant_id = extract_tenant_id(request)
    now = datetime.now(timezone.utc)
    today = now.date()
    
    alerts: List[Dict[str, Any]] = []
    
    with Session(engine) as session:
        q = session.query(PhoneNumber).filter(
            PhoneNumber.type == "retell",
            PhoneNumber.verified == 1,
            PhoneNumber.purchased_at.isnot(None),
        )
        if tenant_id is not None:
            q = q.filter(PhoneNumber.tenant_id == tenant_id)
        
        phone_numbers = q.all()
        
        for phone_number in phone_numbers:
            if not phone_number.purchased_at:
                continue
            
            # Calculate days until renewal
            renewal_date = phone_number.purchased_at + timedelta(days=30)
            days_until_renewal = (renewal_date.date() - today).days
            
            # Only include alerts for -5 to 0 days
            if 0 <= days_until_renewal <= 5:
                monthly_cost_cents = phone_number.monthly_cost_cents or 200
                alerts.append({
                    "phone_number": phone_number.e164,
                    "phone_number_id": phone_number.id,
                    "days_until_renewal": days_until_renewal,
                    "renewal_date": renewal_date.date().isoformat(),
                    "monthly_cost_cents": monthly_cost_cents,
                    "monthly_cost_usd": monthly_cost_cents / 100.0,
                    "purchased_at": phone_number.purchased_at.isoformat() if phone_number.purchased_at else None,
                    "next_renewal_at": phone_number.next_renewal_at.isoformat() if phone_number.next_renewal_at else None,
                })
        
        # Sort by days_until_renewal (most urgent first)
        alerts.sort(key=lambda x: x["days_until_renewal"])
        
        return alerts


class NumberCreate(BaseModel):
    e164: str
    type: Optional[str] = "retell"


@router.post("/numbers")
async def create_number(request: Request, body: NumberCreate):
    """Create phone number"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        n = PhoneNumber(e164=body.e164, type=body.type or "retell", tenant_id=tenant_id, country=country_iso_from_e164(body.e164))
        session.add(n)
        session.commit()
    return {"ok": True}


class NumberUpdate(BaseModel):
    e164: Optional[str] = None
    type: Optional[str] = None
    verified: Optional[bool] = None


@router.patch("/numbers/{number_id}")
async def update_number(request: Request, number_id: int, body: NumberUpdate):
    """Update phone number"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        n = session.get(PhoneNumber, number_id)
        if not n or (tenant_id is not None and n.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Number not found")
        if body.e164 is not None:
            n.e164 = body.e164
            n.country = country_iso_from_e164(body.e164)
        if body.type is not None:
            n.type = body.type
        if body.verified is not None:
            n.verified = 1 if body.verified else 0
        session.commit()
    return {"ok": True}


@router.delete("/numbers/{number_id}")
async def delete_number(request: Request, number_id: int):
    """Delete phone number"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        n = session.get(PhoneNumber, number_id)
        if not n or (tenant_id is not None and n.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Number not found")
        session.delete(n)
        session.commit()
    return {"ok": True}

