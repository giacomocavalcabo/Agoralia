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
from models.calls import CallRecord, CallSegment, CallSummary
from models.compliance import Disposition, CallMedia, CallStructured
from models.agents import KnowledgeSection
from utils.auth import extract_tenant_id
from utils.tenant import tenant_session
from utils.helpers import country_iso_from_e164, _resolve_lang, _resolve_agent
from utils.retell import get_retell_headers, get_retell_base_url, retell_get_json
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

@router.post("/retell/outbound")
async def create_outbound_call(request: Request, payload: OutboundCallRequest):
    """Create outbound phone call via Retell"""
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")

    base_url = get_retell_base_url()
    endpoint = f"{base_url}/v2/create-phone-call"
    headers = get_retell_headers()

    # Ensure valid from_number
    from_num = payload.from_number or os.getenv("DEFAULT_FROM_NUMBER")
    if not from_num:
        raise HTTPException(
            status_code=400,
            detail="from_number mancante: imposta DEFAULT_FROM_NUMBER o passa un Caller ID valido"
        )

    body = {"from_number": from_num, "to_number": payload.to}
    # Resolve language and agent mapping
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        lang = _resolve_lang(
            session, request, payload.to,
            (payload.metadata or {}).get("lang") if payload.metadata else None
        )
        agent_id = payload.agent_id
        if not agent_id:
            aid, is_multi = _resolve_agent(session, tenant_id, "voice", lang)
            if aid:
                agent_id = aid
                if is_multi:
                    body.setdefault("metadata", {})
                    body["metadata"]["instruction"] = f"rispondi sempre in {lang}"
        if agent_id:
            body["agent_id"] = agent_id
        body.setdefault("metadata", {})
        body["metadata"]["lang"] = lang
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

    # Compliance + subscription + budget gating
    with Session(engine) as session:
        enforce_subscription_or_raise(session, request)
        enforce_compliance_or_raise(session, request, payload.to, payload.metadata)
        enforce_budget_or_raise(session, request)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(endpoint, headers=headers, json=body)
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        data = resp.json()
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
        # Include latest disposition and media url if any
        disp = (
            session.query(Disposition)
            .filter(Disposition.call_id == call_id)
            .order_by(Disposition.updated_at.desc())
            .first()
        )
        media = (
            session.query(CallMedia)
            .filter(CallMedia.call_id == call_id)
            .order_by(CallMedia.created_at.desc())
            .first()
        )
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
            "disposition": (disp.outcome if disp else None),
            "audio_url": (media.audio_url if media else None),
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
        row = (
            session.query(CallSummary)
            .filter(CallSummary.call_id == call_id)
            .order_by(CallSummary.id.desc())
            .first()
        )
        if not row:
            return {"summary": None}
        try:
            payload = json.loads(row.bullets_json or "{}")
        except Exception:
            payload = {"raw": row.bullets_json}
        # Also fetch structured BANT/TRADE if available
        structured = (
            session.query(CallStructured)
            .filter(CallStructured.call_id == call_id)
            .order_by(CallStructured.id.desc())
            .first()
        )
        bant = {}
        trade = {}
        try:
            if structured and structured.bant_json:
                bant = json.loads(structured.bant_json)
        except Exception:
            bant = {"raw": structured.bant_json} if structured else {}
        try:
            if structured and structured.trade_json:
                trade = json.loads(structured.trade_json)
        except Exception:
            trade = {"raw": structured.trade_json} if structured else {}
        return {
            "summary": payload,
            "bant": bant,
            "trade": trade,
            "created_at": row.created_at.isoformat() if row.created_at else None,
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
        disp = Disposition(call_id=call_id, outcome=body.outcome, note=body.note)
        session.add(disp)
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
            latest_disp = (
                session.query(Disposition)
                .filter(Disposition.call_id == r.id)
                .order_by(Disposition.updated_at.desc())
                .first()
            )
            out = (latest_disp.outcome if latest_disp else None)
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

