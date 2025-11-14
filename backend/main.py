import os
from pathlib import Path
import importlib.util
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect, Header, UploadFile, File, Form, Body
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine, Integer, String, Text, DateTime, ForeignKey, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session
import json
import asyncio
from fastapi.middleware.cors import CORSMiddleware
import hmac
import hashlib
from contextlib import contextmanager
import base64
import urllib.parse
import httpx
import stripe
import csv
try:
    import redis  # type: ignore
except Exception:
    redis = None
try:
    import boto3  # type: ignore
except Exception:
    boto3 = None


def get_redis():
    if redis is None:
        return None
    url = os.getenv("REDIS_URL") or "redis://127.0.0.1:6379/0"
    try:
        return redis.Redis.from_url(url, decode_responses=True)
    except Exception:
        return None


# -----------------------------
# Cloudflare R2 (S3-compatible) helpers
# -----------------------------

def get_r2_client():
    if boto3 is None:
        return None
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    account_id = os.getenv("R2_ACCOUNT_ID")
    if not (access_key and secret_key and account_id):
        return None
    endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    try:
        s3 = boto3.client(
            "s3",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            endpoint_url=endpoint,
            region_name="auto",
        )
        return s3
    except Exception:
        return None


def r2_put_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> Optional[str]:
    s3 = get_r2_client()
    bucket = os.getenv("R2_BUCKET")
    if s3 is None or not bucket:
        return None
    try:
        s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
        return f"s3://{bucket}/{key}"
    except Exception:
        return None


def r2_presign_get(key: str, expires_seconds: int = 3600) -> Optional[str]:
    s3 = get_r2_client()
    bucket = os.getenv("R2_BUCKET")
    if s3 is None or not bucket:
        return None
    try:
        url = s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=int(expires_seconds),
        )
        return url
    except Exception:
        return None
import json as _json


# Carica .env dalla cartella backend
BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")
stripe.api_key = os.getenv("STRIPE_API_KEY", "")

# Inizializza FastAPI app PRIMA di qualsiasi endpoint
app = FastAPI(title="Agoralia Backend", version="0.1.0")

# -----------------------------
# Billing API (Stripe minimal)
# -----------------------------


@app.post("/billing/checkout")
async def billing_checkout(request: Request, plan: str = "core") -> Dict[str, Any]:
    # Minimal: create Checkout Session and return URL
    if not stripe.api_key:
        raise HTTPException(status_code=400, detail="Stripe not configured")
    tenant_id = extract_tenant_id(request)
    price_map = {
        "core": os.getenv("STRIPE_PRICE_CORE", ""),
        "pro": os.getenv("STRIPE_PRICE_PRO", ""),
    }
    price_id = price_map.get(plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Unknown plan")
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=os.getenv("STRIPE_SUCCESS_URL", "http://localhost:5173/settings") + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=os.getenv("STRIPE_CANCEL_URL", "http://localhost:5173/settings"),
            client_reference_id=str(tenant_id or "0"),
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/billing/portal")
async def billing_portal(request: Request) -> Dict[str, Any]:
    if not stripe.api_key:
        raise HTTPException(status_code=400, detail="Stripe not configured")
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        sub = (
            session.query(Subscription)
            .filter(Subscription.tenant_id == (tenant_id or 0))
            .order_by(Subscription.id.desc())
            .first()
        )
        customer = sub.stripe_customer_id if sub and sub.stripe_customer_id else os.getenv("STRIPE_FALLBACK_CUSTOMER", "")
    try:
        portal = stripe.billing_portal.Session.create(
            customer=customer,
            return_url=os.getenv("STRIPE_PORTAL_RETURN_URL", "http://localhost:5173/settings"),
        )
        return {"url": portal.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class StripeEvent(BaseModel):
    id: str
    type: str
    data: Dict[str, Any]


@app.post("/billing/webhook/stripe")
async def billing_webhook_stripe(request: Request):
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature")
    wh_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    try:
        event = stripe.Webhook.construct_event(payload, sig, wh_secret) if wh_secret else stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    etype = event["type"]
    obj = event["data"]["object"]
    # Minimal handling: subscription status changes & checkout completed
    with Session(engine) as session:
        try:
            if etype == "checkout.session.completed":
                tenant_ref = (obj.get("client_reference_id") or "0")
                plan_code = "core" if os.getenv("STRIPE_PRICE_CORE") in str(obj) else ("pro" if os.getenv("STRIPE_PRICE_PRO") in str(obj) else "core")
                sub_id = obj.get("subscription")
                cust_id = obj.get("customer")
                tenant_id = int(tenant_ref) if str(tenant_ref).isdigit() else 0
                sub = Subscription(tenant_id=tenant_id, plan_code=plan_code, status="active", stripe_subscription_id=sub_id, stripe_customer_id=cust_id)
                session.add(sub)
                session.commit()
            if etype.startswith("customer.subscription."):
                sub_id = obj.get("id")
                status = obj.get("status")
                row = session.query(Subscription).filter(Subscription.stripe_subscription_id == sub_id).order_by(Subscription.id.desc()).first()
                if row:
                    row.status = status
                    session.commit()
        except Exception:
            session.rollback()
            raise
    return {"received": True}


class KBPublishRequest(BaseModel):
    kb_id: int
    agent_id: Optional[str] = None


@app.post("/kb/publish")
async def kb_publish(request: Request, body: KBPublishRequest, type: str = "outbound") -> Dict[str, Any]:
    # Rate-limit: max 1 op ogni 30s per tenant
    tenant_id = extract_tenant_id(request)
    r = get_redis()
    if r is not None and tenant_id is not None:
        key = f"rl:kb_publish:{tenant_id}"
        try:
            if r.setnx(key, "1"):
                r.expire(key, 30)
            else:
                raise HTTPException(status_code=429, detail="KB publish rate-limited")
        except Exception:
            pass
    # Serialize sections
    with Session(engine) as session:
        secs = (
            session.query(KnowledgeSection)
            .filter(KnowledgeSection.kb_id == body.kb_id)
            .order_by(KnowledgeSection.id.asc())
            .all()
        )
        payload = {
            "kb_id": body.kb_id,
            "agent_id": body.agent_id,
            "knowledge": [s.content_text for s in secs if s.kind == "knowledge" and s.content_text],
            "rules": [s.content_text for s in secs if s.kind == "rules" and s.content_text],
            "style": [s.content_text for s in secs if s.kind == "style" and s.content_text],
        }
        # Versioning per type
        s = session.query(AppSettings).order_by(AppSettings.id.asc()).first()
        if not s:
            s = AppSettings()
            session.add(s)
            session.commit()
            session.refresh(s)
        published_at = datetime.now(timezone.utc)
        if type == "inbound":
            s.kb_version_inbound = int((s.kb_version_inbound or 0) + 1)
            version = int(s.kb_version_inbound or 0)
        else:
            s.kb_version_outbound = int((s.kb_version_outbound or 0) + 1)
            version = int(s.kb_version_outbound or 0)
        session.commit()
    # TODO: integrate Retell Knowledge Base Sources API with RETELL_API_KEY when available
    return {"published": True, "payload": payload, "version": version, "published_at": published_at.isoformat(), "type": type}

# -----------------------------
# Database (SQLite for local dev)
# -----------------------------

class Base(DeclarativeBase):
    pass


class CallRecord(Base):
    __tablename__ = "calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    direction: Mapped[str] = mapped_column(String(16))
    provider: Mapped[str] = mapped_column(String(32), default="retell")
    to_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    from_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    provider_call_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="created")
    raw_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    audio_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class CallSegment(Base):
    __tablename__ = "call_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    provider_call_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    turn_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    speaker: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    start_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    end_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CallSummary(Base):
    __tablename__ = "summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    provider_call_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    bullets_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ScheduledCall(Base):
    __tablename__ = "scheduled_calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lead_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    to_number: Mapped[str] = mapped_column(String(32))
    from_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    agent_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    kb_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    campaign_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16), default="scheduled")  # scheduled|queued|done|canceled
    provider_call_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class BatchItem(BaseModel):
    to: str
    from_number: Optional[str] = None
    delay_ms: int = 0
    metadata: Optional[dict] = None
    agent_id: Optional[str] = None
    kb_id: Optional[int] = None


@app.post("/schedule")
async def schedule_call(request: Request, item: BatchItem) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        _enforce_subscription_or_raise(session, request)
        _enforce_budget_or_raise(session, request)
    when = datetime.now(timezone.utc) + timedelta(milliseconds=int(max(0, item.delay_ms or 0)))
    with Session(engine) as session:
        sc = ScheduledCall(
            tenant_id=tenant_id,
            lead_id=None,
            to_number=item.to,
            from_number=item.from_number,
            agent_id=item.agent_id,
            kb_id=item.kb_id,
            metadata_json=json.dumps(item.metadata or {}),
            scheduled_at=when,
            status="scheduled",
        )
        session.add(sc)
        session.commit()
    # Enqueue via worker with delay
    actor = None
    try:
        spec = importlib.util.spec_from_file_location("backend.worker", str(BACKEND_DIR / "worker.py"))
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            actor = getattr(mod, "start_phone_call", None)
    except Exception:
        actor = None
    if actor is not None:
        actor.send_with_options(
            args=(item.to, tenant_id, item.from_number, item.agent_id, item.metadata, item.delay_ms, None),
            delay=int(max(0, item.delay_ms or 0)),
        )
        with Session(engine) as session:
            row = session.get(ScheduledCall, sc.id)
            if row:
                row.status = "queued"
                session.commit()
    return {"ok": True, "id": sc.id}


@app.post("/schedule/bulk")
async def schedule_bulk(request: Request, items: List[BatchItem]) -> Dict[str, Any]:
    with Session(engine) as session:
        _enforce_subscription_or_raise(session, request)
        _enforce_budget_or_raise(session, request)
    ok = 0
    for it in items:
        try:
            await schedule_call(request, it)
            ok += 1
        except Exception:
            pass
    return {"accepted": ok}


@app.get("/calendar")
async def calendar_events(request: Request, start: Optional[str] = None, end: Optional[str] = None) -> List[Dict[str, Any]]:
    tenant_id = extract_tenant_id(request)
    start_dt = datetime.fromisoformat(start) if start else (datetime.now(timezone.utc) - timedelta(days=7))
    end_dt = datetime.fromisoformat(end) if end else (datetime.now(timezone.utc) + timedelta(days=30))
    events: List[Dict[str, Any]] = []
    with Session(engine) as session:
        # scheduled
        q = session.query(ScheduledCall).filter(ScheduledCall.scheduled_at >= start_dt).filter(ScheduledCall.scheduled_at <= end_dt)
        if tenant_id is not None:
            q = q.filter(ScheduledCall.tenant_id == tenant_id)
        for s in q.order_by(ScheduledCall.scheduled_at.asc()).all():
            events.append({
                "id": f"sched-{s.id}",
                "title": f"Scheduled: {s.to_number}",
                "start": s.scheduled_at.isoformat(),
                "status": s.status,
                "kind": "scheduled",
            })
        # calls done
        q2 = session.query(CallRecord).filter(CallRecord.created_at >= start_dt).filter(CallRecord.created_at <= end_dt)
        if tenant_id is not None:
            q2 = q2.filter(CallRecord.tenant_id == tenant_id)
        for r in q2.order_by(CallRecord.created_at.desc()).all():
            events.append({
                "id": f"call-{r.id}",
                "title": f"Call: {r.to_number}",
                "start": r.created_at.isoformat(),
                "status": r.status,
                "kind": "call",
            })
    return events


class ScheduleUpdate(BaseModel):
    cancel: Optional[bool] = None
    scheduled_at: Optional[str] = None


@app.patch("/schedule/{sched_id}")
async def update_schedule(request: Request, sched_id: int, body: ScheduleUpdate) -> Dict[str, Any]:
    with Session(engine) as session:
        _enforce_subscription_or_raise(session, request)
        row = session.get(ScheduledCall, sched_id)
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        if body.cancel:
            row.status = "canceled"
            session.commit()
            await manager.broadcast({"type": "schedule.canceled", "data": {"id": sched_id}})
            return {"ok": True}
        if body.scheduled_at:
            try:
                when = datetime.fromisoformat(body.scheduled_at)
                row.scheduled_at = when
                row.status = "scheduled"
                session.commit()
                await manager.broadcast({"type": "schedule.updated", "data": {"id": sched_id, "scheduled_at": when.isoformat()}})
                return {"ok": True}
            except Exception:
                raise HTTPException(status_code=400, detail="invalid scheduled_at")
    return {"ok": False}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    email: Mapped[str] = mapped_column(String(256))
    name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    password_salt: Mapped[str] = mapped_column(String(64))
    password_hash: Mapped[str] = mapped_column(String(128))
    is_admin: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# -----------------------------
# Billing (plans/subscriptions/usage/addons/entitlements)
# -----------------------------

class Plan(Base):
    __tablename__ = "plans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32))  # free|core|pro|enterprise
    monthly_fee_cents: Mapped[int] = mapped_column(Integer, default=0)
    minute_price_cents: Mapped[int] = mapped_column(Integer, default=0)
    features_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    plan_code: Mapped[str] = mapped_column(String(32), default="free")
    status: Mapped[str] = mapped_column(String(32), default="trialing")  # active|trialing|past_due|canceled
    renews_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class UsageEvent(Base):
    __tablename__ = "usage_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    minutes_billed: Mapped[int] = mapped_column(Integer, default=0)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    synced_to_stripe: Mapped[int] = mapped_column(Integer, default=0)


@app.get("/billing/overview")
async def billing_overview(request: Request) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        sub = (
            session.query(Subscription)
            .filter(Subscription.tenant_id == (tenant_id or 0))
            .order_by(Subscription.id.desc())
            .first()
        )
        plan = (sub.plan_code if sub else "free")
        status = (sub.status if sub else "trialing")
        # minutes month-to-date
        start_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        usage = (
            session.query(UsageEvent)
            .filter(UsageEvent.ts >= start_month)
            .filter((UsageEvent.tenant_id == (tenant_id or 0)) if tenant_id is not None else True)
            .all()
        )
        minutes = sum(int(u.minutes_billed or 0) for u in usage)
        # trial info for free plan
        trial_days_left = None
        trial_expires_at = None
        if sub and (sub.plan_code or "free") == "free" and (sub.status or "trialing") == "trialing":
            started = sub.created_at or datetime.now(timezone.utc)
            delta_days = (datetime.now(timezone.utc) - started).days
            left = max(0, 14 - delta_days)
            trial_days_left = left
            trial_expires_at = (started + timedelta(days=14)).isoformat()
    # plan caps (simple heuristics, could be moved to config)
    plan_lower = (plan or "free").lower()
    minutes_cap = None if plan_lower == "pro" else (1000 if plan_lower == "core" else 100)
    return {"plan": plan, "status": status, "minutes_month_to_date": minutes, "minutes_cap": minutes_cap, "trial_days_left": trial_days_left, "trial_expires_at": trial_expires_at}


@app.get("/me/usage")
async def me_usage(request: Request) -> Dict[str, Any]:
    """Lightweight usage snapshot used by the topbar UsageBar.
    Returns same structure of billing overview for convenience.
    """
    return await billing_overview(request)


