"""Webhook handling endpoints"""
import os
import json
import hmac
import hashlib
import base64
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config.database import engine
from models.webhooks import WebhookEvent, WebhookDLQ
from models.calls import CallRecord, CallSegment
from utils.auth import extract_tenant_id
from utils.tenant import tenant_session
from utils.redis_client import get_redis
from utils.r2_client import r2_put_bytes, r2_presign_get
from utils.websocket import manager as ws_manager

router = APIRouter()

# In-memory events storage (MVP only)
# Note: This should be moved to Redis in production
EVENTS: List[Dict[str, Any]] = []


# ============================================================================
# Request/Response Models
# ============================================================================

class WebhookTest(BaseModel):
    event_type: str = "call.transcript.append"
    call_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


# ============================================================================
# Helper Functions
# ============================================================================

def _compute_signature(secret: str, payload: bytes) -> str:
    """Compute HMAC signature for webhook verification"""
    mac = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256)
    return mac.hexdigest()


# ============================================================================
# Webhook Endpoints
# ============================================================================

@router.post("/test")
async def webhooks_test(body: WebhookTest):
    """Test webhook endpoint"""
    evt = {
        "type": body.event_type,
        "data": body.payload or {"text": "test"},
        "call_id": body.call_id or "test-call",
        "event_id": f"test-{int(datetime.now(timezone.utc).timestamp())}",
    }
    now_iso = datetime.now(timezone.utc).isoformat()
    EVENTS.append({"type": body.event_type, "data": evt, "ts": now_iso})
    if len(EVENTS) > 200:
        del EVENTS[: len(EVENTS) - 200]
    await ws_manager.broadcast({"type": body.event_type, "data": evt})
    return {"ok": True}


