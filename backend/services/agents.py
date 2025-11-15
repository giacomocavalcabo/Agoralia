"""Agent management utilities"""
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException
from models.agents import Agent
from models.billing import Subscription
from utils.retell import (
    retell_post_json,
    retell_patch_json,
    retell_delete_json,
)


def check_agent_limit(session: Session, tenant_id: Optional[int]) -> None:
    """Check if tenant can create more agents based on plan"""
    if tenant_id is None:
        return  # No limit for system/admin
    
    # Get subscription
    sub = (
        session.query(Subscription)
        .filter(Subscription.tenant_id == tenant_id)
        .order_by(Subscription.id.desc())
        .first()
    )
    plan_code = sub.plan_code if sub else "free"
    
    # Get entitlements (we'll need to call the route function, or extract the logic)
    # For now, inline the logic
    def _get_agent_limit(plan_code: str) -> Optional[int]:
        if plan_code == "enterprise":
            return None  # Unlimited
        if plan_code == "pro":
            return 20
        if plan_code == "core":
            return 5
        return 1  # free
    
    limit = _get_agent_limit(plan_code)
    if limit is None:
        return  # Unlimited
    
    # Count existing agents
    count = session.query(Agent).filter(Agent.tenant_id == tenant_id).count()
    if count >= limit:
        raise HTTPException(
            status_code=402,
            detail=f"Agent limit reached ({limit} agents max for {plan_code} plan). Please upgrade."
        )


async def create_retell_agent(
    name: str,
    language: str = "en-US",
    voice_id: Optional[str] = None,
    webhook_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a Retell LLM agent"""
    # Build Retell LLM config
    # Default voice if not provided
    if not voice_id:
        voice_id = "11labs-Adrian"  # Default ElevenLabs voice
    
    body = {
        "agent": {
            "response_engine": {
                "type": "retell-llm",
            },
            "agent_name": name,
            "voice_id": voice_id,
            "voice_model": "eleven_turbo_v2",
            "language": language,
        },
        "retell_llm": {
            "model": "gpt-4o-mini",
            "start_speaker": "agent",
            "begin_message": f"Ciao, sono l'assistente virtuale {name}. Come posso aiutarti?",
        }
    }
    
    if webhook_url:
        body["agent"]["webhook_url"] = webhook_url
    
    try:
        # Try v2 endpoint first
        data = await retell_post_json("/v2/create-retell-llm", body)
        return data
    except HTTPException as e:
        # Try alternative endpoint
        try:
            data = await retell_post_json("/create-retell-llm", body)
            return data
        except Exception:
            raise e


async def update_retell_agent(
    retell_agent_id: str,
    name: Optional[str] = None,
    language: Optional[str] = None,
    voice_id: Optional[str] = None,
    webhook_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Update a Retell LLM agent"""
    body: Dict[str, Any] = {}
    
    if name or voice_id or language or webhook_url:
        body["agent"] = {}
        if name:
            body["agent"]["agent_name"] = name
        if voice_id:
            body["agent"]["voice_id"] = voice_id
        if language:
            body["agent"]["language"] = language
        if webhook_url is not None:
            body["agent"]["webhook_url"] = webhook_url
    
    # Retell API uses retell_llm_id as query param
    try:
        # Try v2 endpoint
        data = await retell_patch_json(f"/v2/update-retell-llm?retell_llm_id={retell_agent_id}", body)
        return data
    except HTTPException as e:
        # Try alternative endpoint
        try:
            data = await retell_patch_json(f"/update-retell-llm?retell_llm_id={retell_agent_id}", body)
            return data
        except Exception:
            raise e


async def delete_retell_agent(retell_agent_id: str) -> None:
    """Delete a Retell LLM agent"""
    try:
        # Try v2 endpoint
        await retell_delete_json(f"/v2/delete-retell-llm?retell_llm_id={retell_agent_id}")
    except HTTPException as e:
        # Try alternative endpoint
        try:
            await retell_delete_json(f"/delete-retell-llm?retell_llm_id={retell_agent_id}")
        except Exception:
            raise e