@app.get("/templates")
async def list_templates():
    return {
        "items": [
            {"id": "rfq-it", "name": "RFQ – IT", "lang": "it-IT", "desc": "Richiesta preventivo in italiano"},
            {"id": "demo-fr", "name": "Demo – FR", "lang": "fr-FR", "desc": "Campagna demo in francese"},
            {"id": "reorder-ar", "name": "Reorder – AR", "lang": "ar-EG", "desc": "Riordino clienti in arabo"},
        ]
    }


@app.post("/templates/apply")
async def apply_template(request: Request, payload: Dict[str, Any] = Body(...)):
    tpl_id = (payload or {}).get("template_id")
    if not tpl_id:
        raise HTTPException(status_code=400, detail="template_id required")
    # Minimal: create a campaign and a few demo leads according to template
    tenant_id = extract_tenant_id(request)
    lang_map = {"rfq-it": "it-IT", "demo-fr": "fr-FR", "reorder-ar": "ar-EG"}
    default_names = {
        "rfq-it": [
            ("Giulia Rossi", "+39020000001", "Milanotech"),
            ("Luca Bianchi", "+39020000002", "Bianchi SRL"),
            ("Sara Verdi", "+39020000003", "Verdi SpA"),
        ],
        "demo-fr": [
            ("Camille Dupont", "+33170000001", "Dupont SA"),
            ("Louis Martin", "+33170000002", "Martin SARL"),
            ("Emma Bernard", "+33170000003", "Bernard SAS"),
        ],
        "reorder-ar": [
            ("Omar Nasser", "+20220000001", "Nasser Co"),
            ("Layla Hassan", "+20220000002", "Hassan LLC"),
            ("Yusuf Ali", "+20220000003", "Ali Traders"),
        ],
    }
    with tenant_session(request) as session:
        c = Campaign(name=f"{tpl_id}", status="active", tenant_id=tenant_id)
        session.add(c)
        session.commit()
        session.refresh(c)
        lang = lang_map.get(tpl_id, "en-US")
        for nm, ph, co in default_names.get(tpl_id, []):
            l = Lead(
                name=nm,
                phone=ph,
                company=co,
                preferred_lang=lang,
                consent_status="unknown",
                tenant_id=tenant_id,
                campaign_id=c.id,
            )
            session.add(l)
        session.commit()
        return {"ok": True, "campaign_id": c.id, "template_id": tpl_id}


def _plan_entitlements(plan_code: str) -> Dict[str, Any]:
    if plan_code == "enterprise":
        return {
            "calendar_full": True,
            "calendar_week_day": True,
            "workflows_limit": None,
            "languages_allowance": None,
            "integrations": ["hubspot", "zoho", "odoo", "csv"],
            "analytics_advanced": True,
            "roles_enabled": True,
            "sso": True,
            "sla": True,
            "data_residency": "EU",
            "retention_custom": True,
            "premium_models": True,
            "byo_telephony": True,
            "custom_integrations": True,
            "success_manager": True,
        }
    if plan_code == "pro":
        return {
            "calendar_full": True,
            "calendar_week_day": True,
            "workflows_limit": None,
            "languages_allowance": None,
            "integrations": ["hubspot", "zoho", "odoo", "csv"],
            "analytics_advanced": True,
            "roles_enabled": True,
        }
    if plan_code == "core":
        return {
            "calendar_full": False,
            "calendar_week_day": True,
            "workflows_limit": 3,
            "languages_allowance": 3,
            "integrations": ["hubspot", "zoho", "odoo", "csv"],
        }
    # free
    return {
        "calendar_full": False,
        "calendar_week_day": False,
        "workflows_limit": 0,
        "languages_allowance": 1,
        "integrations": ["csv"],
    }


@app.get("/entitlements")
async def get_entitlements(request: Request) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        sub = (
            session.query(Subscription)
            .filter(Subscription.tenant_id == (tenant_id or 0))
            .order_by(Subscription.id.desc())
            .first()
        )
        base = _plan_entitlements(sub.plan_code if sub else "free")
        # apply addons
        addons = session.query(Addon).filter(Addon.tenant_id == (tenant_id or 0), Addon.active == 1).all()
        inbound_slots = 0
        for a in addons:
            if a.type == "inbound_slot" and a.qty and a.qty > 0:
                inbound_slots += int(a.qty)
        base["inbound_enabled"] = inbound_slots > 0
        base["inbound_slots"] = inbound_slots
        # overrides
        rows = session.query(Entitlement).filter(Entitlement.tenant_id == (tenant_id or 0)).all()
        for e in rows:
            try:
                base[e.key] = json.loads(e.value) if e.value else True
            except Exception:
                base[e.key] = e.value
    return base


@app.post("/billing/usage/sync")
async def billing_usage_sync() -> Dict[str, Any]:
    # Minimal: mark all unsynced as synced; Stripe integration to be added when credentials are present
    with Session(engine) as session:
        rows = session.query(UsageEvent).filter(UsageEvent.synced_to_stripe == 0).all()
        count = 0
        for r in rows:
            r.synced_to_stripe = 1
            count += 1
        session.commit()
    return {"synced": count}


class AddonUpdate(BaseModel):
    qty: int


@app.get("/addons")
async def list_addons(request: Request) -> List[Dict[str, Any]]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        rows = session.query(Addon).filter(Addon.tenant_id == (tenant_id or 0)).all()
        return [{"id": a.id, "type": a.type, "qty": a.qty, "active": bool(a.active)} for a in rows]


@app.post("/addons/inbound_slot")
async def set_inbound_slots(request: Request, body: AddonUpdate) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        row = (
            session.query(Addon)
            .filter(Addon.tenant_id == (tenant_id or 0), Addon.type == "inbound_slot")
            .one_or_none()
        )
        if not row:
            row = Addon(tenant_id=(tenant_id or 0), type="inbound_slot", qty=max(0, int(body.qty or 0)))
            session.add(row)
        else:
            row.qty = max(0, int(body.qty or 0))
            row.active = 1 if row.qty > 0 else 0
        session.commit()
    return {"ok": True}


# -----------------------------
# Workflow Metering (emails + usage)
# -----------------------------


class WorkflowUsage(Base):
    __tablename__ = "workflow_usage"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    emails_sent: Mapped[int] = mapped_column(Integer, default=0)
    webhooks_sent: Mapped[int] = mapped_column(Integer, default=0)
    actions_executed: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WorkflowEmailEvent(Base):
    __tablename__ = "workflow_email_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    workflow_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    to_email: Mapped[str] = mapped_column(String(256))
    template_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    billed: Mapped[int] = mapped_column(Integer, default=0)


class EmailProviderSettings(Base):
    __tablename__ = "email_provider_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    provider: Mapped[str] = mapped_column(String(16), default="postmark")
    api_key_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    from_email: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


def _email_quota_for_plan(plan_code: str) -> Optional[int]:
    if plan_code == "free":
        return 100
    if plan_code == "core":
        return 1000
    if plan_code == "pro":
        return 5000
    return None  # enterprise/custom


class WorkflowEmailSend(BaseModel):
    to: str
    template_id: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    workflow_id: Optional[int] = None


@app.post("/workflows/email/send")
async def workflows_email_send(request: Request, body: WorkflowEmailSend) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    # Subscription gating
    with Session(engine) as session:
        _enforce_subscription_or_raise(session, request)

    # Rate-limit 60/min with burst ~120
    r = get_redis()
    if r is not None and tenant_id is not None:
        key = f"rl:wfemail:{tenant_id}:{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
        try:
            n = r.incr(key)
            r.expire(key, 120)
            if n > 120:
                raise HTTPException(status_code=429, detail="rate limit")
        except Exception:
            pass

    # Quota check and record usage
    with Session(engine) as session:
        sub = (
            session.query(Subscription)
            .filter(Subscription.tenant_id == (tenant_id or 0))
            .order_by(Subscription.id.desc())
            .first()
        )
        plan = sub.plan_code if sub else "free"
        quota = _email_quota_for_plan(plan)
        month = datetime.now(timezone.utc).strftime("%Y-%m")
        usage = (
            session.query(WorkflowUsage)
            .filter(WorkflowUsage.tenant_id == (tenant_id or 0), WorkflowUsage.month == month)
            .one_or_none()
        )
        if not usage:
            usage = WorkflowUsage(tenant_id=(tenant_id or 0), month=month, emails_sent=0)
            session.add(usage)
            session.commit()
            session.refresh(usage)
        if quota is not None and usage.emails_sent >= quota and plan == "free":
            raise HTTPException(status_code=402, detail="Email quota exceeded for Free plan")
        ev = WorkflowEmailEvent(
            tenant_id=(tenant_id or 0), workflow_id=body.workflow_id, to_email=body.to, template_id=body.template_id
        )
        usage.emails_sent = int((usage.emails_sent or 0) + 1)
        usage.updated_at = datetime.now(timezone.utc)
        session.add(ev)
        session.commit()
    return {"queued": True}


@app.get("/workflows/usage")
async def workflows_usage(request: Request) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        sub = (
            session.query(Subscription)
            .filter(Subscription.tenant_id == (tenant_id or 0))
            .order_by(Subscription.id.desc())
            .first()
        )
        plan = sub.plan_code if sub else "free"
        quota = _email_quota_for_plan(plan)
        month = datetime.now(timezone.utc).strftime("%Y-%m")
        usage = (
            session.query(WorkflowUsage)
            .filter(WorkflowUsage.tenant_id == (tenant_id or 0), WorkflowUsage.month == month)
            .one_or_none()
        )
        sent = int(usage.emails_sent) if usage else 0
        over = max(0, sent - (quota or sent))
        est = round(over * 0.001, 4)
    return {"month": month, "plan": plan, "emails_sent": sent, "emails_quota": quota, "emails_over_quota_estimate_usd": est}


class Addon(Base):
    __tablename__ = "addons"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(32))  # inbound_slot|lang_pack|storage
    qty: Mapped[int] = mapped_column(Integer, default=0)
    unit_price_cents: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[int] = mapped_column(Integer, default=1)


class Entitlement(Base):
    __tablename__ = "entitlements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    key: Mapped[str] = mapped_column(String(64))
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    source: Mapped[str] = mapped_column(String(16), default="plan")  # plan|addon|override


class UserPlanOverride(Base):
    __tablename__ = "user_plan_overrides"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    user_id: Mapped[int] = mapped_column(Integer)
    key: Mapped[str] = mapped_column(String(64))
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


DB_PATH = BACKEND_DIR / "data.db"
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    engine = create_engine(DATABASE_URL, echo=False, future=True, pool_pre_ping=True)
else:
    engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, future=True)

# Try to create tables, but don't fail startup if DB is not available yet
# In production, use Alembic migrations: `alembic upgrade head`
try:
    Base.metadata.create_all(engine)
except Exception as e:
    import sys
    print(f"Warning: Could not create database tables at startup: {e}", file=sys.stderr)
    print("Database will be initialized via Alembic migrations.", file=sys.stderr)

# Allow local dev origins (Vite default: 5173)
front_origin = os.getenv("FRONTEND_ORIGIN")
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if front_origin:
    origins += [front_origin]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


def extract_tenant_id(request: Optional[Request]) -> Optional[int]:
    # Try bearer token first
    try:
        if request is not None:
            auth = request.headers.get("Authorization") or ""
            if auth.startswith("Bearer "):
                token = auth[7:]
                payload = _decode_token(token)
                tid = payload.get("tenant_id")
                if tid is not None:
                    return int(tid)
    except Exception:
        pass
    try:
        if request is None:
            return None
        v = request.headers.get("X-Tenant-Id") or request.query_params.get("tenant_id")
        return int(v) if v is not None and str(v).isdigit() else None
    except Exception:
        return None


def _live_calls_count(tenant_id: Optional[int], hours: int = 6) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max(1, min(hours, 48)))
    with Session(engine) as session:
        q = session.query(CallRecord).filter(CallRecord.created_at >= cutoff).filter(CallRecord.status != "ended")
        if tenant_id is not None:
            q = q.filter(CallRecord.tenant_id == tenant_id)
        return q.count()


def _is_postgres() -> bool:
    return bool(DATABASE_URL and not str(DATABASE_URL).startswith("sqlite"))


def _set_tenant_session(session: Session, tenant_id: Optional[int]) -> None:
    if _is_postgres():
        try:
            session.execute("SET app.tenant_id = :tid", {"tid": int(tenant_id or 0)})
        except Exception:
            pass


@contextmanager
def tenant_session(request: Optional[Request]):
    tenant_id = extract_tenant_id(request)
    session = Session(engine)
    _set_tenant_session(session, tenant_id)
    try:
        yield session
    finally:
        session.close()


def _compute_signature(secret: str, payload: bytes) -> str:
    mac = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256)
    return mac.hexdigest()


def _hash_password(password: str, salt: Optional[bytes] = None) -> Tuple[str, str]:
    salt_bytes = salt or os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, 100_000)
    return salt_bytes.hex(), dk.hex()


def _verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    salt = bytes.fromhex(salt_hex)
    _, computed = _hash_password(password, salt)
    return hmac.compare_digest(computed, hash_hex)


