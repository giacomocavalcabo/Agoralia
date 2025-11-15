"""Agent, Knowledge Base, and Phone Number endpoints"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config.database import engine
from models.agents import Agent, KnowledgeBase, KnowledgeSection, PhoneNumber
from utils.auth import extract_tenant_id
from utils.helpers import country_iso_from_e164
from services.agents import check_agent_limit, create_retell_agent, update_retell_agent, delete_retell_agent
from services.enforcement import enforce_subscription_or_raise

router = APIRouter()


# ============================================================================
# Agents CRUD
# ============================================================================

@router.get("/agents")
async def list_agents(request: Request) -> List[Dict[str, Any]]:
    """List agents"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        q = session.query(Agent)
        if tenant_id is not None:
            q = q.filter(Agent.tenant_id == tenant_id)
        rows = q.order_by(Agent.id.desc()).limit(200).all()
        return [
            {
                "id": a.id,
                "name": a.name,
                "lang": a.lang,
                "voice_id": a.voice_id,
                "retell_agent_id": a.retell_agent_id,
            }
            for a in rows
        ]


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
            logging.info(f"Retell AI create response: {retell_response}")
            print(f"[DEBUG] Retell AI create response: {retell_response}", flush=True)
            
            # Extract Retell agent ID (can be llm_xxx or in response object)
            # Retell API returns: {"retell_llm_id": "llm_xxx", ...} or similar
            retell_agent_id = None
            if isinstance(retell_response, dict):
                # Try multiple possible keys
                retell_agent_id = (
                    retell_response.get("retell_llm_id") or
                    retell_response.get("llm_id") or
                    retell_response.get("id") or
                    retell_response.get("agent_id")
                )
                # Sometimes it's nested in a "retell_llm" key
                if not retell_agent_id and "retell_llm" in retell_response:
                    retell_llm = retell_response["retell_llm"]
                    if isinstance(retell_llm, dict):
                        retell_agent_id = retell_llm.get("retell_llm_id") or retell_llm.get("llm_id") or retell_llm.get("id")
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
    name: Optional[str] = None
    lang: Optional[str] = None
    voice_id: Optional[str] = None


@router.patch("/agents/{agent_id}")
async def update_agent(request: Request, agent_id: int, body: AgentUpdate):
    """Update agent in Agoralia and corresponding Retell AI agent"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        a = session.get(Agent, agent_id)
        if not a or (tenant_id is not None and a.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Update Retell AI agent if retell_agent_id exists
        if a.retell_agent_id:
            try:
                await update_retell_agent(
                    retell_agent_id=a.retell_agent_id,
                    name=body.name,
                    language=body.lang,
                    voice_id=body.voice_id,
                )
            except Exception as e:
                # Log error but don't block update in Agoralia
                import logging
                logging.error(f"Failed to update Retell agent {a.retell_agent_id}: {e}")
                # Continue with local update
        
        # Update local agent
        if body.name is not None:
            a.name = body.name
        if body.lang is not None:
            a.lang = body.lang
        if body.voice_id is not None:
            a.voice_id = body.voice_id
        session.commit()
        
        return {
            "ok": True,
            "retell_updated": a.retell_agent_id is not None,
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

@router.get("/kbs")
async def list_kbs(request: Request) -> List[Dict[str, Any]]:
    """List knowledge bases"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        q = session.query(KnowledgeBase)
        if tenant_id is not None:
            q = q.filter(KnowledgeBase.tenant_id == tenant_id)
        rows = q.order_by(KnowledgeBase.id.desc()).limit(200).all()
        return [{"id": k.id, "lang": k.lang, "scope": k.scope} for k in rows]


class KbCreate(BaseModel):
    lang: Optional[str] = None
    scope: Optional[str] = None


@router.post("/kbs")
async def create_kb(request: Request, body: KbCreate):
    """Create knowledge base"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        k = KnowledgeBase(lang=body.lang, scope=body.scope, tenant_id=tenant_id)
        session.add(k)
        session.commit()
    return {"ok": True}


class KbUpdate(BaseModel):
    lang: Optional[str] = None
    scope: Optional[str] = None


@router.patch("/kbs/{kb_id}")
async def update_kb(request: Request, kb_id: int, body: KbUpdate):
    """Update knowledge base"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        k = session.get(KnowledgeBase, kb_id)
        if not k or (tenant_id is not None and k.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="KB not found")
        if body.lang is not None:
            k.lang = body.lang
        if body.scope is not None:
            k.scope = body.scope
        session.commit()
    return {"ok": True}


@router.delete("/kbs/{kb_id}")
async def delete_kb(request: Request, kb_id: int):
    """Delete knowledge base"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        k = session.get(KnowledgeBase, kb_id)
        if not k or (tenant_id is not None and k.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="KB not found")
        session.delete(k)
        session.commit()
    return {"ok": True}


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