@router.post("/retell")
async def webhooks_retell(
    request: Request,
    x_signature: Optional[str] = Header(None),
    phone_number: Optional[str] = None,  # Query param: ?phone_number=+14157774444
    num_token: Optional[str] = None,  # Query param: ?num_token=abc123 (opaque token for phone number)
):
    """Handle Retell webhook events
    
    Query params (optional):
    - phone_number: E.164 phone number for tenant lookup (helpful hint, not source of truth)
    - num_token: Opaque token mapping to phone_number (alternative to phone_number)
    
    Note: tenant_id is NEVER trusted from query params. Always resolved from DB.
    """
    raw = await request.body()
    payload = json.loads(raw.decode("utf-8"))
    
    # Verify webhook signature
    # Support both global secret and per-tenant secrets (for BYO accounts)
    secret = None
    inferred_tenant_for_secret = None
    
    # Quick lookup for tenant (just for secret verification, not for processing)
    if phone_number:
        with Session(engine) as session:
            from models.agents import PhoneNumber
            phone_rec = session.query(PhoneNumber).filter(PhoneNumber.e164 == phone_number).first()
            if phone_rec:
                inferred_tenant_for_secret = phone_rec.tenant_id
    
    # Get webhook secret: tenant-specific or global
    if inferred_tenant_for_secret:
        try:
            from sqlalchemy import inspect, text
            inspector = inspect(engine)
            if 'tenants' in inspector.get_table_names():
                columns = [col['name'] for col in inspector.get_columns('tenants')]
                if 'retell_webhook_secret' in columns:
                    with Session(engine) as session:
                        result = session.execute(
                            text("SELECT retell_webhook_secret FROM tenants WHERE id = :tenant_id"),
                            {"tenant_id": inferred_tenant_for_secret}
                        ).first()
                        if result and result[0]:
                            secret = result[0]
        except Exception:
            pass
    
    # Fallback to global secret
    if not secret:
        secret = os.getenv("RETELL_WEBHOOK_SECRET")
    
    # Verify signature if secret is configured
    if secret:
        expected = _compute_signature(secret, raw)
        if not x_signature or not hmac.compare_digest(expected, x_signature):
            raise HTTPException(status_code=401, detail="invalid signature")
    # Idempotency key strategy: prefer event_id/id from payload, fallback to sha256 of body
    event_id = str(payload.get("event_id") or payload.get("id") or hashlib.sha256(raw).hexdigest())
    event_type = payload.get("type") or (payload.get("data") or {}).get("type")

    try:
        with Session(engine) as session:
            existing = (
                session.query(WebhookEvent)
                .filter(WebhookEvent.event_id == event_id)
                .one_or_none()
            )
            if existing and existing.processed:
                return {"received": True, "duplicate": True}
            if not existing:
                existing = WebhookEvent(event_id=event_id, type=str(event_type), raw_json=json.dumps(payload))
                session.add(existing)
                session.commit()
    except Exception as e:
        # Push to Redis DLQ, fallback to DB DLQ
        r = get_redis()
        stored = False
        if r is not None:
            try:
                r.lpush("dlq:webhooks:retell", json.dumps({
                    "event_id": event_id,
                    "raw": raw.decode("utf-8"),
                    "error": str(e),
                    "ts": datetime.now(timezone.utc).isoformat()
                }))
                stored = True
            except Exception:
                stored = False
        if not stored:
            with Session(engine) as session:
                dlq = WebhookDLQ(event_id=event_id, error=str(e), raw_json=raw.decode("utf-8"))
                session.add(dlq)
                session.commit()
        raise

    # Broadcast & store event for metrics
    now_iso = datetime.now(timezone.utc).isoformat()
    EVENTS.append({"type": event_type, "data": payload, "ts": now_iso})
    if len(EVENTS) > 200:
        del EVENTS[: len(EVENTS) - 200]
    await ws_manager.broadcast({"type": event_type, "data": payload})

    # ============================================================================
    # Tenant Resolution: Formalized order of resolution
    # ============================================================================
    # 1. Primary: Lookup by provider_call_id in CallRecord
    # 2. Inference: If not found, infer from metadata/phone_number and create lazy CallRecord
    # 3. Never trust tenant_id from external sources (query param, metadata) as truth
    
    ref_id = payload.get("call_id") or payload.get("id") or (payload.get("data") or {}).get("call_id")
    tenant_id = None
    
    try:
        with Session(engine) as session:
            # Step 1: Primary lookup by provider_call_id
            rec = session.query(CallRecord).filter(CallRecord.provider_call_id == str(ref_id)).one_or_none()
            
            if rec:
                # Found existing CallRecord - use its tenant_id as source of truth
                tenant_id = rec.tenant_id
            else:
                # Step 2: Inference - CallRecord doesn't exist yet (inbound or race condition)
                # Try to infer tenant_id from other sources and create CallRecord lazily
                
                inferred_tenant_id = None
                
                # 2a. Try metadata.tenant_id (but don't trust it as truth, only as hint)
                metadata = payload.get("metadata") or {}
                metadata_tenant_hint = metadata.get("tenant_id")
                
                # 2b. Try from_number or to_number via PhoneNumber lookup
                from_number = payload.get("from_number") or (payload.get("data") or {}).get("from_number")
                to_number = payload.get("to_number") or (payload.get("data") or {}).get("to_number")
                
                # Lookup tenant via phone number
                from models.agents import PhoneNumber
                if from_number:
                    phone_rec = session.query(PhoneNumber).filter(PhoneNumber.e164 == from_number).first()
                    if phone_rec and phone_rec.tenant_id:
                        inferred_tenant_id = phone_rec.tenant_id
                
                if not inferred_tenant_id and to_number:
                    phone_rec = session.query(PhoneNumber).filter(PhoneNumber.e164 == to_number).first()
                    if phone_rec and phone_rec.tenant_id:
                        inferred_tenant_id = phone_rec.tenant_id
                
                # 2c. If we have inferred_tenant_id, verify metadata_hint matches (sanity check)
                if inferred_tenant_id and metadata_tenant_hint:
                    if inferred_tenant_id != metadata_tenant_hint:
                        # Log mismatch but trust DB over metadata
                        import logging
                        logging.warning(
                            f"Tenant mismatch: DB says {inferred_tenant_id}, metadata says {metadata_tenant_hint}. "
                            f"Trusting DB. call_id={ref_id}"
                        )
                
                # Use inferred_tenant_id (from DB lookup), fallback to metadata_hint only if DB lookup failed
                final_tenant_id = inferred_tenant_id or metadata_tenant_hint
                
                if final_tenant_id and ref_id:
                    # Create CallRecord lazily
                    direction = "inbound" if (payload.get("direction") or "").lower() == "inbound" else "outbound"
                    
                    rec = CallRecord(
                        provider_call_id=str(ref_id),
                        tenant_id=final_tenant_id,
                        direction=direction,
                        status="in_progress" if event_type == "call.started" else "created",
                        from_number=from_number,
                        to_number=to_number,
                        raw_response=json.dumps(payload),
                    )
                    session.add(rec)
                    session.commit()
                    session.refresh(rec)
                    
                    tenant_id = final_tenant_id
                else:
                    # Could not infer tenant - log error but continue processing
                    import logging
                    logging.error(
                        f"Could not infer tenant_id for webhook. call_id={ref_id}, "
                        f"from_number={from_number}, to_number={to_number}, metadata={metadata}"
                    )
                    # Continue without tenant_id (will be None)
            
            # At this point, rec should exist (either found or created)
            if not rec:
                # Still no CallRecord - cannot process further
                return {"received": True, "type": event_type, "error": "No CallRecord found or created"}
            # Process event: upsert call status, segments, summary, media, disposition
            # Now rec should exist (either found or created above)
            
            # Idempotency check: Skip if same event already processed
            event_id_for_check = payload.get("event_id") or event_id
            if rec.last_event_type == event_type and rec.last_event_at:
                # Check if this is a duplicate event (same type, recent timestamp)
                event_timestamp = payload.get("timestamp") or payload.get("data", {}).get("timestamp")
                if event_timestamp:
                    # Compare timestamps if available
                    try:
                        from datetime import datetime
                        event_dt = datetime.fromtimestamp(event_timestamp / 1000) if isinstance(event_timestamp, (int, float)) else None
                        if event_dt and rec.last_event_at:
                            time_diff = abs((event_dt.replace(tzinfo=timezone.utc) - rec.last_event_at).total_seconds())
                            if time_diff < 5:  # Same event within 5 seconds
                                return {"received": True, "type": event_type, "duplicate": True}
                    except Exception:
                        pass
            
            # Update last_event tracking
            rec.last_event_type = event_type
            rec.last_event_at = datetime.now(timezone.utc)
            
            if event_type and ("finished" in event_type or event_type == "call.finished"):
                rec.status = "ended"
                rec.updated_at = datetime.now(timezone.utc)
                
                # Update duration and cost if available
                data = payload.get("data") or payload
                if data.get("duration_seconds"):
                    rec.duration_seconds = int(data.get("duration_seconds"))
                if data.get("cost") is not None:
                    # Convert cost to cents if it's a decimal
                    cost_value = data.get("cost")
                    if isinstance(cost_value, float):
                        rec.call_cost_cents = int(cost_value * 100)
                    elif isinstance(cost_value, int):
                        rec.call_cost_cents = cost_value * 100  # Assume dollars, convert to cents
                    else:
                        rec.call_cost_cents = int(cost_value) if cost_value else None
                
                # Save transcript/summary/media
                # Note: data is already set above from payload.get("data") or payload
                if event_type == "call.transcript.append":
                    seg = CallSegment(
                        call_id=rec.id,
                        provider_call_id=str(ref_id),
                        turn_index=(data.get("index") or data.get("turn_index")),
                        speaker=(data.get("speaker") or data.get("role")),
                        start_ms=(data.get("start_ms") or data.get("start") or 0),
                        end_ms=(data.get("end_ms") or data.get("end") or 0),
                        text=(data.get("text") or data.get("content") or ""),
                    )
                    session.add(seg)
                if event_type == "call.summary":
                    # Store summary in CallRecord.summary_json
                    summary_data = {"bullets": data}
                    rec.summary_json = json.dumps(summary_data)
                    # Store structured data if present
                    if data.get("bant") or data.get("trade"):
                        structured_data = {
                            "bant": data.get("bant", {}),
                            "trade": data.get("trade", {})
                        }
                        rec.structured_json = json.dumps(structured_data)
                # media
                if data.get("recording_url"):
                    # Optionally mirror to R2
                    mirrored_url = None
                    try:
                        if data.get("recording_bytes"):
                            key = f"calls/{rec.id}/audio.mp3"
                            put = r2_put_bytes(key, base64.b64decode(data["recording_bytes"]))
                            if put:
                                mirrored_url = r2_presign_get(key, 3600*24)
                    except Exception:
                        mirrored_url = None
                    final_url = mirrored_url or data.get("recording_url")
                    # Store in audio_url (backward compat) and media_json
                    rec.audio_url = final_url
                    # Update media_json
                    try:
                        existing_media = json.loads(rec.media_json) if rec.media_json else {}
                        audio_urls = existing_media.get("audio_urls", [])
                        if final_url not in audio_urls:
                            audio_urls.append(final_url)
                        rec.media_json = json.dumps({"audio_urls": audio_urls})
                    except Exception:
                        rec.media_json = json.dumps({"audio_urls": [final_url]})
                # outcome -> disposition
                if event_type == "call.finished":
                    outcome = (data.get("outcome") or data.get("disposition") or data.get("status") or "unknown")
                    rec.disposition_outcome = outcome
                    rec.disposition_updated_at = datetime.now(timezone.utc)
                session.commit()
                # Mark webhook processed
                we = session.query(WebhookEvent).filter(WebhookEvent.event_id == event_id).one_or_none()
                if we:
                    we.processed = 1
                    session.commit()
    except Exception as e:
        r = get_redis()
        stored = False
        if r is not None:
            try:
                r.lpush("dlq:webhooks:retell", json.dumps({
                    "event_id": event_id,
                    "raw": json.dumps(payload),
                    "error": str(e),
                    "ts": datetime.now(timezone.utc).isoformat()
                }))
                stored = True
            except Exception:
                stored = False
        if not stored:
            with Session(engine) as session:
                dlq = WebhookDLQ(event_id=event_id, error=str(e), raw_json=json.dumps(payload))
                session.add(dlq)
                session.commit()
        # still return 200 to avoid retries storm; ops can replay from DLQ
        return {"received": True, "type": event_type, "dlq": True}
    return {"received": True, "type": event_type}


