"""Miscellaneous endpoints (events, legal, batch, websocket)"""
import os
import csv
import asyncio
import importlib
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config.database import engine
from models.calls import CallRecord
from models.agents import KnowledgeSection
from models.campaigns import Lead
from models.calls import ScheduledCall
from utils.auth import extract_tenant_id
from utils.tenant import tenant_session
from utils.helpers import country_iso_from_e164
from utils.websocket import manager as ws_manager
from utils.retell import get_retell_headers, get_retell_base_url
from services.enforcement import (
    enforce_subscription_or_raise,
    enforce_budget_or_raise,
    enforce_compliance_or_raise,
)
router = APIRouter()

# Get backend directory for worker import
BACKEND_DIR = Path(__file__).resolve().parent.parent

# In-memory events storage (shared with webhooks)
# Note: This should be moved to Redis in production
# Import from webhooks module to share the same list
try:
    from .webhooks import EVENTS
except ImportError:
    EVENTS: List[Dict[str, Any]] = []


# ============================================================================
# Events Endpoints
# ============================================================================

@router.get("/events")
async def list_events() -> List[Dict[str, Any]]:
    """List recent events"""
    return EVENTS[-200:]


# ============================================================================
# Legal Endpoints
# ============================================================================

@router.get("/legal/notice")
async def legal_notice(e164: Optional[str] = None, iso: Optional[str] = None) -> Dict[str, Any]:
    """Get legal notice for country"""
    country = iso or country_iso_from_e164(e164 or "")
    notices = {
        "IT": {
            "title": "Italy",
            "disclosure": "Announce virtual agent; request explicit consent for recording.",
            "dnc": "Respect RPO (Registro Pubblico delle Opposizioni).",
        },
        "FR": {
            "title": "France",
            "disclosure": "Announce recording; comply with CNIL guidance.",
            "dnc": "Apply Bloctel rules.",
        },
        "MA": {
            "title": "Morocco",
            "disclosure": "Announce identity and purpose; verify local consent rules.",
            "dnc": "Observe local telecom marketing restrictions.",
        },
        "EG": {
            "title": "Egypt",
            "disclosure": "PDPL: ensure lawful basis; explicit consent for recording.",
            "dnc": "Check local DNC policies.",
        },
    }
    payload = notices.get(country or "", {
        "title": country or "Unknown",
        "disclosure": "Check local rules.",
        "dnc": "Check DNC rules."
    })
    return {"country_iso": country, "notice": payload}


# ============================================================================
# Batch Endpoints
# ============================================================================

class BatchItem(BaseModel):
    to: str
    from_number: Optional[str] = None
    delay_ms: int = 0
    metadata: Optional[dict] = None
    agent_id: Optional[str] = None
    kb_id: Optional[int] = None


def _normalize_phone(raw: str) -> Optional[str]:
    """Normalize phone number to E.164"""
    if not raw:
        return None
    s = str(raw).strip().replace(" ", "")
    if s.startswith("+") and s[1:].isdigit():
        return s
    if s.isdigit():
        return "+" + s
    return None


def _lower_or_none(v: Optional[str]) -> Optional[str]:
    """Lowercase string or return None"""
    return str(v).strip().lower() if v is not None else None


@router.post("/batch")
async def start_batch(request: Request, items: List[BatchItem]):
    """Start batch call processing"""
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")
    default_from = os.getenv("DEFAULT_FROM_NUMBER")
    tenant_id = extract_tenant_id(request)

    # Budget gating at batch start
    with Session(engine) as session:
        enforce_subscription_or_raise(session, request)
        enforce_budget_or_raise(session, request)

    # Try to enqueue on Dramatiq worker; fallback to in-app async loop if unavailable
    def _get_dramatiq_actor():
        try:
            spec = importlib.util.spec_from_file_location("backend.worker", str(BACKEND_DIR / "worker.py"))
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                return getattr(mod, "start_phone_call", None)
        except Exception:
            return None
        return None

    actor = _get_dramatiq_actor()
    if actor is not None:
        accepted = 0
        for it in items:
            delay_ms = int(max(0, (it.delay_ms or 0)))
            # Compose knowledge if kb_id present
            kb_payload = None
            if it.kb_id is not None:
                with Session(engine) as session:
                    secs = (
                        session.query(KnowledgeSection)
                        .filter(KnowledgeSection.kb_id == it.kb_id)
                        .order_by(KnowledgeSection.id.asc())
                        .all()
                    )
                    if secs:
                        kb_payload = {
                            "knowledge": [s.content_text for s in secs if s.kind == "knowledge" and s.content_text],
                            "rules": [s.content_text for s in secs if s.kind == "rules" and s.content_text],
                            "style": [s.content_text for s in secs if s.kind == "style" and s.content_text],
                        }
            actor.send_with_options(
                args=(it.to, tenant_id, (it.from_number or default_from), it.agent_id, it.metadata, it.delay_ms, kb_payload),
                delay=delay_ms,
            )
            accepted += 1
        return {"accepted": accepted, "mode": "queue"}

    # Fallback: inline async processing
    async def worker():
        import httpx
        base_url = get_retell_base_url()
        endpoint = f"{base_url}/v2/create-phone-call"
        headers = get_retell_headers()
        async with httpx.AsyncClient(timeout=30) as client:
            for it in items:
                await asyncio.sleep((it.delay_ms or 0) / 1000.0)
                effective_from = it.from_number or default_from
                if not effective_from:
                    continue
                # Compliance gating per item
                try:
                    enforce_compliance_or_raise(Session(engine), request, it.to, it.metadata)
                except Exception:
                    continue
                body = {"to_number": it.to, "from_number": effective_from}
                if it.agent_id:
                    body["agent_id"] = it.agent_id
                if it.metadata is not None:
                    body["metadata"] = it.metadata
                try:
                    resp = await client.post(endpoint, headers=headers, json=body)
                    if resp.status_code < 400:
                        data = resp.json()
                        with Session(engine) as session:
                            rec = CallRecord(
                                direction="outbound",
                                provider="retell",
                                to_number=it.to,
                                from_number=effective_from,
                                provider_call_id=str(data.get("call_id") or data.get("id") or ""),
                                status="created",
                                raw_response=str(data),
                                tenant_id=tenant_id,
                            )
                            session.add(rec)
                            session.commit()
                        await ws_manager.broadcast({"type": "call.created", "data": data})
                except Exception:
                    pass

    asyncio.create_task(worker())
    return {"accepted": len(items), "mode": "inline"}