def _encode_token(payload: Dict[str, Any]) -> str:
    secret = os.getenv("JWT_SECRET", "devsecret")
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    body_b64 = base64.urlsafe_b64encode(body).rstrip(b"=")
    sig = hmac.new(secret.encode("utf-8"), body_b64, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=")
    return f"{body_b64.decode('ascii')}.{sig_b64.decode('ascii')}"


def _decode_token(token: str) -> Dict[str, Any]:
    secret = os.getenv("JWT_SECRET", "devsecret")
    body_b64, sig_b64 = token.split(".")
    body_bytes = base64.urlsafe_b64decode(body_b64 + "==")
    expected_sig = hmac.new(secret.encode("utf-8"), body_b64.encode("ascii"), hashlib.sha256).digest()
    if not hmac.compare_digest(base64.urlsafe_b64encode(expected_sig).rstrip(b"="), sig_b64.encode("ascii")):
        raise HTTPException(status_code=401, detail="invalid token")
    payload = json.loads(body_bytes.decode("utf-8"))
    exp = payload.get("exp")
    if exp and datetime.now(timezone.utc).timestamp() > float(exp):
        raise HTTPException(status_code=401, detail="expired token")
    return payload


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    event_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    processed: Mapped[int] = mapped_column(Integer, default=0)
    raw_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class WebhookDLQ(Base):
    __tablename__ = "webhook_dlq"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    event_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Disposition(Base):
    __tablename__ = "dispositions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CallMedia(Base):
    __tablename__ = "call_media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    audio_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CallStructured(Base):
    __tablename__ = "call_structured"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    bant_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    trade_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CostEvent(Base):
    __tablename__ = "cost_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    component: Mapped[str] = mapped_column(String(32))  # telephony | llm | stt | tts
    amount: Mapped[int] = mapped_column(Integer)  # store cents to avoid FP
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


@app.get("/metrics/jobstats")
async def metrics_jobstats() -> Dict[str, Any]:
    r = get_redis()
    if r is None:
        return {"started": 0, "succeeded": 0, "failed": 0}
    try:
        started = int(r.get("metrics:jobs:started") or 0)
        succeeded = int(r.get("metrics:jobs:succeeded") or 0)
        failed = int(r.get("metrics:jobs:failed") or 0)
        return {"started": started, "succeeded": succeeded, "failed": failed}
    except Exception:
        return {"started": 0, "succeeded": 0, "failed": 0}


# ---------------------------------
# CRM canonical: connection & mapping
# ---------------------------------

class CRMConnection(Base):
    __tablename__ = "crm_connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    provider: Mapped[str] = mapped_column(String(32))  # hubspot | zoho | salesforce | pipedrive | ...
    auth_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    enabled: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CRMMappings(Base):
    __tablename__ = "crm_mappings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    provider: Mapped[str] = mapped_column(String(32))
    object_type: Mapped[str] = mapped_column(String(32))  # company | contact | lead | deal | activity | owner
    field_map_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# Try to create tables, but don't fail startup if DB is not available yet
try:
    Base.metadata.create_all(engine)
except Exception as e:
    import sys
    print(f"Warning: Could not create database tables: {e}", file=sys.stderr)


# -----------------------------
# CRM endpoints (stub MVP)
# -----------------------------

class CRMConnectionCreate(BaseModel):
    provider: str
    auth: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = True


@app.get("/crm/connections")
async def list_crm_connections(request: Request) -> List[Dict[str, Any]]:
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        q = session.query(CRMConnection)
        if tenant_id is not None:
            q = q.filter(CRMConnection.tenant_id == tenant_id)
        rows = q.order_by(CRMConnection.created_at.desc()).all()
        return [
            {
                "id": r.id,
                "provider": r.provider,
                "enabled": bool(r.enabled),
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]


@app.post("/crm/connections")
async def create_crm_connection(request: Request, body: CRMConnectionCreate):
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        row = CRMConnection(
            tenant_id=tenant_id,
            provider=body.provider,
            auth_json=json.dumps(body.auth or {}),
            enabled=1 if (body.enabled is None or body.enabled) else 0,
        )
        session.add(row)
        session.commit()
        return {"id": row.id}


# -----------------------------
# OAuth HubSpot (MVP)
# -----------------------------

class HubSpotAuthStart(BaseModel):
    redirect_uri: str
    scopes: Optional[str] = "crm.objects.companies.read crm.objects.contacts.read crm.objects.deals.read crm.objects.owners.read crm.objects.contacts.write crm.objects.deals.write crm.objects.companies.write"


@app.post("/crm/hubspot/auth/start")
async def hubspot_auth_start(request: Request, body: HubSpotAuthStart):
    # Build the HS OAuth URL
    client_id = os.getenv("HUBSPOT_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="HUBSPOT_CLIENT_ID missing")
    params = {
        "client_id": client_id,
        "redirect_uri": body.redirect_uri,
        "scope": body.scopes,
        "response_type": "code",
    }
    url = f"https://app.hubspot.com/oauth/authorize?{urllib.parse.urlencode(params)}"
    return {"auth_url": url}


class HubSpotAuthCallback(BaseModel):
    redirect_uri: str
    code: str


@app.post("/crm/hubspot/auth/callback")
async def hubspot_auth_callback(request: Request, body: HubSpotAuthCallback):
    tenant_id = extract_tenant_id(request)
    token_url = "https://api.hubapi.com/oauth/v1/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": os.getenv("HUBSPOT_CLIENT_ID"),
        "client_secret": os.getenv("HUBSPOT_CLIENT_SECRET"),
        "redirect_uri": body.redirect_uri,
        "code": body.code,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(token_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=str(resp.text))
        tok = resp.json()
    # Save tokens to CRMConnection (create or update)
    with tenant_session(request) as session:
        row = (
            session.query(CRMConnection)
            .filter(CRMConnection.provider == "hubspot")
            .filter(CRMConnection.tenant_id == tenant_id)
            .one_or_none()
        )
        payload = {"access_token": tok.get("access_token"), "refresh_token": tok.get("refresh_token"), "expires_in": tok.get("expires_in")}
        if not row:
            row = CRMConnection(tenant_id=tenant_id, provider="hubspot", auth_json=json.dumps(payload), enabled=1)
            session.add(row)
        else:
            row.auth_json = json.dumps(payload)
            row.updated_at = datetime.now(timezone.utc)
        session.commit()
    return {"ok": True}


# -----------------------------
# OAuth Google Calendar (MVP)
# -----------------------------

class GoogleAuthStart(BaseModel):
    redirect_uri: str
    scopes: Optional[str] = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.readonly"


@app.post("/integrations/google/auth/start")
async def google_auth_start(body: GoogleAuthStart):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID missing")
    params = {
        "client_id": client_id,
        "redirect_uri": body.redirect_uri,
        "response_type": "code",
        "scope": body.scopes,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return {"auth_url": url}


class GoogleAuthCallback(BaseModel):
    redirect_uri: str
    code: str


@app.post("/integrations/google/auth/callback")
async def google_auth_callback(request: Request, body: GoogleAuthCallback):
    tenant_id = extract_tenant_id(request)
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
        "redirect_uri": body.redirect_uri,
        "code": body.code,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(token_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=str(resp.text))
        tok = resp.json()
    with tenant_session(request) as session:
        row = (
            session.query(CRMConnection)
            .filter(CRMConnection.provider == "google_calendar")
            .filter(CRMConnection.tenant_id == tenant_id)
            .one_or_none()
        )
        payload = {"access_token": tok.get("access_token"), "refresh_token": tok.get("refresh_token"), "expires_in": tok.get("expires_in")}
        if not row:
            row = CRMConnection(tenant_id=tenant_id, provider="google_calendar", auth_json=json.dumps(payload), enabled=1)
            session.add(row)
        else:
            row.auth_json = json.dumps(payload)
            row.updated_at = datetime.now(timezone.utc)
        session.commit()
    return {"ok": True}


# -----------------------------
# Google OAuth login (passwordless)
# -----------------------------

class GoogleLoginStart(BaseModel):
    redirect_uri: str


@app.post("/auth/google/start")
async def auth_google_start(body: GoogleLoginStart):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID missing")
    scopes = "openid email profile"
    params = {
        "client_id": client_id,
        "redirect_uri": body.redirect_uri,
        "response_type": "code",
        "scope": scopes,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return {"auth_url": url}


class GoogleLoginCallback(BaseModel):
    redirect_uri: str
    code: str


def _decode_jwt_no_verify(id_token: str) -> Dict[str, Any]:
    try:
        parts = id_token.split(".")
        if len(parts) < 2:
            return {}
        payload_b64 = parts[1]
        padding = "=" * (-len(payload_b64) % 4)
        payload = base64.urlsafe_b64decode(payload_b64 + padding)
        return _json.loads(payload.decode("utf-8"))
    except Exception:
        return {}


@app.post("/auth/google/callback")
async def auth_google_callback(body: GoogleLoginCallback):
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
        "redirect_uri": body.redirect_uri,
        "code": body.code,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(token_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=str(resp.text))
        tok = resp.json()
    id_token = tok.get("id_token") or ""
    info = _decode_jwt_no_verify(id_token)
    email = (info.get("email") or "").lower()
    name = info.get("name") or info.get("given_name") or email.split("@")[0]
    if not email:
        raise HTTPException(status_code=400, detail="no email in id_token")
    with Session(engine) as session:
        user = session.query(User).filter(User.email == email).one_or_none()
        if not user:
            salt, h = _hash_password(os.urandom(16).hex())
            user = User(tenant_id=0, email=email, name=name, password_salt=salt, password_hash=h)
            session.add(user)
            session.commit()
            user.tenant_id = user.id
            session.commit()
        token = _encode_token({"sub": user.id, "tenant_id": user.tenant_id, "is_admin": bool(user.is_admin), "exp": (datetime.now(timezone.utc) + timedelta(days=7)).timestamp()})
        return {"token": token, "tenant_id": user.tenant_id, "is_admin": bool(user.is_admin)}
# -----------------------------
# Simple email/password auth (MVP)
# -----------------------------

class AuthRegister(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    admin_secret: Optional[str] = None


@app.post("/auth/register")
async def auth_register(body: AuthRegister):
    with Session(engine) as session:
        existing = session.query(User).filter(User.email == body.email.lower()).one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="email exists")
        salt, h = _hash_password(body.password)
        # naive tenant: use incremental per user for now
        is_admin = 1 if (body.admin_secret and body.admin_secret == os.getenv("ADMIN_SIGNUP_SECRET")) else 0
        user = User(tenant_id=0, email=body.email.lower(), name=body.name, password_salt=salt, password_hash=h, is_admin=is_admin)
        session.add(user)
        session.commit()
        # set tenant_id=user.id for isolation
        user.tenant_id = user.id
        session.commit()
        token = _encode_token({"sub": user.id, "tenant_id": user.tenant_id, "is_admin": bool(user.is_admin), "exp": (datetime.now(timezone.utc) + timedelta(days=7)).timestamp()})
        return {"token": token, "tenant_id": user.tenant_id, "is_admin": bool(user.is_admin)}


class AuthLogin(BaseModel):
    email: str
    password: str


@app.post("/auth/login")
async def auth_login(body: AuthLogin):
    with Session(engine) as session:
        user = session.query(User).filter(User.email == body.email.lower()).one_or_none()
        if not user or not _verify_password(body.password, user.password_salt, user.password_hash):
            raise HTTPException(status_code=401, detail="invalid credentials")
        token = _encode_token({"sub": user.id, "tenant_id": user.tenant_id, "is_admin": bool(user.is_admin), "exp": (datetime.now(timezone.utc) + timedelta(days=7)).timestamp()})
        return {"token": token, "tenant_id": user.tenant_id, "is_admin": bool(user.is_admin)}


class CRMMappingsUpsert(BaseModel):
    provider: str
    object_type: str
    field_map: Dict[str, Any]


@app.get("/crm/mappings")
async def get_crm_mappings(request: Request, provider: str, object_type: Optional[str] = None):
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        q = session.query(CRMMappings).filter(CRMMappings.provider == provider)
        if tenant_id is not None:
            q = q.filter(CRMMappings.tenant_id == tenant_id)
        if object_type:
            q = q.filter(CRMMappings.object_type == object_type)
        rows = q.all()
        return [
            {
                "provider": r.provider,
                "object_type": r.object_type,
                "field_map": json.loads(r.field_map_json or "{}"),
                "updated_at": r.updated_at.isoformat(),
            }
            for r in rows
        ]


@app.put("/crm/mappings")
async def upsert_crm_mapping(request: Request, body: CRMMappingsUpsert):
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        row = (
            session.query(CRMMappings)
            .filter(CRMMappings.provider == body.provider)
            .filter(CRMMappings.object_type == body.object_type)
            .filter(CRMMappings.tenant_id == tenant_id)
            .one_or_none()
        )
        if not row:
            row = CRMMappings(
                tenant_id=tenant_id,
                provider=body.provider,
                object_type=body.object_type,
                field_map_json=json.dumps(body.field_map or {}),
            )
            session.add(row)
        else:
            row.field_map_json = json.dumps(body.field_map or {})
            row.updated_at = datetime.now(timezone.utc)
        session.commit()
        return {"ok": True}


SUGGESTIONS: Dict[str, Dict[str, Dict[str, str]]] = {
    "hubspot": {
        "company": {
            "name": "name",
            "domain": "domain",
            "industry": "industry",
            "employee_count": "numberofemployees",
            "annual_revenue": "annualrevenue",
        },
        "contact": {
            "first_name": "firstname",
            "last_name": "lastname",
            "email": "email",
            "phone_e164": "phone",
            "mobile_e164": "mobilephone",
            "language": "hs_language",
        },
        "deal": {
            "name": "dealname",
            "amount": "amount",
            "currency": "currency",
            "stage": "dealstage",
            "pipeline_id": "pipeline",
            "close_date": "closedate",
        },
        "activity": {
            "type": "engagement.type",
            "timestamp": "hs_timestamp",
            "duration_s": "hs_call_duration",
            "recording_url": "hs_call_recording_url",
            "subject": "hs_call_body",
            "disposition": "hs_call_disposition",
        },
    },
    "zoho": {
        "company": {"name": "Account_Name", "domain": "Website", "industry": "Industry"},
        "contact": {"first_name": "First_Name", "last_name": "Last_Name", "email": "Email", "phone_e164": "Phone", "mobile_e164": "Mobile"},
        "deal": {"name": "Deal_Name", "amount": "Amount", "stage": "Stage", "close_date": "Closing_Date"},
        "activity": {"type": "SEModule", "timestamp": "Created_Time", "duration_s": "Call_Duration", "recording_url": "Recording_URL"},
    },
    "salesforce": {
        "company": {"name": "Name", "domain": "Website", "industry": "Industry"},
        "contact": {"first_name": "FirstName", "last_name": "LastName", "email": "Email", "phone_e164": "Phone"},
        "deal": {"name": "Name", "amount": "Amount", "currency": "CurrencyIsoCode", "stage": "StageName", "close_date": "CloseDate"},
        "activity": {"type": "Subject", "timestamp": "ActivityDateTime", "duration_s": "CallDurationInSeconds", "recording_url": "Description"},
    },
    "pipedrive": {
        "company": {"name": "name", "domain": "domain"},
        "contact": {"first_name": "first_name", "last_name": "last_name", "email": "email", "phone_e164": "phone"},
        "deal": {"name": "title", "amount": "value", "stage": "stage_id"},
        "activity": {"type": "type", "timestamp": "due_time", "duration_s": "duration", "recording_url": "note"},
    },
    "freshsales": {
        "company": {"name": "name", "domain": "website", "industry": "industry"},
        "contact": {"first_name": "first_name", "last_name": "last_name", "email": "email", "phone_e164": "work_number", "mobile_e164": "mobile_number"},
        "deal": {"name": "name", "amount": "amount", "stage": "stage_id", "close_date": "expected_close"},
        "activity": {"type": "type", "timestamp": "created_at", "duration_s": "duration"},
    },
    "odoo": {
        "company": {"name": "name", "domain": "website"},
        "contact": {"first_name": "x_first_name", "last_name": "x_last_name", "email": "email", "phone_e164": "phone"},
        "deal": {"name": "name", "amount": "expected_revenue", "stage": "stage_id"},
        "activity": {"type": "subtype_id", "timestamp": "date"},
    },
    "bitrix": {
        "company": {"name": "TITLE", "domain": "WEB"},
        "contact": {"first_name": "NAME", "last_name": "LAST_NAME", "email": "EMAIL", "phone_e164": "PHONE"},
        "deal": {"name": "TITLE", "amount": "OPPORTUNITY", "stage": "STAGE_ID"},
        "activity": {"type": "TYPE_ID", "timestamp": "CREATED"},
    },
    "dynamics": {
        "company": {"name": "name", "domain": "websiteurl"},
        "contact": {"first_name": "firstname", "last_name": "lastname", "email": "emailaddress1", "phone_e164": "telephone1"},
        "deal": {"name": "name", "amount": "estimatedvalue", "stage": "stageid", "close_date": "estimatedclosedate"},
        "activity": {"type": "activitytypecode", "timestamp": "createdon"},
    },
}


@app.get("/crm/suggest_mapping")
async def crm_suggest_mapping(provider: str, object_type: str):
    prov = SUGGESTIONS.get(provider.lower(), {})
    return prov.get(object_type.lower(), {})


CANONICAL_KEYS: Dict[str, List[str]] = {
    "company": [
        "company_id", "name", "domain", "vat", "phone_e164", "country_iso",
        "city", "street", "postal_code", "industry", "employee_count",
        "annual_revenue", "website", "owner_user_id", "lifecycle_stage",
        "consent_basis", "consent_status", "consent_proof_url",
        "incoterms", "preferred_currency", "lead_time_days_default",
    ],
    "contact": [
        "contact_id", "first_name", "last_name", "email", "phone_e164",
        "title", "mobile_e164", "company_id", "owner_user_id", "language",
        "timezone", "lead_source", "utm_source", "utm_medium", "utm_campaign",
        "recording_consent", "marketing_opt_in",
    ],
    "lead": [
        "lead_id", "company_name_optional", "status", "score", "source",
        "phone_e164", "email", "qualified_at", "converted_contact_id",
        "converted_company_id",
    ],
    "deal": [
        "deal_id", "name", "amount", "currency", "pipeline_id", "stage",
        "close_date", "company_id", "primary_contact_id", "owner_user_id",
        "rfq", "moq", "lead_time_days", "incoterms", "delivery_country_iso",
        "trade_notes",
    ],
    "activity": [
        "activity_id", "type", "subject", "description", "timestamp",
        "duration_s", "related_to", "owner_user_id", "call_id_app",
        "recording_url", "transcript_url", "disposition", "qa_score_total",
        "bant_coverage", "trade_coverage",
    ],
    "owner": ["user_id", "email", "name", "timezone", "role"],
}


@app.get("/crm/canonical_schema")
async def crm_canonical_schema(object_type: str):
    keys = CANONICAL_KEYS.get(object_type.lower())
    if not keys:
        raise HTTPException(status_code=404, detail="Unknown object_type")
    return {"object_type": object_type, "keys": keys}


CANONICAL_EXAMPLES: Dict[str, Dict[str, Any]] = {
    "company": {
        "company_id": "00000000-0000-0000-0000-000000000001",
        "name": "ACME S.p.A.",
        "domain": "acme.it",
        "phone_e164": "+390212345678",
        "country_iso": "IT",
        "city": "Milano",
        "street": "Via Roma 1",
        "postal_code": "20100",
        "industry": "Manufacturing",
        "employee_count": 250,
        "annual_revenue": 12000000,
        "website": "https://acme.it",
    },
    "contact": {
        "contact_id": "00000000-0000-0000-0000-0000000000c1",
        "first_name": "Mario",
        "last_name": "Rossi",
        "email": "mario.rossi@acme.it",
        "phone_e164": "+39333111222",
        "mobile_e164": "+39344111222",
        "language": "it",
        "timezone": "Europe/Rome",
    },
    "lead": {
        "lead_id": "00000000-0000-0000-0000-0000000000l1",
        "company_name_optional": "ACME",
        "status": "new",
        "score": 42,
        "source": "website",
        "phone_e164": "+39333111222",
        "email": "rfq@acme.it",
    },
    "deal": {
        "deal_id": "00000000-0000-0000-0000-0000000000d1",
        "name": "RFQ ACME 2025-01",
        "amount": 15000,
        "currency": "EUR",
        "pipeline_id": "sales",
        "stage": "qualification",
        "close_date": "2025-12-31",
        "rfq": True,
        "incoterms": "FOB",
    },
    "activity": {
        "activity_id": "call-123",
        "type": "call",
        "subject": "Qualifica lead",
        "timestamp": "2025-01-10T10:00:00Z",
        "duration_s": 180,
        "recording_url": "https://r2.example/calls/123.mp3",
        "transcript_url": "https://r2.example/calls/123.json",
        "disposition": "qualified",
        "qa_score_total": 88,
    },
    "owner": {"user_id": "u-1", "email": "owner@acme.it", "name": "Owner", "timezone": "Europe/Rome", "role": "sales"},
}


@app.get("/crm/canonical_example")
async def crm_canonical_example(object_type: str):
    example = CANONICAL_EXAMPLES.get(object_type.lower())
    if not example:
        raise HTTPException(status_code=404, detail="Unknown object_type")
    return {"object_type": object_type, "example": example}


# -----------------------------
# Mapping presets (complete) for providers
# -----------------------------

PRESETS: Dict[str, Dict[str, Dict[str, str]]] = {
    "hubspot": {
        "company": {
            "name": "name",
            "domain": "domain",
            "phone_e164": "phone",
            "country_iso": "country",
            "city": "city",
            "street": "address",
            "postal_code": "zip",
            "industry": "industry",
            "employee_count": "numberofemployees",
            "annual_revenue": "annualrevenue",
            "website": "website",
            "owner_user_id": "hubspot_owner_id",
            "lifecycle_stage": "lifecyclestage",
            "consent_basis": "gdpr_consent_basis__custom",
            "consent_status": "gdpr_consent_status__custom",
            "consent_proof_url": "gdpr_consent_proof_url__custom",
        },
        "contact": {
            "first_name": "firstname",
            "last_name": "lastname",
            "email": "email",
            "phone_e164": "phone",
            "mobile_e164": "mobilephone",
            "title": "jobtitle",
            "owner_user_id": "hubspot_owner_id",
            "language": "hs_language",
            "lead_source": "lead_source",
            "utm_source": "utm_source__custom",
            "utm_medium": "utm_medium__custom",
            "utm_campaign": "utm_campaign__custom",
            "recording_consent": "recording_consent__custom",
            "marketing_opt_in": "legal_basis__custom",
        },
        "lead": {
            "company_name_optional": "company",
            "status": "hs_lead_status",
            "score": "hubspot_score",
            "source": "original_source",
            "phone_e164": "phone",
            "email": "email",
            "qualified_at": "qualified_at__custom",
        },
        "deal": {
            "name": "dealname",
            "amount": "amount",
            "currency": "currency",
            "pipeline_id": "pipeline",
            "stage": "dealstage",
            "close_date": "closedate",
            "owner_user_id": "hubspot_owner_id",
            "rfq": "rfq__custom",
            "moq": "moq__custom",
            "lead_time_days": "lead_time_days__custom",
            "incoterms": "incoterms__custom",
            "delivery_country_iso": "delivery_country__custom",
            "trade_notes": "trade_notes__custom",
        },
        "activity": {
            "type": "engagement.type",
            "timestamp": "hs_timestamp",
            "duration_s": "hs_call_duration",
            "subject": "hs_call_body",
            "description": "hs_call_body",
            "recording_url": "hs_call_recording_url",
            "disposition": "hs_call_disposition",
        },
        "owner": {"user_id": "id", "email": "email", "name": "firstName", "timezone": "timezone__custom", "role": "role__custom"},
    },
    "zoho": {
        "company": {
            "name": "Account_Name",
            "domain": "Website",
            "phone_e164": "Phone",
            "country_iso": "Billing_Country",
            "city": "Billing_City",
            "street": "Billing_Street",
            "postal_code": "Billing_Code",
            "industry": "Industry",
            "employee_count": "Employees",
            "annual_revenue": "Annual_Revenue",
            "website": "Website",
            "owner_user_id": "Owner",
        },
        "contact": {
            "first_name": "First_Name",
            "last_name": "Last_Name",
            "email": "Email",
            "phone_e164": "Phone",
            "mobile_e164": "Mobile",
            "title": "Title",
            "owner_user_id": "Owner",
            "language": "Language__custom",
            "lead_source": "Lead_Source",
        },
        "lead": {
            "company_name_optional": "Company",
            "status": "Lead_Status",
            "score": "Lead_Score",
            "source": "Lead_Source",
            "phone_e164": "Phone",
            "email": "Email",
            "qualified_at": "Qualified_At__custom",
        },
        "deal": {
            "name": "Deal_Name",
            "amount": "Amount",
            "currency": "Currency",
            "pipeline_id": "Pipeline",
            "stage": "Stage",
            "close_date": "Closing_Date",
            "owner_user_id": "Owner",
            "rfq": "RFQ__custom",
            "moq": "MOQ__custom",
            "lead_time_days": "Lead_Time_Days__custom",
            "incoterms": "Incoterms__custom",
            "delivery_country_iso": "Delivery_Country__custom",
            "trade_notes": "Trade_Notes__custom",
        },
        "activity": {
            "type": "SEModule",
            "timestamp": "Created_Time",
            "duration_s": "Call_Duration",
            "subject": "Subject",
            "description": "Description",
            "recording_url": "Recording_URL__custom",
        },
        "owner": {"user_id": "id", "email": "email", "name": "name"},
    },
    "pipedrive": {
        "company": {
            "name": "name",
            "domain": "domain",
            "phone_e164": "phone",
            "street": "address",
            "city": "address_city",
            "postal_code": "address_postal_code",
            "owner_user_id": "owner_id",
        },
        "contact": {
            "first_name": "first_name",
            "last_name": "last_name",
            "email": "email",
            "phone_e164": "phone",
            "mobile_e164": "phone",
            "owner_user_id": "owner_id",
        },
        "lead": {
            "company_name_optional": "organization_name",
            "status": "status",
            "score": "score__custom",
            "source": "source_name",
            "phone_e164": "phone",
            "email": "email",
        },
        "deal": {
            "name": "title",
            "amount": "value",
            "currency": "currency",
            "pipeline_id": "pipeline_id",
            "stage": "stage_id",
            "close_date": "expected_close_date",
            "owner_user_id": "user_id",
        },
        "activity": {
            "type": "type",
            "timestamp": "due_time",
            "duration_s": "duration",
            "subject": "subject",
            "description": "note",
            "recording_url": "note",
        },
        "owner": {"user_id": "id", "email": "email", "name": "name"},
    },
}


@app.get("/crm/mappings/preset")
async def crm_mappings_preset(provider: str, object_type: Optional[str] = None):
    prov = PRESETS.get(provider.lower())
    if not prov:
        raise HTTPException(status_code=404, detail="Unknown provider")
    if object_type:
        mapping = prov.get(object_type.lower(), {})
        return {"provider": provider, "object_type": object_type, "field_map": mapping}
    return {"provider": provider, "items": prov}


class CRMPresetApply(BaseModel):
    provider: str
    object_types: Optional[List[str]] = None


@app.post("/crm/mappings/apply_preset")
async def crm_apply_preset(request: Request, body: CRMPresetApply):
    tenant_id = extract_tenant_id(request)
    prov = PRESETS.get(body.provider.lower())
    if not prov:
        raise HTTPException(status_code=404, detail="Unknown provider")
    wanted = [k for k in (body.object_types or prov.keys()) if k in prov]
    with tenant_session(request) as session:
        for obj in wanted:
            mapping = prov[obj]
            row = (
                session.query(CRMMappings)
                .filter(CRMMappings.provider == body.provider.lower())
                .filter(CRMMappings.object_type == obj)
                .filter(CRMMappings.tenant_id == tenant_id)
                .one_or_none()
            )
            if not row:
                row = CRMMappings(
                    tenant_id=tenant_id,
                    provider=body.provider.lower(),
                    object_type=obj,
                    field_map_json=json.dumps(mapping),
                )
                session.add(row)
            else:
                row.field_map_json = json.dumps(mapping)
                row.updated_at = datetime.now(timezone.utc)
        session.commit()
    return {"ok": True, "applied": wanted}


class CRMValidateMapping(BaseModel):
    provider: str
    object_type: str
    field_map: Optional[Dict[str, Any]] = None


@app.post("/crm/validate_mapping")
async def crm_validate_mapping(request: Request, body: CRMValidateMapping):
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        field_map: Dict[str, Any] = body.field_map or _load_mapping(session, tenant_id, body.provider.lower(), body.object_type.lower())
        canonical = set(CANONICAL_KEYS.get(body.object_type.lower(), []))
        unknown_keys = [k for k in field_map.keys() if k not in canonical]
        empty_targets = [k for k, v in field_map.items() if not v]
        return {
            "provider": body.provider,
            "object_type": body.object_type,
            "unknown_canonical_keys": unknown_keys,
            "empty_targets": empty_targets,
            "ok": len(unknown_keys) == 0 and len(empty_targets) == 0,
        }


@app.get("/crm/mappings/export")
async def crm_mappings_export(request: Request, provider: Optional[str] = None):
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        q = session.query(CRMMappings)
        if tenant_id is not None:
            q = q.filter(CRMMappings.tenant_id == tenant_id)
        if provider:
            q = q.filter(CRMMappings.provider == provider)
        rows = q.all()
        return [
            {
                "provider": r.provider,
                "object_type": r.object_type,
                "field_map": json.loads(r.field_map_json or "{}"),
                "updated_at": r.updated_at.isoformat(),
            }
            for r in rows
        ]


class CRMMappingsImport(BaseModel):
    items: List[Dict[str, Any]]


@app.post("/crm/mappings/import")
async def crm_mappings_import(request: Request, body: CRMMappingsImport):
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        for item in (body.items or []):
            provider = str(item.get("provider") or "").lower()
            object_type = str(item.get("object_type") or "").lower()
            field_map = item.get("field_map") or {}
            if not provider or not object_type:
                continue
            row = (
                session.query(CRMMappings)
                .filter(CRMMappings.provider == provider)
                .filter(CRMMappings.object_type == object_type)
                .filter(CRMMappings.tenant_id == tenant_id)
                .one_or_none()
            )
            if not row:
                row = CRMMappings(
                    tenant_id=tenant_id,
                    provider=provider,
                    object_type=object_type,
                    field_map_json=json.dumps(field_map),
                )
                session.add(row)
            else:
                row.field_map_json = json.dumps(field_map)
                row.updated_at = datetime.now(timezone.utc)
        session.commit()
        return {"ok": True}


@app.get("/crm/providers")
async def crm_providers():
    return sorted(list({*list(SUGGESTIONS.keys()), "freshsales", "odoo", "bitrix", "dynamics"}))


class CRMTestUpsert(BaseModel):
    provider: str
    object_type: str
    source: Dict[str, Any]
    external_id: Optional[str] = None


@app.post("/crm/test_upsert")
async def crm_test_upsert(request: Request, body: CRMTestUpsert):
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        field_map = _load_mapping(session, tenant_id, body.provider.lower(), body.object_type.lower())
        transformed = _transform_by_mapping(body.source or {}, field_map)
        # simulate idempotent upsert using external_id
        result = {
            "provider": body.provider,
            "object_type": body.object_type,
            "external_id": body.external_id or body.source.get("external_id"),
            "transformed": transformed,
            "would_upsert": True,
        }
        return result
class CRMTestActivity(BaseModel):
    provider: str
    object_type: Optional[str] = "activity"
    activity: Optional[Dict[str, Any]] = None
    call_id: Optional[int] = None
    use_last_call: Optional[bool] = False


def _load_mapping(session: Session, tenant_id: Optional[int], provider: str, object_type: str) -> Dict[str, str]:
    q = session.query(CRMMappings).filter(CRMMappings.provider == provider).filter(CRMMappings.object_type == object_type)
    if tenant_id is not None:
        q = q.filter(CRMMappings.tenant_id == tenant_id)
    row = q.one_or_none()
    return json.loads(row.field_map_json or "{}") if row else {}


def _transform_by_mapping(source: Dict[str, Any], field_map: Dict[str, str]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for canonical_key, provider_key in (field_map or {}).items():
        if canonical_key in source:
            out[provider_key] = source[canonical_key]
    return out


@app.post("/crm/test_push_activity")
async def crm_test_push_activity(request: Request, body: CRMTestActivity):
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        source: Dict[str, Any] = {}
        if body.activity:
            source = dict(body.activity)
        else:
            # Build from last call or specific call
            q = session.query(CallRecord)
            if tenant_id is not None:
                q = q.filter(CallRecord.tenant_id == tenant_id)
            if body.call_id:
                q = q.filter(CallRecord.id == int(body.call_id))
            r = q.order_by(CallRecord.created_at.desc()).first()
            if not r:
                raise HTTPException(status_code=404, detail="No calls to build activity")
            disp = (
                session.query(Disposition)
                .filter(Disposition.call_id == r.id)
                .order_by(Disposition.updated_at.desc())
                .first()
            )
            # canonical activity
            source = {
                "activity_id": str(r.id),
                "type": "call",
                "timestamp": r.created_at.isoformat(),
                "duration_s": None,
                "related_to": {"contact_id": None, "company_id": None, "deal_id": None},
                "recording_url": None,
                "transcript_url": None,
                "disposition": disp.outcome if disp else None,
                "qa_score_total": None,
                "subject": f"Call {r.id}",
                "description": None,
            }
            media = (
                session.query(CallMedia)
                .filter(CallMedia.call_id == r.id)
                .order_by(CallMedia.created_at.desc())
                .first()
            )
            if media and media.audio_url:
                source["recording_url"] = media.audio_url

        field_map = _load_mapping(session, tenant_id, body.provider.lower(), (body.object_type or "activity").lower())
        transformed = _transform_by_mapping(source, field_map)
        return {"provider": body.provider, "object_type": body.object_type or "activity", "source": source, "transformed": transformed}


class CRMTestTransform(BaseModel):
    provider: str
    object_type: str
    source: Dict[str, Any]


@app.post("/crm/test_transform")
async def crm_test_transform(request: Request, body: CRMTestTransform):
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        field_map = _load_mapping(session, tenant_id, body.provider.lower(), body.object_type.lower())
        transformed = _transform_by_mapping(body.source or {}, field_map)
        return {"provider": body.provider, "object_type": body.object_type, "source": body.source, "transformed": transformed}


# -----------------------------
# System status and webhook tester
# -----------------------------

@app.get("/system/status")
async def system_status() -> Dict[str, Any]:
    status = {
        "db": False,
        "redis": False,
        "r2": False,
        "retell": False,
        "database_type": None,
        "redis_connected": False,
        "env_vars": {}
    }
    
    # DB check
    db_type = "sqlite" if not DATABASE_URL else ("postgresql" if "postgres" in DATABASE_URL.lower() else "unknown")
    status["database_type"] = db_type
    try:
        with Session(engine) as session:
            session.execute(text("SELECT 1"))
            session.commit()
            status["db"] = True
    except Exception as e:
        status["db_error"] = str(e)
    
    # Redis check
    redis_url = os.getenv("REDIS_URL")
    status["env_vars"]["REDIS_URL"] = "set" if redis_url else "not set"
    try:
        r = get_redis()
        if r is not None:
            r.ping()
            status["redis"] = True
            status["redis_connected"] = True
        else:
            status["redis_error"] = "Redis module not available or connection failed"
    except Exception as e:
        status["redis_error"] = str(e)
    
    # R2 check
    status["env_vars"]["R2_ACCOUNT_ID"] = "set" if os.getenv("R2_ACCOUNT_ID") else "not set"
    status["env_vars"]["R2_ACCESS_KEY_ID"] = "set" if os.getenv("R2_ACCESS_KEY_ID") else "not set"
    status["env_vars"]["R2_SECRET_ACCESS_KEY"] = "set" if os.getenv("R2_SECRET_ACCESS_KEY") else "not set"
    status["env_vars"]["R2_BUCKET"] = "set" if os.getenv("R2_BUCKET") else "not set"
    status["r2"] = bool(get_r2_client())
    
    # Retell check
    status["env_vars"]["RETELL_API_KEY"] = "set" if os.getenv("RETELL_API_KEY") else "not set"
    status["env_vars"]["RETELL_WEBHOOK_SECRET"] = "set" if os.getenv("RETELL_WEBHOOK_SECRET") else "not set"
    status["env_vars"]["DEFAULT_FROM_NUMBER"] = "set" if os.getenv("DEFAULT_FROM_NUMBER") else "not set"
    status["env_vars"]["DATABASE_URL"] = "set" if DATABASE_URL else "not set"
    status["env_vars"]["FRONTEND_ORIGIN"] = "set" if os.getenv("FRONTEND_ORIGIN") else "not set"
    status["env_vars"]["JWT_SECRET"] = "set" if os.getenv("JWT_SECRET") else "not set"
    status["retell"] = bool(os.getenv("RETELL_API_KEY"))
    
    return status


@app.get("/system/debug/env")
async def debug_env() -> Dict[str, Any]:
    """Debug endpoint to check available environment variables (non-sensitive)"""
    all_env = dict(os.environ)
    # Filter out sensitive variables, show only keys
    sensitive_keys = ["PASSWORD", "SECRET", "KEY", "TOKEN", "API_KEY", "WEBHOOK_SECRET"]
    filtered = {}
    for key in sorted(all_env.keys()):
        if any(sensitive in key.upper() for sensitive in sensitive_keys):
            filtered[key] = "***hidden***"
        else:
            filtered[key] = all_env[key]
    
    return {
        "total_vars": len(all_env),
        "databases": {
            "DATABASE_URL_set": bool(os.getenv("DATABASE_URL")),
            "DATABASE_URL_type": "postgresql" if "postgres" in str(os.getenv("DATABASE_URL", "")).lower() else ("sqlite" if not os.getenv("DATABASE_URL") else "other"),
            "DATABASE_URL_preview": str(os.getenv("DATABASE_URL", ""))[:50] + "..." if os.getenv("DATABASE_URL") and len(os.getenv("DATABASE_URL", "")) > 50 else os.getenv("DATABASE_URL", "not set"),
        },
        "redis": {
            "REDIS_URL_set": bool(os.getenv("REDIS_URL")),
            "REDIS_URL_preview": str(os.getenv("REDIS_URL", ""))[:50] + "..." if os.getenv("REDIS_URL") and len(os.getenv("REDIS_URL", "")) > 50 else os.getenv("REDIS_URL", "not set"),
        },
        "env_vars": filtered
    }


class WebhookTest(BaseModel):
    event_type: str = "call.transcript.append"
    call_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


@app.post("/webhooks/test")
async def webhooks_test(body: WebhookTest):
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
    await manager.broadcast({"type": body.event_type, "data": evt})
    return {"ok": True}

@app.post("/webhooks/retell")
async def webhooks_retell(request: Request, x_signature: Optional[str] = Header(None)):
    raw = await request.body()
    secret = os.getenv("RETELL_WEBHOOK_SECRET")
    if secret:
        expected = _compute_signature(secret, raw)
        if not x_signature or not hmac.compare_digest(expected, x_signature):
            raise HTTPException(status_code=401, detail="invalid signature")
    payload = json.loads(raw.decode("utf-8"))
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
                r.lpush("dlq:webhooks:retell", json.dumps({"event_id": event_id, "raw": raw.decode("utf-8"), "error": str(e), "ts": datetime.now(timezone.utc).isoformat()}))
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
    await manager.broadcast({"type": event_type, "data": payload})

    # Process event: upsert call status, segments, summary, media, disposition
    ref_id = payload.get("call_id") or payload.get("id") or (payload.get("data") or {}).get("call_id")
    try:
        with Session(engine) as session:
            rec = session.query(CallRecord).filter(CallRecord.provider_call_id == str(ref_id)).one_or_none()
            if rec:
                if event_type and ("finished" in event_type or event_type == "call.finished"):
                    rec.status = "ended"
                    rec.updated_at = datetime.now(timezone.utc)
                # Save transcript/summary/media
                data = payload.get("data") or payload
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
                    summ = CallSummary(
                        call_id=rec.id,
                        provider_call_id=str(ref_id),
                        bullets_json=json.dumps(data),
                    )
                    session.add(summ)
                    # structured extraction if present
                    structured = CallStructured(
                        call_id=rec.id,
                        bant_json=json.dumps(data.get("bant") or {}),
                        trade_json=json.dumps(data.get("trade") or {}),
                    )
                    session.add(structured)
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
                    media = CallMedia(call_id=rec.id, audio_url=final_url)
                    session.add(media)
                    # also cache on CallRecord for faster access
                    try:
                        rec.audio_url = final_url
                    except Exception:
                        pass
                # outcome -> disposition
                if event_type == "call.finished":
                    outcome = (data.get("outcome") or data.get("disposition") or data.get("status") or "unknown")
                    disp = Disposition(call_id=rec.id, outcome=outcome, note=None)
                    session.add(disp)
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
                r.lpush("dlq:webhooks:retell", json.dumps({"event_id": event_id, "raw": json.dumps(payload), "error": str(e), "ts": datetime.now(timezone.utc).isoformat()}))
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


@app.post("/voice/events")
async def voice_events(request: Request):
    # Stub endpoint to receive provider webhooks (Retell)
    payload = await request.json()
    # Broadcast to WS subscribers and store last events
    event_type = payload.get("type")
    now_iso = datetime.now(timezone.utc).isoformat()
    EVENTS.append({"type": event_type, "data": payload, "ts": now_iso})
    if len(EVENTS) > 200:
        del EVENTS[: len(EVENTS) - 200]
    await manager.broadcast({"type": event_type, "data": payload})

    # Try to update call status if payload references a call id
    ref_id = payload.get("call_id") or payload.get("id") or (payload.get("data") or {}).get("call_id")
    if ref_id:
        with Session(engine) as session:
            rec = session.query(CallRecord).filter(CallRecord.provider_call_id == str(ref_id)).one_or_none()
            if rec:
                rec.status = "ended" if event_type and "finished" in event_type else (event_type or rec.status)
                rec.updated_at = datetime.now(timezone.utc)
                # Save transcript or summary if present
                data = payload.get("data") or payload
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
                    summ = CallSummary(
                        call_id=rec.id,
                        provider_call_id=str(ref_id),
                        bullets_json=json.dumps(data),
                    )
                    session.add(summ)
                session.commit()
    return {"received": True, "type": event_type}


class OutboundCallRequest(BaseModel):
    to: str = Field(..., description="E.164 destination, es. +39XXXXXXXXXX")
    from_number: str | None = Field(None, description="Caller ID E.164 se disponibile")
    language: str = Field("it-IT")
    objective: str = Field("Qualifica lead secondo BANT in italiano")
    metadata: dict | None = None
    agent_id: Optional[str] = None
    kb_id: Optional[int] = None


@app.post("/calls/retell/outbound")
async def create_outbound_call(request: Request, payload: OutboundCallRequest):
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")

    # Chiamata reale a Retell: Create Phone Call (V2)
    import httpx
    base_url = os.getenv("RETELL_BASE_URL", "https://api.retellai.com")
    endpoint = f"{base_url}/v2/create-phone-call"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    # Garantisci un from_number sempre valido
    from_num = payload.from_number or os.getenv("DEFAULT_FROM_NUMBER")
    if not from_num:
        raise HTTPException(status_code=400, detail="from_number mancante: imposta DEFAULT_FROM_NUMBER o passa un Caller ID valido")

    body = {"from_number": from_num, "to_number": payload.to}
    # Resolve language and agent mapping
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        lang = _resolve_lang(session, request, payload.to, (payload.metadata or {}).get("lang") if payload.metadata else None)
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
        # attach kb version for traceability
        try:
            s = _get_settings()
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
        _enforce_subscription_or_raise(session, request)
        _enforce_compliance_or_raise(session, request, payload.to, payload.metadata)
        _enforce_budget_or_raise(session, request)

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
        await manager.broadcast({"type": "call.created", "data": data})
        return data


class WebCallRequest(BaseModel):
    agent_id: str = Field(...)
    metadata: dict | None = None
    kb_id: Optional[int] = None


@app.post("/calls/retell/web")
async def create_web_call(payload: WebCallRequest):
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")

    import httpx
    base_url = os.getenv("RETELL_BASE_URL", "https://api.retellai.com")
    endpoint = f"{base_url}/v2/create-web-call"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    # Resolve language/agent for chat/web
    body: Dict[str, Any] = {}
    with Session(engine) as session:
        lang = (payload.metadata or {}).get("lang") if payload.metadata else None
        lang = lang or (_get_settings().default_lang or "en-US")
        agent_id = payload.agent_id
        if not agent_id:
            # No tenant scoping here for demo; can add extract_tenant_id if needed
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
        s = _get_settings()
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
        await manager.broadcast({"type": "webcall.created", "data": data})
        return data


# -----------------------------
# In-memory storage (MVP only)
# -----------------------------
EVENTS: List[Dict[str, Any]] = []
def country_iso_from_e164(e164: Optional[str]) -> Optional[str]:
    if not e164:
        return None
    # Minimal mapping for demo; extend as needed
    mapping = {
        "+39": "IT",
        "+33": "FR",
        "+34": "ES",
        "+49": "DE",
        "+351": "PT",
        "+41": "CH",
        "+44": "GB",
        "+212": "MA",
        "+216": "TN",
        "+213": "DZ",
        "+20": "EG",
    }
    # Find longest prefix match
    best = None
    for prefix, iso in mapping.items():
        if e164.startswith(prefix) and (best is None or len(prefix) > len(best[0])):
            best = (prefix, iso)
    return best[1] if best else None


# -----------------------------
# Retell adapter helpers
# -----------------------------

def _retell_headers() -> Dict[str, str]:
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


def _retell_base() -> str:
    return os.getenv("RETELL_BASE_URL", "https://api.retellai.com")


async def _retell_get_json(path: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{_retell_base()}{path}", headers=_retell_headers())
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()


@app.get("/retell/calls/{provider_call_id}")
async def retell_get_call(provider_call_id: str):
    data = await _retell_get_json(f"/v2/get-call?call_id={urllib.parse.quote(provider_call_id)}")
    return data


@app.get("/retell/calls")
async def retell_list_calls(limit: int = 50, cursor: Optional[str] = None):
    qs = {"limit": max(1, min(limit, 100))}
    if cursor:
        qs["cursor"] = cursor
    query = urllib.parse.urlencode(qs)
    data = await _retell_get_json(f"/v2/list-calls?{query}")
    return data


@app.post("/retell/backfill")
async def retell_backfill(request: Request, limit: int = 100):
    # Pull latest calls from provider and persist any missing ones
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


@app.get("/calls")
async def list_calls(request: Request) -> List[Dict[str, Any]]:
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


@app.get("/history/{phone}")
async def calls_by_phone(
    request: Request,
    phone: str,
    created_gte: Optional[str] = None,
    created_lte: Optional[str] = None,
    outcome: Optional[str] = None,
) -> List[Dict[str, Any]]:
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        q = session.query(CallRecord).filter(
            (CallRecord.to_number == phone) | (CallRecord.from_number == phone)
        )
        if tenant_id is not None:
            q = q.filter(CallRecord.tenant_id == tenant_id)
        # date filters
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

@app.get("/calls/live")
async def list_live_calls(request: Request, hours: int = 6) -> List[Dict[str, Any]]:
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


@app.post("/calls/{call_id}/end")
async def end_call(call_id: int) -> Dict[str, Any]:
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
        await manager.broadcast({"type": "call.finished", "data": data})
        return {"ok": True}


class InjectBody(BaseModel):
    message: str
    kind: Optional[str] = None  # e.g., reminder, summarize


@app.post("/calls/{call_id}/inject")
async def inject_call(call_id: int, body: InjectBody) -> Dict[str, Any]:
    # MVP: only broadcast an inject event for UI; provider-side integration can be added later
    payload = {"call_id": call_id, "message": body.message, "kind": body.kind}
    await manager.broadcast({"type": "call.inject", "data": payload})
    return {"ok": True}


@app.post("/calls/{call_id}/pause")
async def pause_call(call_id: int) -> Dict[str, Any]:
    await manager.broadcast({"type": "call.pause", "data": {"call_id": call_id}})
    return {"ok": True}


@app.post("/calls/{call_id}/resume")
async def resume_call(call_id: int) -> Dict[str, Any]:
    await manager.broadcast({"type": "call.resume", "data": {"call_id": call_id}})
    return {"ok": True}

@app.get("/calls/{call_id}")
async def get_call(request: Request, call_id: int) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        r = session.get(CallRecord, call_id)
        if not r:
            raise HTTPException(status_code=404, detail="Call not found")
        if tenant_id is not None and r.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Call not found")
        # include latest disposition and media url if any
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


@app.get("/events")
async def list_events() -> List[Dict[str, Any]]:
    return EVENTS[-200:]


@app.get("/webhooks/dlq")
async def list_webhook_dlq(request: Request) -> List[Dict[str, Any]]:
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
                items.append({"id": f"redis:{i}", "event_id": obj.get("event_id"), "error": obj.get("error"), "created_at": obj.get("ts")})
        except Exception:
            pass
    # Also include DB DLQ
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        q = session.query(WebhookDLQ)
        if tenant_id is not None:
            q = q.filter(WebhookDLQ.tenant_id == tenant_id)
        rows = q.order_by(WebhookDLQ.id.desc()).limit(200).all()
        items.extend([{"id": r.id, "event_id": r.event_id, "error": r.error, "created_at": r.created_at.isoformat()} for r in rows])
    return items[:200]


@app.post("/webhooks/dlq/{entry_id}/replay")
async def replay_webhook_dlq(entry_id: int) -> Dict[str, Any]:
    # Pop from Redis first
    r = get_redis()
    raw = None
    if r is not None:
        try:
            val = r.rpop("dlq:webhooks:retell")
            if val:
                obj = json.loads(val)
                raw = obj.get("raw") or obj
        except Exception:
            raw = None
    # Fallback DB fetch
    db_row = None
    if raw is None:
        with Session(engine) as session:
            row = session.get(WebhookDLQ, entry_id)
            if not row:
                raise HTTPException(status_code=404, detail="DLQ entry not found")
            raw = row.raw_json
            db_row = row
    # Reprocess via same handler logic
    try:
        payload = json.loads(raw if isinstance(raw, str) else json.dumps(raw))
        # Simula la ricezione su /webhooks/retell senza firma (trusted internal replay)
        # Scrive su WebhookEvent e rilancia broadcast+persistenza
        request = type("_Dummy", (), {"headers": {}, "body": lambda: raw.encode("utf-8") if isinstance(raw, str) else json.dumps(payload).encode("utf-8")})()
        await webhooks_retell(request, x_signature=None)
    except Exception as e:
        if db_row is not None:
            with Session(engine) as session:
                row = session.get(WebhookDLQ, db_row.id)
                if row:
                    row.error = str(e)
                    session.commit()
        raise HTTPException(status_code=500, detail="Replay failed")
    # On success, delete db_row
    if db_row is not None:
        with Session(engine) as session:
            row = session.get(WebhookDLQ, db_row.id)
            if row:
                session.delete(row)
                session.commit()
    return {"ok": True, "source": "reprocessed"}


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        living: List[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_json(message)
                living.append(ws)
            except Exception:
                # Drop broken connection
                pass
        self.active = living


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keepalive: receive messages but ignore (client can send pings)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


def _iso_to_date_str(iso_ts: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
    except Exception:
        dt = datetime.now(timezone.utc)
    return dt.date().isoformat()


@app.get("/metrics/daily")
async def metrics_daily(days: int = 7) -> Dict[str, Any]:
    days = max(1, min(days, 60))
    now = datetime.now(timezone.utc).date()
    start = now - timedelta(days=days - 1)
    labels: List[str] = [
        (start + timedelta(days=i)).isoformat() for i in range(days)
    ]
    counts_created = {d: 0 for d in labels}
    counts_finished = {d: 0 for d in labels}

    created_types = {"call.created", "webcall.created"}
    finished_types = {"call.finished", "webcall.finished"}

    for ev in EVENTS:
        d = _iso_to_date_str(ev.get("ts") or datetime.now(timezone.utc).isoformat())
        if d not in counts_created:
            continue
        if ev.get("type") in created_types:
            counts_created[d] += 1
        if ev.get("type") in finished_types:
            counts_finished[d] += 1

    created = [counts_created[d] for d in labels]
    finished = [counts_finished[d] for d in labels]
    rate = [
        (finished[i] / created[i] * 100.0) if created[i] > 0 else 0.0 for i in range(days)
    ]
    return {"labels": labels, "created": created, "finished": finished, "rate": rate}


@app.get("/metrics/outcomes")
async def metrics_outcomes(days: int = 7) -> Dict[str, Any]:
    days = max(1, min(days, 60))
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    buckets: Dict[str, int] = {}
    for ev in EVENTS:
        ts_str = ev.get("ts")
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if ts_str else datetime.now(timezone.utc)
        except Exception:
            ts = datetime.now(timezone.utc)
        if ts < cutoff:
            continue
        if ev.get("type") in {"call.finished", "webcall.finished"}:
            data = ev.get("data") or {}
            outcome = (
                data.get("outcome")
                or data.get("disposition")
                or data.get("status")
                or "unknown"
            )
            buckets[outcome] = buckets.get(outcome, 0) + 1
    items = sorted(buckets.items(), key=lambda x: -x[1])
    labels = [k for k, _ in items]
    counts = [v for _, v in items]
    return {"labels": labels, "counts": counts}


# -----------------------------
# Retell adapter: List/Get Calls + backfill polling
# -----------------------------

async def _retell_client():
    import httpx
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    base_url = os.getenv("RETELL_BASE_URL", "https://api.retellai.com")
    client = httpx.AsyncClient(timeout=30, headers=headers, base_url=base_url)
    return client


@app.get("/retell/calls")
async def retell_list_calls(limit: int = 50) -> Dict[str, Any]:
    client = await _retell_client()
    try:
        resp = await client.get(f"/v2/list-calls?limit={max(1, min(limit, 200))}")
        return resp.json()
    finally:
        await client.aclose()


@app.get("/retell/calls/{provider_call_id}")
async def retell_get_call(provider_call_id: str) -> Dict[str, Any]:
    client = await _retell_client()
    try:
        resp = await client.get(f"/v2/get-call?call_id={provider_call_id}")
        return resp.json()
    finally:
        await client.aclose()


@app.post("/backfill")
async def backfill_recent_calls(limit: int = 50) -> Dict[str, Any]:
    data = await retell_list_calls(limit=limit)
    items = data if isinstance(data, list) else data.get("calls") or []
    imported = 0
    with Session(engine) as session:
        for it in items:
            pid = str(it.get("call_id") or it.get("id") or "")
            if not pid:
                continue
            exists = (
                session.query(CallRecord)
                .filter(CallRecord.provider_call_id == pid)
                .one_or_none()
            )
            if exists:
                continue
            rec = CallRecord(
                direction=(it.get("direction") or "unknown"),
                provider="retell",
                to_number=it.get("to_number"),
                from_number=it.get("from_number"),
                provider_call_id=pid,
                status=(it.get("status") or "unknown"),
                raw_response=str(it),
            )
            session.add(rec)
            imported += 1
        session.commit()
    return {"imported": imported}


# -----------------------------
# Account concurrency, errors last 24h, cost today (mocked MVP)
# -----------------------------

@app.get("/metrics/account/concurrency")
async def metrics_account_concurrency(request: Request) -> Dict[str, Any]:
    # Minimal: count live calls vs a static plan limit
    plan_limit = int(os.getenv("PLAN_CONCURRENCY_LIMIT", "5"))
    tenant_id = extract_tenant_id(request)
    in_use = _live_calls_count(tenant_id=tenant_id)
    return {"limit": plan_limit, "in_use": in_use, "available": max(0, plan_limit - in_use)}


@app.get("/metrics/errors/24h")
async def metrics_errors_24h() -> Dict[str, Any]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    count = 0
    for ev in EVENTS:
        ts_str = ev.get("ts")
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if ts_str else datetime.now(timezone.utc)
        except Exception:
            ts = datetime.now(timezone.utc)
        if ts < cutoff:
            continue
        if str(ev.get("type")).lower().find("error") >= 0:
            count += 1
    return {"errors_24h": count}


@app.get("/metrics/cost/today")
async def metrics_cost_today() -> Dict[str, Any]:
    # Sum cost events for today
    today = datetime.now(timezone.utc).date()
    total_cents = 0
    with Session(engine) as session:
        rows = session.query(CostEvent).all()
        for r in rows:
            dt = (r.ts or datetime.now(timezone.utc)).date()
            if dt == today:
                total_cents += int(r.amount or 0)
    return {"amount": round(total_cents / 100.0, 4), "currency": "EUR"}


@app.get("/metrics/cost/series")
async def metrics_cost_series(days: int = 7) -> Dict[str, Any]:
    days = max(1, min(90, int(days or 7)))
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    labels = [(start + timedelta(days=i)).isoformat() for i in range(days)]
    buckets = {d: 0 for d in labels}
    with Session(engine) as session:
        rows = session.query(CostEvent).all()
        for r in rows:
            dt = (r.ts or datetime.now(timezone.utc)).date().isoformat()
            if dt in buckets:
                buckets[dt] += int(r.amount or 0)
    series = [round(buckets[d] / 100.0, 4) for d in labels]
    return {"labels": labels, "series": series, "currency": "EUR"}


class CostEventCreate(BaseModel):
    call_id: Optional[int] = None
    component: str
    amount: float
    currency: Optional[str] = "EUR"
    ts: Optional[str] = None


@app.post("/cost_events")
async def create_cost_event(body: CostEventCreate) -> Dict[str, Any]:
    # store amount as cents
    cents = int(round((body.amount or 0) * 100))
    when = datetime.fromisoformat(body.ts) if body.ts else datetime.now(timezone.utc)
    with Session(engine) as session:
        ev = CostEvent(call_id=body.call_id, component=body.component, amount=cents, currency=body.currency or "EUR", ts=when)
        session.add(ev)
        session.commit()
    # notify dashboard listeners
    await manager.broadcast({"type": "cost.event", "data": {"call_id": body.call_id, "component": body.component, "amount": body.amount, "currency": body.currency or "EUR", "ts": when.isoformat()}})
    return {"ok": True}


@app.get("/metrics/latency/p95")
async def metrics_latency_p95(hours: int = 6) -> Dict[str, Any]:
    gaps: List[int] = []
    try:
        with Session(engine) as session:
            # SQLite-safe: avoid timezone comparisons; take recent segments by id
            rows = (
                session.query(CallSegment)
                .order_by(CallSegment.call_id.asc(), CallSegment.id.asc())
                .limit(2000)
                .all()
            )
            prev_by_call: Dict[int, CallSegment] = {}
            for s in rows:
                call_key = int(s.call_id or -1)
                prev = prev_by_call.get(call_key)
                if prev is not None:
                    try:
                        prev_end = int(prev.end_ms or 0)
                        cur_start = int(s.start_ms or 0)
                        gap = max(0, cur_start - prev_end)
                        gaps.append(gap)
                    except Exception:
                        pass
                prev_by_call[call_key] = s
    except Exception:
        return {"p95_ms": 0}
    if not gaps:
        return {"p95_ms": 0}
    gaps_sorted = sorted(gaps)
    idx = min(len(gaps_sorted) - 1, int(0.95 * len(gaps_sorted)))
    return {"p95_ms": gaps_sorted[idx]}


@app.get("/legal/notice")
async def legal_notice(e164: Optional[str] = None, iso: Optional[str] = None) -> Dict[str, Any]:
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
    payload = notices.get(country or "", {"title": country or "Unknown", "disclosure": "Check local rules.", "dnc": "Check DNC rules."})
    return {"country_iso": country, "notice": payload}


@app.get("/calls/{call_id}/segments")
async def get_call_segments(call_id: int) -> List[Dict[str, Any]]:
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
                "ts": s.ts.isoformat(),
            }
            for s in rows
        ]


@app.get("/calls/{call_id}/summary")
async def get_call_summary(call_id: int) -> Dict[str, Any]:
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
            bant = {"raw": structured.bant_json}
        try:
            if structured and structured.trade_json:
                trade = json.loads(structured.trade_json)
        except Exception:
            trade = {"raw": structured.trade_json}
        return {"summary": payload, "bant": bant, "trade": trade, "created_at": row.created_at.isoformat()}


@app.post("/batch")
async def start_batch(request: Request, items: List[BatchItem]):
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="RETELL_API_KEY non configurata")
    default_from = os.getenv("DEFAULT_FROM_NUMBER")
    tenant_id = extract_tenant_id(request)

    # Budget gating at batch start (quick check; per-call also enforced in worker entry path)
    with Session(engine) as session:
        try:
            _enforce_subscription_or_raise(session, request)
            _enforce_budget_or_raise(session, request)
        except Exception:
            raise

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

    async def worker():
        import httpx
        base_url = os.getenv("RETELL_BASE_URL", "https://api.retellai.com")
        endpoint = f"{base_url}/v2/create-phone-call"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=30) as client:
            for it in items:
                await asyncio.sleep((it.delay_ms or 0) / 1000.0)
                # Usa il from_number dell'item o ripiega sul DEFAULT_FROM_NUMBER
                effective_from = it.from_number or default_from
                if not effective_from:
                    # Salta la chiamata se non abbiamo un Caller ID valido
                    continue
                # Compliance gating per item
                try:
                    _enforce_compliance_or_raise(Session(engine), request, it.to, it.metadata)
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
                            )
                            session.add(rec)
                            session.commit()
                        await manager.broadcast({"type": "call.created", "data": data})
                except Exception:
                    pass

    asyncio.create_task(worker())
    return {"accepted": len(items), "mode": "inline"}


def _normalize_phone(raw: str) -> Optional[str]:
    if not raw:
        return None
    s = str(raw).strip().replace(" ", "")
    if s.startswith("+") and s[1:].isdigit():
        return s
    if s.isdigit():
        return "+" + s
    return None


def _lower_or_none(v: Optional[str]) -> Optional[str]:
    return str(v).strip().lower() if v is not None else None


@app.post("/batch/import")
async def import_batch_csv(
    request: Request,
    file: UploadFile = File(None),
    text: Optional[str] = Form(None),
    delimiter: str = Form(","),
) -> Dict[str, Any]:
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


# -----------------------------
# Settings (MVP, single-tenant)
# -----------------------------

class AppSettings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    default_agent_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    default_from_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    default_spacing_ms: Mapped[Optional[int]] = mapped_column(Integer, default=1000)
    require_legal_review: Mapped[Optional[int]] = mapped_column(Integer, default=1)  # 1=true, 0=false
    legal_defaults_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    budget_monthly_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    budget_warn_percent: Mapped[Optional[int]] = mapped_column(Integer, default=80)
    budget_stop_enabled: Mapped[Optional[int]] = mapped_column(Integer, default=1)
    default_lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    supported_langs_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prefer_detect_language: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    kb_version_outbound: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    kb_version_inbound: Mapped[Optional[int]] = mapped_column(Integer, default=0)


def _get_settings() -> AppSettings:
    with Session(engine) as session:
        row = session.query(AppSettings).order_by(AppSettings.id.asc()).first()
        if not row:
            row = AppSettings()
            session.add(row)
            session.commit()
            session.refresh(row)
        return row

# Ensure settings table exists (idempotent)
try:
    Base.metadata.create_all(engine)
except Exception as e:
    import sys
    print(f"Warning: Could not create database tables: {e}", file=sys.stderr)


# New: General workspace metadata (separate table, created idempotently)
class AppMeta(Base):
    __tablename__ = "app_meta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    brand_logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    brand_color: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)


def _get_meta() -> AppMeta:
    with Session(engine) as session:
        row = session.query(AppMeta).order_by(AppMeta.id.asc()).first()
        if not row:
            row = AppMeta()
            session.add(row)
            session.commit()
            session.refresh(row)
        return row

# Try to create tables, but don't fail startup if DB is not available yet
try:
    Base.metadata.create_all(engine)
except Exception as e:
    import sys
    print(f"Warning: Could not create database tables: {e}", file=sys.stderr)

@app.get("/settings")
async def get_settings() -> Dict[str, Any]:
    row = _get_settings()
    try:
        legal_defaults = json.loads(row.legal_defaults_json or "{}")
    except Exception:
        legal_defaults = {}
    return {
        "default_agent_id": row.default_agent_id,
        "default_from_number": row.default_from_number or os.getenv("DEFAULT_FROM_NUMBER"),
        "default_spacing_ms": row.default_spacing_ms or 1000,
        "require_legal_review": bool(row.require_legal_review or 0),
        "legal_defaults": legal_defaults,
        "budget_monthly": (row.budget_monthly_cents or 0) / 100.0 if (row.budget_monthly_cents or 0) else 0,
        "budget_warn_percent": int(row.budget_warn_percent or 80),
        "budget_stop_enabled": bool(row.budget_stop_enabled or 0),
        "default_lang": row.default_lang or "",
        "supported_langs": (json.loads(row.supported_langs_json) if (row.supported_langs_json or "").strip() else []),
        "prefer_detect_language": bool(row.prefer_detect_language or 0),
        "kb_version_outbound": int(row.kb_version_outbound or 0),
        "kb_version_inbound": int(row.kb_version_inbound or 0),
    }


class SettingsUpdate(BaseModel):
    default_agent_id: Optional[str] = None
    default_from_number: Optional[str] = None
    default_spacing_ms: Optional[int] = None
    require_legal_review: Optional[bool] = None
    legal_defaults: Optional[Dict[str, str]] = None
    budget_monthly: Optional[float] = None
    budget_warn_percent: Optional[int] = None
    budget_stop_enabled: Optional[bool] = None
    default_lang: Optional[str] = None
    supported_langs: Optional[List[str]] = None
    prefer_detect_language: Optional[bool] = None


@app.put("/settings")
async def update_settings(body: SettingsUpdate) -> Dict[str, Any]:
    with Session(engine) as session:
        row = session.query(AppSettings).order_by(AppSettings.id.asc()).first()
        if not row:
            row = AppSettings()
            session.add(row)
        if body.default_agent_id is not None:
            row.default_agent_id = body.default_agent_id
        if body.default_from_number is not None:
            row.default_from_number = body.default_from_number
        if body.default_spacing_ms is not None:
            row.default_spacing_ms = max(0, int(body.default_spacing_ms))
        if body.require_legal_review is not None:
            row.require_legal_review = 1 if body.require_legal_review else 0
        if body.legal_defaults is not None:
            row.legal_defaults_json = json.dumps(body.legal_defaults or {})
        if body.budget_monthly is not None:
            row.budget_monthly_cents = int(round(max(0.0, float(body.budget_monthly)) * 100))
        if body.budget_warn_percent is not None:
            row.budget_warn_percent = max(1, min(100, int(body.budget_warn_percent)))
        if body.budget_stop_enabled is not None:
            row.budget_stop_enabled = 1 if body.budget_stop_enabled else 0
        if body.default_lang is not None:
            row.default_lang = body.default_lang
        if body.supported_langs is not None:
            try:
                row.supported_langs_json = json.dumps(list(body.supported_langs or []))
            except Exception:
                row.supported_langs_json = json.dumps([])
        # Validation: supported_langs must include default_lang
        try:
            supp = json.loads(row.supported_langs_json or "[]")
            if row.default_lang and row.default_lang not in supp:
                raise HTTPException(status_code=400, detail="supported_langs must include default_lang")
        except HTTPException:
            raise
        except Exception:
            pass
        if body.prefer_detect_language is not None:
            row.prefer_detect_language = 1 if body.prefer_detect_language else 0
        session.commit()
    return await get_settings()


# Sectioned settings endpoints (thin wrappers over AppSettings/AppMeta)

@app.get("/settings/general")
async def get_settings_general() -> Dict[str, Any]:
    meta = _get_meta()
    s = _get_settings()
    return {
        "workspace_name": meta.workspace_name or "",
        "timezone": meta.timezone or "",
        "ui_locale": s.default_lang or "en-US",
        "brand": {"logo_url": meta.brand_logo_url or "", "color": meta.brand_color or "#10a37f"},
    }


class GeneralUpdate(BaseModel):
    workspace_name: Optional[str] = None
    timezone: Optional[str] = None
    ui_locale: Optional[str] = None
    brand: Optional[Dict[str, Any]] = None


@app.put("/settings/general")
async def put_settings_general(body: GeneralUpdate) -> Dict[str, Any]:
    with Session(engine) as session:
        meta = session.query(AppMeta).order_by(AppMeta.id.asc()).first() or AppMeta()
        session.add(meta)
        if body.workspace_name is not None:
            meta.workspace_name = body.workspace_name
        if body.timezone is not None:
            meta.timezone = body.timezone
        if body.brand is not None:
            meta.brand_logo_url = (body.brand or {}).get("logo_url")
            meta.brand_color = (body.brand or {}).get("color")
        # ui locale delegates to AppSettings.default_lang
        s = session.query(AppSettings).order_by(AppSettings.id.asc()).first() or AppSettings()
        session.add(s)
        if body.ui_locale is not None:
            s.default_lang = body.ui_locale
        session.commit()
    return await get_settings_general()


@app.get("/settings/languages")
async def get_settings_languages() -> Dict[str, Any]:
    s = _get_settings()
    try:
        supported = json.loads(s.supported_langs_json or "[]")
    except Exception:
        supported = []
    return {
        "default_lang": s.default_lang or "",
        "supported_langs": supported,
        "prefer_detect": bool(s.prefer_detect_language or 0),
    }


class LanguagesUpdate(BaseModel):
    default_lang: Optional[str] = None
    supported_langs: Optional[List[str]] = None
    prefer_detect: Optional[bool] = None


@app.put("/settings/languages")
async def put_settings_languages(body: LanguagesUpdate) -> Dict[str, Any]:
    with Session(engine) as session:
        s = session.query(AppSettings).order_by(AppSettings.id.asc()).first() or AppSettings()
        session.add(s)
        if body.default_lang is not None:
            s.default_lang = body.default_lang
        if body.supported_langs is not None:
            try:
                s.supported_langs_json = json.dumps(list(body.supported_langs or []))
            except Exception:
                s.supported_langs_json = json.dumps([])
        if body.prefer_detect is not None:
            s.prefer_detect_language = 1 if body.prefer_detect else 0
        # validation: default in supported
        try:
            supp = json.loads(s.supported_langs_json or "[]")
            if s.default_lang and s.default_lang not in supp:
                raise HTTPException(status_code=400, detail="supported_langs must include default_lang")
        except HTTPException:
            raise
        except Exception:
            pass
        session.commit()
    return await get_settings_languages()


@app.get("/settings/telephony")
async def get_settings_telephony() -> Dict[str, Any]:
    s = _get_settings()
    return {
        "default_from_number": s.default_from_number or os.getenv("DEFAULT_FROM_NUMBER"),
        "spacing_ms": s.default_spacing_ms or 1000,
    }


class TelephonyUpdate(BaseModel):
    default_from_number: Optional[str] = None
    spacing_ms: Optional[int] = None


@app.put("/settings/telephony")
async def put_settings_telephony(body: TelephonyUpdate) -> Dict[str, Any]:
    with Session(engine) as session:
        s = session.query(AppSettings).order_by(AppSettings.id.asc()).first() or AppSettings()
        session.add(s)
        if body.default_from_number is not None:
            s.default_from_number = body.default_from_number
        if body.spacing_ms is not None:
            s.default_spacing_ms = max(0, int(body.spacing_ms or 0))
        session.commit()
    return await get_settings_telephony()


@app.get("/settings/compliance")
async def get_settings_compliance() -> Dict[str, Any]:
    s = _get_settings()
    try:
        rules = json.loads(s.legal_defaults_json or "{}")
    except Exception:
        rules = {}
    return {
        "require_legal_review": bool(s.require_legal_review or 0),
        "country_rules": rules,
    }


class ComplianceUpdate(BaseModel):
    require_legal_review: Optional[bool] = None
    country_rules: Optional[Dict[str, Any]] = None


@app.put("/settings/compliance")
async def put_settings_compliance(body: ComplianceUpdate) -> Dict[str, Any]:
    with Session(engine) as session:
        s = session.query(AppSettings).order_by(AppSettings.id.asc()).first() or AppSettings()
        session.add(s)
        if body.require_legal_review is not None:
            s.require_legal_review = 1 if body.require_legal_review else 0
        if body.country_rules is not None:
            s.legal_defaults_json = json.dumps(body.country_rules or {})
        session.commit()
    return await get_settings_compliance()


# -----------------------------
# Admin endpoints (MVP)
# -----------------------------

def _is_admin(request: Request) -> bool:
    allowed = set((os.getenv("ADMIN_EMAILS") or "").replace(";", ",").split(","))
    allowed = {e.strip().lower() for e in allowed if e.strip()}
    email = (request.headers.get("X-Admin-Email") or "").strip().lower()
    return bool(email and email in allowed)


@app.get("/admin/overview")
async def admin_overview(request: Request) -> Dict[str, Any]:
    if not _is_admin(request):
        raise HTTPException(status_code=403, detail="Not allowed")
    # Minimal overview: plan and usage snapshot
    with Session(engine) as session:
        tenants = session.query(Subscription).order_by(Subscription.id.asc()).limit(50).all()
        out: List[Dict[str, Any]] = []
        for s in tenants:
            # minutes MTD
            start_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            minutes = (
                session.query(UsageEvent)
                .filter(UsageEvent.ts >= start_month)
                .filter(UsageEvent.tenant_id == (s.tenant_id or 0))
                .all()
            )
            mtd = sum(int(u.minutes_billed or 0) for u in minutes)
            out.append({
                "tenant_id": s.tenant_id,
                "plan": s.plan_code,
                "status": s.status,
                "minutes_mtd": mtd,
            })
    return {"tenants": out[:50]}


# -----------------------------
# Tenant Agents (per-language agent mapping)
# -----------------------------


class TenantAgent(Base):
    __tablename__ = "tenant_agents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(16))  # chat | voice
    lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    agent_id: Mapped[str] = mapped_column(String(128))
    is_multi: Mapped[int] = mapped_column(Integer, default=0)


@app.get("/tenant_agents")
async def list_tenant_agents(request: Request) -> List[Dict[str, Any]]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        rows = session.query(TenantAgent).filter(TenantAgent.tenant_id == (tenant_id or 0)).all()
        return [{"id": r.id, "kind": r.kind, "lang": r.lang, "agent_id": r.agent_id, "is_multi": bool(r.is_multi)} for r in rows]


class TenantAgentUpsert(BaseModel):
    kind: str
    lang: Optional[str] = None
    agent_id: str
    is_multi: Optional[bool] = None


@app.post("/tenant_agents")
async def upsert_tenant_agent(request: Request, body: TenantAgentUpsert) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        row = (
            session.query(TenantAgent)
            .filter(TenantAgent.tenant_id == (tenant_id or 0), TenantAgent.kind == body.kind, TenantAgent.lang == body.lang)
            .one_or_none()
        )
        if not row:
            row = TenantAgent(tenant_id=(tenant_id or 0), kind=body.kind, lang=body.lang, agent_id=body.agent_id, is_multi=1 if (body.is_multi or False) else 0)
            session.add(row)
        else:
            row.agent_id = body.agent_id
            if body.is_multi is not None:
                row.is_multi = 1 if body.is_multi else 0
        session.commit()
    return {"ok": True}


@app.delete("/tenant_agents/{ta_id}")
async def delete_tenant_agent(ta_id: int, request: Request) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        row = session.get(TenantAgent, ta_id)
        if not row or row.tenant_id != (tenant_id or 0):
            raise HTTPException(status_code=404, detail="Not found")
        session.delete(row)
        session.commit()
    return {"ok": True}


def _resolve_lang(session: Session, request: Request, to_number: Optional[str], provided_lang: Optional[str]) -> str:
    # Order: provided -> lead.preferred_lang -> settings.default_lang -> UI locale (ignored here) -> en-US
    if provided_lang:
        return provided_lang
    if to_number:
        lead = session.query(Lead).filter(Lead.phone == to_number).one_or_none()
        if lead and lead.preferred_lang:
            return lead.preferred_lang
    s = _get_settings()
    if s.default_lang:
        return s.default_lang
    return "en-US"


def _resolve_agent(session: Session, tenant_id: Optional[int], kind: str, lang: str) -> Tuple[Optional[str], bool]:
    # Returns (agent_id, is_multi)
    row = (
        session.query(TenantAgent)
        .filter(TenantAgent.tenant_id == (tenant_id or 0), TenantAgent.kind == kind, TenantAgent.lang == lang)
        .one_or_none()
    )
    if row:
        return row.agent_id, bool(row.is_multi)
    # Fallback to any multi for kind
    multi = (
        session.query(TenantAgent)
        .filter(TenantAgent.tenant_id == (tenant_id or 0), TenantAgent.kind == kind, TenantAgent.is_multi == 1)
        .first()
    )
    if multi:
        return multi.agent_id, True
    return None, False


# -------------
# Disposition API
# -------------

class DispositionUpdate(BaseModel):
    outcome: str
    note: Optional[str] = None


@app.post("/calls/{call_id}/disposition")
async def update_disposition(call_id: int, body: DispositionUpdate) -> Dict[str, Any]:
    with Session(engine) as session:
        r = session.get(CallRecord, call_id)
        if not r:
            raise HTTPException(status_code=404, detail="Call not found")
        disp = Disposition(call_id=call_id, outcome=body.outcome, note=body.note)
        session.add(disp)
        session.commit()
    return {"ok": True}


# ----------------------------------
# Simple CRUD for Agents / KB / Numbers (MVP)
# ----------------------------------

class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    voice_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class KnowledgeBase(Base):
    __tablename__ = "kbs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    scope: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)


class KnowledgeSection(Base):
    __tablename__ = "kb_sections"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    kb_id: Mapped[int] = mapped_column(Integer, ForeignKey("kbs.id"))
    kind: Mapped[str] = mapped_column(String(16))  # knowledge | rules | style
    content_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class PhoneNumber(Base):
    __tablename__ = "numbers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    e164: Mapped[str] = mapped_column(String(32))
    type: Mapped[str] = mapped_column(String(16), default="retell")
    verified: Mapped[int] = mapped_column(Integer, default=0)
    country: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)


# Try to create tables, but don't fail startup if DB is not available yet
try:
    Base.metadata.create_all(engine)
except Exception as e:
    import sys
    print(f"Warning: Could not create database tables: {e}", file=sys.stderr)


class Campaign(Base):
    __tablename__ = "campaigns"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    status: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # active | paused | done
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    company: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    phone: Mapped[str] = mapped_column(String(32))
    country_iso: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    preferred_lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # supplier | supplied
    consent_basis: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    consent_status: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # granted | denied | unknown
    campaign_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("campaigns.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# Try to create tables, but don't fail startup if DB is not available yet
try:
    Base.metadata.create_all(engine)
except Exception as e:
    import sys
    print(f"Warning: Could not create database tables: {e}", file=sys.stderr)


@app.get("/agents")
async def list_agents(request: Request) -> List[Dict[str, Any]]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        q = session.query(Agent)
        if tenant_id is not None:
            q = q.filter(Agent.tenant_id == tenant_id)
        rows = q.order_by(Agent.id.desc()).limit(200).all()
        return [{"id": a.id, "name": a.name, "lang": a.lang, "voice_id": a.voice_id} for a in rows]


class AgentCreate(BaseModel):
    name: str
    lang: Optional[str] = None
    voice_id: Optional[str] = None


@app.post("/agents")
async def create_agent(request: Request, body: AgentCreate):
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        a = Agent(name=body.name, lang=body.lang, voice_id=body.voice_id, tenant_id=tenant_id)
        session.add(a)
        session.commit()
    return {"ok": True}


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    lang: Optional[str] = None
    voice_id: Optional[str] = None


@app.patch("/agents/{agent_id}")
async def update_agent(request: Request, agent_id: int, body: AgentUpdate):
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        a = session.get(Agent, agent_id)
        if not a or (tenant_id is not None and a.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Agent not found")
        if body.name is not None:
            a.name = body.name
        if body.lang is not None:
            a.lang = body.lang
        if body.voice_id is not None:
            a.voice_id = body.voice_id
        session.commit()
    return {"ok": True}


@app.delete("/agents/{agent_id}")
async def delete_agent(request: Request, agent_id: int):
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        a = session.get(Agent, agent_id)
        if not a or (tenant_id is not None and a.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Agent not found")
        session.delete(a)
        session.commit()
    return {"ok": True}


@app.get("/kbs")
async def list_kbs(request: Request) -> List[Dict[str, Any]]:
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


@app.post("/kbs")
async def create_kb(request: Request, body: KbCreate):
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        k = KnowledgeBase(lang=body.lang, scope=body.scope, tenant_id=tenant_id)
        session.add(k)
        session.commit()
    return {"ok": True}


class KbUpdate(BaseModel):
    lang: Optional[str] = None
    scope: Optional[str] = None


@app.patch("/kbs/{kb_id}")
async def update_kb(request: Request, kb_id: int, body: KbUpdate):
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


@app.delete("/kbs/{kb_id}")
async def delete_kb(request: Request, kb_id: int):
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        k = session.get(KnowledgeBase, kb_id)
        if not k or (tenant_id is not None and k.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="KB not found")
        session.delete(k)
        session.commit()
    return {"ok": True}


@app.get("/numbers")
async def list_numbers(request: Request) -> List[Dict[str, Any]]:
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


@app.post("/numbers")
async def create_number(request: Request, body: NumberCreate):
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


@app.patch("/numbers/{number_id}")
async def update_number(request: Request, number_id: int, body: NumberUpdate):
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


@app.delete("/numbers/{number_id}")
async def delete_number(request: Request, number_id: int):
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        n = session.get(PhoneNumber, number_id)
        if not n or (tenant_id is not None and n.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Number not found")
        session.delete(n)
        session.commit()
    return {"ok": True}


# ----------------------------------
# Compliance: DNC and Consents (MVP)
# ----------------------------------

class DNCEntry(Base):
    __tablename__ = "dnc_numbers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    e164: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Consent(Base):
    __tablename__ = "consents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lead_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    type: Mapped[str] = mapped_column(String(32))  # marketing | recording
    status: Mapped[str] = mapped_column(String(16))  # granted | denied
    source: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    proof_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# Try to create tables, but don't fail startup if DB is not available yet
try:
    Base.metadata.create_all(engine)
except Exception as e:
    import sys
    print(f"Warning: Could not create database tables: {e}", file=sys.stderr)


def _is_dnc_number(session: Session, tenant_id: Optional[int], to_number: str) -> bool:
    q = session.query(DNCEntry).filter(DNCEntry.e164 == to_number)
    if tenant_id is not None:
        q = q.filter(DNCEntry.tenant_id == tenant_id)
    return session.query(q.exists()).scalar() or False


def _enforce_compliance_or_raise(session: Session, request: Request, to_number: str, metadata: Optional[dict]) -> None:
    tenant_id = extract_tenant_id(request)
    # DNC
    if _is_dnc_number(session, tenant_id, to_number):
        raise HTTPException(status_code=403, detail="Blocked by DNC list")
    # Legal review requirement -> metadata.legal_accepted must be true
    s = _get_settings()
    require_legal = bool(s.require_legal_review or 0)
    if require_legal:
        accepted = bool((metadata or {}).get("legal_accepted", False))
        if not accepted:
            raise HTTPException(status_code=403, detail="Legal review not accepted")


def _tenant_monthly_spend_cents(session: Session, tenant_id: Optional[int]) -> int:
    # Sum cost events for current month for tenant
    try:
        start_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        q = session.query(CostEvent)
        if tenant_id is not None:
            # join via calls to filter by tenant when call_id present; otherwise count as global
            # fallback: if no call_id, include in total (shared costs)
            pass
        rows = q.all()
        total = 0
        for r in rows:
            ts = r.ts or datetime.now(timezone.utc)
            if ts >= start_month:
                total += int(r.amount or 0)
        return total
    except Exception:
        return 0


def _enforce_budget_or_raise(session: Session, request: Request) -> None:
    s = _get_settings()
    tenant_id = extract_tenant_id(request)
    monthly_cap = int(s.budget_monthly_cents or 0)
    if monthly_cap <= 0:
        return
    spent = _tenant_monthly_spend_cents(session, tenant_id)
    warn_pct = int(s.budget_warn_percent or 80)
    stop_enabled = bool(s.budget_stop_enabled or 0)
    # broadcast warn if over threshold
    try:
        if spent >= monthly_cap * warn_pct / 100.0:
            # non-blocking warning event
            asyncio.create_task(manager.broadcast({"type": "budget.warn", "data": {"spent": spent/100.0, "cap": monthly_cap/100.0}}))
    except Exception:
        pass
    if stop_enabled and spent >= monthly_cap:
        raise HTTPException(status_code=403, detail="Budget cap reached for this tenant")


def _enforce_subscription_or_raise(session: Session, request: Request) -> None:
    tenant_id = extract_tenant_id(request)
    if tenant_id is None:
        return
    sub = (
        session.query(Subscription)
        .filter(Subscription.tenant_id == tenant_id)
        .order_by(Subscription.id.desc())
        .first()
    )
    # If missing, bootstrap a Free 14-day trial
    if not sub:
        sub = Subscription(tenant_id=tenant_id, plan_code="free", status="trialing")
        session.add(sub)
        session.commit()
        session.refresh(sub)
    status = sub.status or "trialing"
    if status in {"active", "trialing"}:
        # Enforce 14-day trial for Free
        try:
            if (sub.plan_code or "free") == "free" and status == "trialing":
                start = sub.created_at or datetime.now(timezone.utc)
                if datetime.now(timezone.utc) - start > timedelta(days=14):
                    raise HTTPException(status_code=402, detail="Free trial expired. Please upgrade in Billing")
            return
        except Exception:
            return
    if status in {"past_due"}:
        raise HTTPException(status_code=402, detail="Subscription past_due. Go to Billing portal")
    if status in {"canceled", "unpaid"}:
        raise HTTPException(status_code=403, detail="Subscription inactive. Upgrade to continue")


@app.get("/compliance/dnc")
async def list_dnc(request: Request) -> List[Dict[str, Any]]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        q = session.query(DNCEntry)
        if tenant_id is not None:
            q = q.filter(DNCEntry.tenant_id == tenant_id)
        rows = q.order_by(DNCEntry.id.desc()).limit(500).all()
        return [{"id": d.id, "e164": d.e164, "created_at": d.created_at.isoformat()} for d in rows]


class DncCreate(BaseModel):
    e164: str


@app.post("/compliance/dnc")
async def add_dnc(request: Request, body: DncCreate) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        entry = DNCEntry(e164=body.e164, tenant_id=tenant_id)
        session.add(entry)
        session.commit()
    return {"ok": True}


# -----------------------------
# Campaigns & Leads (CRUD minimal)
# -----------------------------

class CampaignCreate(BaseModel):
    name: str
    status: Optional[str] = None


@app.get("/campaigns")
async def list_campaigns(request: Request) -> List[Dict[str, Any]]:
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        q = session.query(Campaign)
        if tenant_id is not None:
            q = q.filter(Campaign.tenant_id == tenant_id)
        rows = q.order_by(Campaign.id.desc()).limit(200).all()
        return [{"id": c.id, "name": c.name, "status": c.status} for c in rows]


@app.post("/campaigns")
async def create_campaign(request: Request, body: CampaignCreate) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        c = Campaign(name=body.name, status=body.status, tenant_id=tenant_id)
        session.add(c)
        session.commit()
        session.refresh(c)
        return {"ok": True, "id": c.id, "name": c.name, "status": c.status}


@app.get("/campaigns/kpi")
async def campaigns_kpi(request: Request) -> List[Dict[str, Any]]:
    tenant_id = extract_tenant_id(request)
    qualified_set = {"qualified", "rfq", "quote_sent", "reorder"}
    with tenant_session(request) as session:
        # campaigns
        q = session.query(Campaign)
        if tenant_id is not None:
            q = q.filter(Campaign.tenant_id == tenant_id)
        camps = q.order_by(Campaign.id.desc()).all()
        results: List[Dict[str, Any]] = []
        for c in camps:
            # leads for this campaign
            leads = session.query(Lead).filter(Lead.campaign_id == c.id).all()
            phones = [l.phone for l in leads if l.phone]
            leads_count = len(leads)
            calls_count = 0
            qualified = 0
            if phones:
                calls = (
                    session.query(CallRecord)
                    .filter(CallRecord.to_number.in_(phones))
                    .all()
                )
                calls_count = len(calls)
                if calls:
                    call_ids = [cl.id for cl in calls]
                    qd = (
                        session.query(Disposition)
                        .filter(Disposition.call_id.in_(call_ids))
                        .all()
                    )
                    qualified = sum(1 for d in qd if (d.outcome or "").lower() in qualified_set)
            results.append({
                "id": c.id,
                "name": c.name,
                "status": c.status,
                "leads": leads_count,
                "calls": calls_count,
                "qualified": qualified,
                "qualified_rate": (qualified / calls_count * 100.0) if calls_count else 0.0,
            })
        return results


class LeadCreate(BaseModel):
    name: str
    phone: str
    company: Optional[str] = None
    preferred_lang: Optional[str] = None
    role: Optional[str] = None
    consent_basis: Optional[str] = None
    consent_status: Optional[str] = None
    campaign_id: Optional[int] = None


@app.get("/leads")
async def list_leads(
    request: Request,
    campaign_id: Optional[int] = None,
    q: Optional[str] = None,
    country_iso: Optional[str] = None,
    preferred_lang: Optional[str] = None,
    role: Optional[str] = None,
    consent_status: Optional[str] = None,
    created_gte: Optional[str] = None,
    created_lte: Optional[str] = None,
    limit: Optional[int] = 25,
    offset: Optional[int] = 0,
) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        q = session.query(Lead)
        if tenant_id is not None:
            q = q.filter(Lead.tenant_id == tenant_id)
        if campaign_id is not None:
            q = q.filter(Lead.campaign_id == campaign_id)
        if country_iso:
            q = q.filter(Lead.country_iso == country_iso)
        if preferred_lang:
            q = q.filter(Lead.preferred_lang == preferred_lang)
        if role:
            q = q.filter(Lead.role == role)
        if consent_status:
            q = q.filter(Lead.consent_status == consent_status)
        if q is not None and q.strip():
            term = f"%{q.strip()}%"
            q = q.filter((Lead.name.like(term)) | (Lead.company.like(term)) | (Lead.phone.like(term)))
        # date filters ISO 8601
        try:
            if created_gte:
                gte = datetime.fromisoformat(created_gte)
                q = q.filter(Lead.created_at >= gte)
        except Exception:
            pass
        try:
            if created_lte:
                lte = datetime.fromisoformat(created_lte)
                q = q.filter(Lead.created_at <= lte)
        except Exception:
            pass
        total = q.count()
        # pagination
        safe_limit = max(1, min(int(limit or 25), 100))
        safe_offset = max(0, int(offset or 0))
        rows = (
            q.order_by(Lead.id.desc())
            .offset(safe_offset)
            .limit(safe_limit)
            .all()
        )
        return {
            "total": total,
            "limit": safe_limit,
            "offset": safe_offset,
            "items": [
                {
                    "id": l.id,
                    "name": l.name,
                    "company": l.company,
                    "phone": l.phone,
                    "country_iso": l.country_iso,
                    "preferred_lang": l.preferred_lang,
                    "role": l.role,
                    "consent_basis": l.consent_basis,
                    "consent_status": l.consent_status,
                    "campaign_id": l.campaign_id,
                    "created_at": l.created_at.isoformat(),
                }
                for l in rows
            ],
        }


@app.post("/leads")
async def create_lead(request: Request, body: LeadCreate) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        l = Lead(
            tenant_id=tenant_id,
            name=body.name,
            phone=body.phone,
            company=body.company,
            preferred_lang=body.preferred_lang,
            role=body.role,
            consent_basis=body.consent_basis,
            consent_status=body.consent_status or "unknown",
            country_iso=country_iso_from_e164(body.phone),
            campaign_id=body.campaign_id,
        )
        session.add(l)
        session.commit()
    return {"ok": True}


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    preferred_lang: Optional[str] = None
    role: Optional[str] = None
    consent_basis: Optional[str] = None
    consent_status: Optional[str] = None
    campaign_id: Optional[int] = None


@app.patch("/leads/{lead_id}")
async def update_lead(request: Request, lead_id: int, body: LeadUpdate) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        l = session.get(Lead, lead_id)
        if not l or (tenant_id is not None and l.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Lead not found")
        for field in ["name", "phone", "company", "preferred_lang", "role", "consent_basis", "consent_status", "campaign_id"]:
            val = getattr(body, field)
            if val is not None:
                setattr(l, field, val)
        if body.phone is not None:
            l.country_iso = country_iso_from_e164(body.phone)
        session.commit()
    return {"ok": True}


@app.delete("/leads/{lead_id}")
async def delete_lead(request: Request, lead_id: int) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        l = session.get(Lead, lead_id)
        if not l or (tenant_id is not None and l.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Lead not found")
        session.delete(l)
        session.commit()
    return {"ok": True}


@app.delete("/compliance/dnc/{entry_id}")
async def remove_dnc(request: Request, entry_id: int) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        d = session.get(DNCEntry, entry_id)
        if not d or (tenant_id is not None and d.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="DNC entry not found")
        session.delete(d)
        session.commit()
    return {"ok": True}


class ConsentCreate(BaseModel):
    number: Optional[str] = None
    type: str
    status: str
    source: Optional[str] = None
    proof_url: Optional[str] = None
    lead_id: Optional[int] = None


@app.post("/consents")
async def add_consent(request: Request, body: ConsentCreate) -> Dict[str, Any]:
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        c = Consent(
            tenant_id=tenant_id,
            lead_id=body.lead_id,
            number=body.number,
            type=body.type,
            status=body.status,
            source=body.source,
            proof_url=body.proof_url,
        )
        session.add(c)
        session.commit()
    return {"ok": True}