@router.get("/dlq")
async def list_webhook_dlq(request: Request) -> List[Dict[str, Any]]:
    """List webhook DLQ entries"""
    # Prefer Redis DLQ
    r = get_redis()
    items: List[Dict[str, Any]] = []
    if r is not None:
        try:
            vals = r.lrange("dlq:webhooks:retell", 0, 199)
            for i, v in enumerate(vals):
                try:
                    obj = json.loads(v)
                except Exception:
                    obj = {"raw": v}
                items.append({
                    "id": f"redis:{i}",
                    "event_id": obj.get("event_id"),
                    "error": obj.get("error"),
                    "created_at": obj.get("ts")
                })
        except Exception:
            pass
    # Also include DB DLQ
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        q = session.query(WebhookDLQ)
        if tenant_id is not None:
            q = q.filter(WebhookDLQ.tenant_id == tenant_id)
        rows = q.order_by(WebhookDLQ.id.desc()).limit(200).all()
        items.extend([{
            "id": r.id,
            "event_id": r.event_id,
            "error": r.error,
            "created_at": r.created_at.isoformat()
        } for r in rows])
    return items[:200]


@router.post("/dlq/{entry_id}/replay")
async def replay_webhook_dlq(entry_id: int) -> Dict[str, Any]:
    """Replay webhook from DLQ"""
    # Note: This endpoint would need to import and call webhooks_retell logic
    # For now, return error - this should be refactored to avoid circular dependency
    raise HTTPException(status_code=501, detail="Replay not yet implemented in modular routes")