@router.post("/batch/import")
async def import_batch_csv(
    request: Request,
    file: UploadFile = File(None),
    text: Optional[str] = Form(None),
    delimiter: str = Form(","),
) -> Dict[str, Any]:
    """Import batch calls from CSV"""
    content: Optional[str] = None
    if file is not None:
        data = await file.read()
        try:
            content = data.decode("utf-8")
        except Exception:
            content = data.decode("latin-1", errors="ignore")
    elif text is not None:
        content = text
    else:
        raise HTTPException(status_code=400, detail="CSV mancante: invia 'file' o 'text'")

    reader = csv.reader(content.splitlines(), delimiter=delimiter or ",")
    rows = list(reader)
    if not rows:
        return {"items": [], "errors": ["CSV vuoto"]}

    # Detect header
    header: Optional[List[str]] = None
    sample = rows[0]
    if any(k.lower() in {"to", "phone", "number", "to_number"} for k in sample):
        header = [str(c).strip() for c in sample]
        data_rows = rows[1:]
    else:
        data_rows = rows

    # Map possible column names
    def idx(names: List[str]) -> Optional[int]:
        if header is None:
            return None
        low = [h.lower() for h in header]
        for n in names:
            if n in low:
                return low.index(n)
        return None

    col_to = idx(["to", "to_number", "phone", "number"])
    col_from = idx(["from", "from_number", "caller_id"])
    col_agent = idx(["agent", "agent_id"])
    col_delay = idx(["delay", "delay_ms", "spacing_ms"])
    col_name = idx(["name"])
    col_company = idx(["company"])
    col_lang = idx(["lang", "language"])
    col_role = idx(["role"])
    col_consent = idx(["consent", "consent_status"])
    col_country = idx(["country", "country_iso"])

    items: List[Dict[str, Any]] = []
    errors: List[str] = []

    for i, row in enumerate(data_rows, start=2 if header else 1):
        try:
            def get(c: Optional[int]) -> Optional[str]:
                return (str(row[c]).strip() if c is not None and c < len(row) else None)

            to_raw = get(col_to) or (row[0].strip() if header is None else None)
            to_e164 = _normalize_phone(to_raw or "") if (to_raw or "").strip() else None
            if not to_e164:
                errors.append(f"Riga {i}: numero non valido")
                continue

            md: Dict[str, Any] = {}
            name = get(col_name)
            company = get(col_company)
            if name:
                md["name"] = name
            if company:
                md["company"] = company
            lang = _lower_or_none(get(col_lang))
            role = _lower_or_none(get(col_role))
            consent = _lower_or_none(get(col_consent))
            country = _lower_or_none(get(col_country))
            if lang:
                md["lang"] = lang
            if role:
                md["role"] = role
            if consent:
                md["consent_status"] = consent
            if country:
                md["country_iso"] = country

            # metadata.* columns
            if header is not None:
                for ci, h in enumerate(header):
                    hlow = h.lower()
                    if hlow.startswith("metadata."):
                        key = hlow.split("metadata.", 1)[1]
                        md[key] = row[ci]

            delay_ms: Optional[int] = None
            if col_delay is not None:
                try:
                    delay_ms = int(float(row[col_delay]))
                except Exception:
                    delay_ms = None

            item: Dict[str, Any] = {
                "to": to_e164,
                "from_number": _normalize_phone(get(col_from) or "") or None,
                "agent_id": get(col_agent),
                "delay_ms": delay_ms,
                "metadata": md or None,
            }
            items.append(item)
        except Exception as e:
            errors.append(f"Riga {i}: errore {e}")

    return {
        "items": items,
        "errors": errors,
        "columns_detected": header or [],
        "total": len(items),
        "invalid": len(errors),
    }


# ============================================================================
# WebSocket Endpoint
# ============================================================================

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keepalive: receive messages but ignore (client can send pings)
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

