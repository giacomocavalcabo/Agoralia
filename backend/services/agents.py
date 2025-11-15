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
    """Create a Retell Agent (not Retell LLM!)
    
    According to Retell AI docs:
    - POST /create-agent creates an Agent and returns agent_id
    - POST /create-retell-llm creates a Response Engine (Retell LLM) and returns retell_llm_id
    
    We want to create an Agent with inline Retell LLM configuration.
    
    Returns: Response dict from Retell AI, which should contain agent_id
    """
    # Default voice if not provided
    if not voice_id:
        voice_id = "11labs-Adrian"  # Default ElevenLabs voice
    
    # First, create the Retell LLM (response engine)
    retell_llm_body = {
        "model": "gpt-4o-mini",
        "start_speaker": "agent",
        "begin_message": f"Ciao, sono l'assistente virtuale {name}. Come posso aiutarti?",
    }
    
    import logging
    logging.info(f"Creating Retell LLM first: {retell_llm_body}")
    print(f"[DEBUG] Creating Retell LLM first: {retell_llm_body}", flush=True)
    
    retell_llm_id = None
    try:
        # Create Retell LLM (response engine)
        llm_response = await retell_post_json("/create-retell-llm", retell_llm_body)
        logging.info(f"Retell LLM created: {llm_response}")
        print(f"[DEBUG] Retell LLM created: {llm_response}", flush=True)
        retell_llm_id = llm_response.get("retell_llm_id") or llm_response.get("llm_id") or llm_response.get("id")
    except HTTPException as e:
        logging.warning(f"Failed to create Retell LLM: {e.detail}")
        print(f"[DEBUG] Failed to create Retell LLM: {e.detail}", flush=True)
        # Try v2 endpoint
        try:
            llm_response = await retell_post_json("/v2/create-retell-llm", retell_llm_body)
            logging.info(f"Retell LLM created (v2): {llm_response}")
            print(f"[DEBUG] Retell LLM created (v2): {llm_response}", flush=True)
            retell_llm_id = llm_response.get("retell_llm_id") or llm_response.get("llm_id") or llm_response.get("id")
        except Exception as ex:
            logging.error(f"Both Retell LLM endpoints failed: {ex}")
            print(f"[DEBUG] Both Retell LLM endpoints failed: {ex}", flush=True)
            raise HTTPException(status_code=500, detail=f"Failed to create Retell LLM: {ex}")
    
    if not retell_llm_id:
        raise HTTPException(status_code=500, detail="Failed to get retell_llm_id from response")
    
    # Now create the Agent with the Retell LLM as response engine
    agent_body = {
        "response_engine": {
            "type": "retell-llm",
            "llm_id": retell_llm_id,
        },
        "agent_name": name,
        "voice_id": voice_id,
        "voice_model": "eleven_turbo_v2",
        "language": language,
    }
    
    if webhook_url:
        agent_body["webhook_url"] = webhook_url
    
    logging.info(f"Creating Retell Agent with body: {agent_body}")
    print(f"[DEBUG] Creating Retell Agent with body: {agent_body}", flush=True)
    
    try:
        # Create Agent (this is the correct endpoint according to docs)
        agent_response = await retell_post_json("/create-agent", agent_body)
        logging.info(f"Retell Agent created: {agent_response}")
        print(f"[DEBUG] Retell Agent created: {agent_response}", flush=True)
        
        # Return agent_id, not retell_llm_id
        # The agent_id is what we need to save for making calls
        return agent_response
    except HTTPException as e:
        logging.error(f"Failed to create Retell Agent: {e.detail}")
        print(f"[DEBUG] Failed to create Retell Agent: {e.detail}", flush=True)
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

