import os
import json
from datetime import datetime, timezone, timedelta
import secrets
from typing import Optional
from fastapi import FastAPI, Request, Header, HTTPException, Response, Body
from fastapi import Query
from fastapi import Depends
from sqlalchemy.orm import Session
from db import Base, engine, get_db
from models import (
    User, Workspace, WorkspaceMember, Campaign, Call, UserAuth,
    Notification, NotificationTarget, Number, NumberVerification, InboundRoute,
    CallOutcome, Template, CrmConnection, MagicLink, CrmFieldMapping, ExportJob,
    # Knowledge Base models
    KnowledgeBase, KbSection, KbField, KbSource, KbChunk, KbAssignment, 
    KbHistory, KbImportJob, AiUsage,
)
from fastapi.middleware.cors import CORSMiddleware
from typing import Callable, Any
from sqlalchemy import or_
import hashlib
import pyotp
import random

try:
    # retell-sdk is optional during local dev, but required in prod for webhook verification
    from retell import Retell  # type: ignore
except Exception:  # pragma: no cover
    Retell = None  # type: ignore

try:
    import bcrypt  # type: ignore
except Exception:  # pragma: no cover
    bcrypt = None  # type: ignore

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover
    redis = None  # type: ignore

# Chromium PDF generator
PDF_GENERATOR_AVAILABLE = False
try:
    from pdf_chromium import html_to_pdf_chromium, check_chromium_available
    PDF_GENERATOR_AVAILABLE = check_chromium_available()
    if PDF_GENERATOR_AVAILABLE:
        print("✅ Chromium PDF generator available")
    else:
        print("⚠️ Chromium not found in PATH")
except Exception as e:
    print(f"Warning: Chromium PDF generator not available: {e}. Compliance attestations will use fallback.")

# Knowledge Base imports
import schemas
from ai_client import ai_client, get_kb_template, create_default_sections
from routers import crm


app = FastAPI(title="Agoralia API", version="0.1.0")
# ===================== In-memory store (dev) =====================
_ATTESTATIONS: dict[str, dict] = {}
_WORKSPACE_MEMBERS = [
    {"user_id": "u_1", "email": "owner@example.com", "role": "admin", "invited_at": None, "joined_at": "2025-08-01T10:00:00Z"}
]
_WORKSPACE_INVITES = []
_ACTIVITY = []
_CONCURRENCY = {"used": 1, "free": 9, "limit": 10, "by_queue": {"enterprise": 0, "pro": 1, "core": 0, "trial": 0}}

# ===================== Compliance compiled cache =====================
COMPILED_RULES_PATH = os.environ.get("COMPLIANCE_RULES_PATH") or os.path.join(os.path.dirname(__file__), "data", "compliance", "rules.v1.json")
_COMPLIANCE: dict[str, Any] = {"fused_by_iso": {}, "countries": []}

def _load_compliance_from_disk() -> None:
    try:
        with open(COMPILED_RULES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        # expected keys: fused_by_iso, countries
        fused = data.get("fused_by_iso") or {}
        countries = data.get("countries") or []
        # normalize iso keys to upper
        _COMPLIANCE["fused_by_iso"] = {str(k).upper(): v for k, v in fused.items()}
        _COMPLIANCE["countries"] = countries
    except Exception:
        _COMPLIANCE["fused_by_iso"] = {}
        _COMPLIANCE["countries"] = []

def _time_in_any_window(quiet_hours: dict | None, when: datetime) -> bool:
    if not quiet_hours:
        return True
    # quiet_hours describes allowed windows per weekday name (Mon, Tue, ...)
    # Example: {"Mon-Fri":[["10:00","13:00"],["14:00","20:00"]],"Sat":[],"Sun":[]}
    # Expand Mon-Fri ranges or per-day keys like "Mon","Tue" etc.
    weekday_map = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
    day_key = weekday_map.get(when.weekday())
    windows: list[list[str]] = []
    # Direct day
    if day_key and isinstance(quiet_hours.get(day_key), list):
        windows.extend(quiet_hours.get(day_key) or [])
    # Ranges like Mon-Fri
    for key, slots in (quiet_hours or {}).items():
        if isinstance(key, str) and "-" in key and isinstance(slots, list):
            try:
                start_d, end_d = key.split("-", 1)
                days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
                si, ei = days.index(start_d), days.index(end_d)
                if si <= ei and day_key and days.index(day_key) >= si and days.index(day_key) <= ei:
                    windows.extend(slots)
            except Exception:
                continue
    hh = when.hour
    mm = when.minute
    for start, end in windows:
        try:
            sh, sm = [int(x) for x in str(start).split(":", 1)]
            eh, em = [int(x) for x in str(end).split(":", 1)]
            start_min = sh * 60 + sm
            end_min = eh * 60 + em
            cur_min = hh * 60 + mm
            if start_min <= cur_min < end_min:
                return True
        except Exception:
            continue
    return False

_load_compliance_from_disk()
# Create tables if not exist (dev)
try:
    Base.metadata.create_all(bind=engine)
    # Seed minimal data if empty (dev)
    with next(get_db()) as db:
        if not db.query(User).first():
            db.add_all([
                User(id="u_1", email="owner@example.com", name="Owner One", is_admin_global=True),
                User(id="u_2", email="viewer@example.com", name="Viewer V", is_admin_global=False),
            ])
        if not db.query(Workspace).first():
            db.add(Workspace(id="ws_1", name="Demo", plan="core"))
        if not db.query(Campaign).first():
            db.add(Campaign(id="c_1", name="RFQ IT", status="running", pacing_npm=10, budget_cap_cents=15000))
        if not db.query(Call).first():
            db.add(Call(id="call_1", workspace_id="ws_1", lang="it-IT", iso="IT", status="finished", duration_s=210, cost_cents=42))
        # Seed simple password auth for demo users if bcrypt available
        if bcrypt is not None:
            def _ensure_auth(user_id: str, email: str):
                exists = db.query(UserAuth).filter(UserAuth.user_id == user_id, UserAuth.provider == "password").first()
                if not exists:
                    pwd = "demo1234".encode("utf-8")
                    hashed = bcrypt.hashpw(pwd, bcrypt.gensalt()).decode("utf-8")
                    db.add(UserAuth(id=f"ua_{user_id}", user_id=user_id, provider="password", provider_id=email, pass_hash=hashed))
            u1 = db.query(User).filter(User.id == "u_1").first()
            u2 = db.query(User).filter(User.id == "u_2").first()
            if u1:
                _ensure_auth(u1.id, u1.email)
            if u2:
                _ensure_auth(u2.id, u2.email)
        db.commit()
except Exception:
    pass

# Optional: auto-migrate on startup if enabled
try:
    if os.getenv("AUTO_MIGRATE", "0") == "1":
        from alembic import command
        from alembic.config import Config
        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
        alembic_cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "alembic"))
        alembic_cfg.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL", ""))
        command.upgrade(alembic_cfg, "head")
except Exception:
    # Ignore migration errors on environments without Alembic
    pass
# ===================== RBAC (very simple dev stub) =====================
def _role_from_request(req: Request | None) -> str:
    try:
        return (req.headers.get("X-Role") if req else None) or "admin"
    except Exception:
        return "admin"

def require_role(role: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        async def wrapper(*args, **kwargs):
            # Find Request in args/kwargs
            req: Request | None = kwargs.get("request")
            if req is None:
                for a in args:
                    if isinstance(a, Request):
                        req = a
                        break
            current = _role_from_request(req).lower()
            order = {"viewer": 1, "editor": 2, "admin": 3}
            if order.get(current, 0) < order.get(role, 3):
                raise HTTPException(status_code=403, detail="Forbidden")
            return await fn(*args, **kwargs)
        return wrapper
    return decorator

def audit(kind: str, entity: str):
    def decorator(fn):
        async def wrapper(*args, **kwargs):
            res = await fn(*args, **kwargs)
            _ACTIVITY.append({"kind": kind, "entity": entity, "created_at": "2025-08-18T10:00:00Z", "diff_json": res})
            return res
        return wrapper
    return decorator



# CORS configuration
front_origin = os.getenv("FRONTEND_ORIGIN")
origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
]
if front_origin:
    origins.append(front_origin)

# Allow Vercel preview subdomains by regex as well
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*vercel\\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================== Sessions & CSRF =====================
class SessionStore:
    def __init__(self) -> None:
        self._mem: dict[str, dict] = {}
        self._redis = None
        url = os.getenv("REDIS_URL") or os.getenv("REDIS_TLS_URL")
        if url and redis is not None:
            try:
                self._redis = redis.from_url(url, decode_responses=True)
            except Exception:
                self._redis = None

    def get(self, sid: str) -> Optional[dict]:
        try:
            if self._redis is not None:
                data = self._redis.get(f"sess:{sid}")
                return json.loads(data) if data else None
            return self._mem.get(sid)
        except Exception:
            return None

    def set(self, sid: str, data: dict, ttl_seconds: int = 60 * 60 * 24 * 14) -> None:
        data = dict(data)
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self._redis is not None:
            try:
                self._redis.setex(f"sess:{sid}", ttl_seconds, json.dumps(data))
                return
            except Exception:
                pass
        self._mem[sid] = data

    def delete(self, sid: str) -> None:
        if self._redis is not None:
            try:
                self._redis.delete(f"sess:{sid}")
            except Exception:
                pass
        self._mem.pop(sid, None)


_SESSIONS = SessionStore()


def _get_session(req: Request) -> Optional[dict]:
    sid = req.cookies.get("session_id")
    if not sid:
        return None
    sess = _SESSIONS.get(sid)
    # Basic expiration check (optional; rely on Redis TTL otherwise)
    return sess


def _create_session(resp: Response, claims: dict) -> dict:
    sid = secrets.token_urlsafe(24)
    csrf = secrets.token_urlsafe(24)
    sess = {"sid": sid, "csrf": csrf, "claims": claims}
    _SESSIONS.set(sid, sess)
    # HttpOnly, Lax for SPA
    resp.set_cookie("session_id", sid, httponly=True, samesite="lax", secure=False, path="/")
    resp.headers["x-csrf-token"] = csrf
    return sess


@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    try:
        if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith("/"):
            sess = _get_session(request)
            if sess is not None:
                sent = request.headers.get("x-csrf-token") or request.headers.get("X-CSRF-Token")
                if not sent or sent != sess.get("csrf"):
                    return Response(status_code=403, content="CSRF token missing or invalid")
        return await call_next(request)
    except Exception:
        return Response(status_code=500, content="Server error")


@app.get("/health")
def healthcheck() -> dict:
    return {"status": "ok"}


@app.get("/me/usage")
def get_me_usage() -> dict:
    # Minimal stub for staging; replace with real billing aggregation
    return {
        "minutes_mtd": 0,
        "minutes_cap": 1000,
    }

@app.get("/me/inbox")
def me_inbox(limit: int = 20) -> dict:
    # Minimal in-app inbox backed by Notification + NotificationTarget; return latest notifications regardless of user for demo
    try:
        with next(get_db()) as db:
            items = db.query(Notification).order_by(Notification.created_at.desc()).limit(limit).all()  # type: ignore[attr-defined]
            out = [{
                "id": n.id,
                "kind": n.kind,
                "subject": n.subject,
                "body_md": n.body_md,
                "sent_at": n.sent_at.isoformat() if n.sent_at else None,
            } for n in items]
            return {"items": out}
    except Exception:
        return {"items": []}


# ===================== Numbers Endpoints =====================
@app.get("/numbers")
def numbers_list(workspace_id: str | None = Query(default="ws_1"), db: Session = Depends(get_db)) -> dict:
    rows = db.query(Number).filter(Number.workspace_id == (workspace_id or "ws_1")).limit(100).all()
    items = [{
        "id": n.id, "e164": n.e164, "country_iso": n.country_iso, "source": n.source,
        "capabilities": n.capabilities or [], "verified": bool(n.verified), "provider": n.provider,
        "can_inbound": bool(n.can_inbound),
    } for n in rows]
    return {"items": items}


@app.post("/numbers/byo")
async def numbers_byo(payload: dict, db: Session = Depends(get_db)) -> dict:
    e164 = str(payload.get("e164") or "").strip()
    method = (payload.get("method") or "voice").lower()
    if not e164.startswith("+") or len(e164) < 8:
        raise HTTPException(status_code=400, detail="Invalid E.164")
    number_id = f"num_{int(datetime.now(timezone.utc).timestamp())}"
    v_id = f"nv_{number_id}"
    n = Number(id=number_id, workspace_id="ws_1", e164=e164, country_iso=e164[1:3], source="byo", capabilities=["outbound"], verified=False, verification_method=method)
    db.add(n)
    db.add(NumberVerification(id=v_id, number_id=number_id, method=method, code="123456", status="sent", attempts=0, last_sent_at=datetime.now(timezone.utc)))
    db.commit()
    return {"verification_id": v_id}


@app.post("/numbers/byo/confirm")
async def numbers_byo_confirm(payload: dict, db: Session = Depends(get_db)) -> dict:
    vid = payload.get("verification_id")
    code = str(payload.get("code") or "")
    ver = db.query(NumberVerification).filter(NumberVerification.id == vid).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Not found")
    if ver.code != code:
        ver.attempts = (ver.attempts or 0) + 1
        db.add(ver); db.commit()
        raise HTTPException(status_code=400, detail="Invalid code")
    ver.status = "ok"
    num = db.query(Number).filter(Number.id == ver.number_id).first()
    if num:
        num.verified = True
        num.verified_at = datetime.now(timezone.utc)
        db.add(num)
    db.add(ver); db.commit()
    return {"ok": True}


@app.post("/numbers/buy")
async def numbers_buy(payload: dict, db: Session = Depends(get_db)) -> dict:
    # Stub purchase
    iso = (payload.get("country_iso") or "US").upper()
    e164 = "+1" + str(int(datetime.now(timezone.utc).timestamp()))[-9:]
    num_id = f"num_{int(datetime.now(timezone.utc).timestamp())}"
    n = Number(id=num_id, workspace_id="ws_1", e164=e164, country_iso=iso, source="agoralia", capabilities=["outbound","inbound"], verified=True, verification_method="none", provider="retell", provider_ref="prov_demo", can_inbound=True)
    db.add(n); db.commit()
    return {"id": num_id, "e164": e164}


@app.post("/numbers/{number_id}/route")
async def numbers_route(number_id: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    r = InboundRoute(id=f"rt_{number_id}", number_id=number_id, agent_id=payload.get("agent_id"), hours_json=payload.get("hours_json"), voicemail=bool(payload.get("voicemail")), transcript=bool(payload.get("transcript")))
    db.add(r); db.commit()
    return {"ok": True}


@app.patch("/workspaces/{ws_id}/default_from")
async def ws_set_default_from(ws_id: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    w = db.query(Workspace).filter(Workspace.id == ws_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Not found")
    w.default_from_number_e164 = payload.get("e164")
    db.add(w); db.commit()
    return {"ok": True}


@app.patch("/campaigns/{cid}/from_number")
async def campaign_set_from(cid: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    c = db.query(Campaign).filter(Campaign.id == cid).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    c.from_number_e164 = payload.get("e164")
    db.add(c); db.commit()
    return {"ok": True}


# ===================== Outcomes Endpoints =====================
@app.get("/calls/{call_id}/outcome")
def get_outcome(call_id: str, db: Session = Depends(get_db)) -> dict:
    o = db.query(CallOutcome).filter(CallOutcome.call_id == call_id).first()
    if not o:
        return {"outcome": None}
    return {"outcome": {
        "template_name": o.template_name,
        "fields": o.fields_json,
        "summary_short": o.ai_summary_short,
        "summary_long": o.ai_summary_long,
        "action_items": o.action_items_json,
        "sentiment": o.sentiment,
        "score_lead": o.score_lead,
        "next_step": o.next_step,
    }}


@app.patch("/calls/{call_id}/outcome")
async def patch_outcome(call_id: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    o = db.query(CallOutcome).filter(CallOutcome.call_id == call_id).first()
    if not o:
        o = CallOutcome(id=f"out_{call_id}", call_id=call_id, workspace_id="ws_1", template_name=payload.get("template_name") or "B2B Qualification")
    o.fields_json = payload.get("fields_json") or o.fields_json
    o.next_step = payload.get("next_step") or o.next_step
    o.updated_at = datetime.now(timezone.utc)
    db.add(o); db.commit()
    return {"ok": True}

@app.get("/dashboard/summary")
def dashboard_summary() -> dict:
        return {
        "minutes_mtd": 0,
        "minutes_cap": 1000,
        "calls_today": 0,
        "success_rate": 0.0,
        "avg_duration_sec": 0,
        "p95_turn_taking_ms": 0,
        "errors_24h": 0,
    }

@app.get("/calls/live")
def calls_live() -> dict:
        return {
        "items": []
    }

@app.get("/events/recent")
def events_recent(limit: int = 20) -> dict:
        return {
        "items": []
    }


def _require_admin(email_header: str | None):
    allowed = (os.getenv("ADMIN_EMAILS") or "").split(",")
    allowed = [e.strip() for e in allowed if e.strip()]
    if not email_header or (allowed and email_header not in allowed):
        raise HTTPException(status_code=403, detail="Admin required")


@app.get("/admin/health")
def admin_health(x_admin_email: str | None = Header(default=None)) -> dict:
    _require_admin(x_admin_email)
    # Minimal stub; replace with real checks (DB, Redis, R2, Retell)
    return {
        "services": [
            {"name": "DB", "status": "ok"},
            {"name": "Redis", "status": "ok"},
            {"name": "R2", "status": "ok"},
            {"name": "Retell", "status": "ok"},
        ]
    }


# ===================== Admin guard & helpers =====================
def require_global_admin(x_admin_email: str | None = Header(default=None), admin_email: str | None = Query(default=None)) -> None:
    """Global admin requirement for /admin/* routes.

    Uses env var ADMIN_EMAILS=comma,separated,list to validate.
    """
    # Prefer header; fallback to query param in case proxies strip custom headers
    chosen = x_admin_email or admin_email
    # Allow wildcard
    wildcard = (os.getenv("ADMIN_EMAILS") or "").strip()
    if wildcard == "*":
        return
    # If a valid session exists with is_admin_global, allow
    # Note: FastAPI dependency cannot access Request directly here; handled by endpoints passing Request if needed
    if chosen:
        _require_admin(chosen)
        return
    # Without header, disallow by default; endpoints that need session-based admin can pass Request and validate explicitly
    raise HTTPException(status_code=403, detail="Admin required")


def require_admin_or_session(request: Request, x_admin_email: str | None = Header(default=None), admin_email: str | None = Query(default=None)) -> None:
    chosen = x_admin_email or admin_email
    wildcard = (os.getenv("ADMIN_EMAILS") or "").strip()
    if wildcard == "*":
        return
    if chosen:
        _require_admin(chosen)
        return
    sess = _get_session(request)
    claims = (sess or {}).get("claims") if sess else None
    if not claims or not claims.get("is_admin_global"):
        raise HTTPException(status_code=403, detail="Admin required")


def admin_guard(request: Request, x_admin_email: str | None = Header(default=None), admin_email: str | None = Query(default=None)) -> None:
    return require_admin_or_session(request, x_admin_email, admin_email)


# ===================== Admin read-only endpoints (MVP scaffolding) =====================
@app.get("/admin/users")
def admin_users(
    request: Request,
    query: str | None = Query(default=None),
    country_iso: str | None = Query(default=None),
    plan: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    cursor: str | None = Query(default=None),
    _guard: None = Depends(admin_guard),
    db: Session = Depends(get_db),
) -> dict:
    q = db.query(User)
    if query:
        like = f"%{query}%"
        q = q.filter((User.email.ilike(like)) | (User.name.ilike(like)))
    rows = q.limit(limit).all()
    items = [{
        "id": u.id, "email": u.email, "name": u.name, "locale": u.locale, "tz": u.tz,
        "is_admin_global": u.is_admin_global, "last_login_at": (u.last_login_at.isoformat() if u.last_login_at else None),
        "workspaces": [], "status": "active"
    } for u in rows]
    return {"items": items, "next_cursor": None}


@app.get("/admin/users/{user_id}")
def admin_user_detail(user_id: str, request: Request, _guard: None = Depends(admin_guard), db: Session = Depends(get_db)) -> dict:
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Not found")
    return {"id": u.id, "email": u.email, "name": u.name, "locale": u.locale, "tz": u.tz, "memberships": [], "usage_30d": {"minutes": 0, "calls": 0}, "last_login_at": (u.last_login_at.isoformat() if u.last_login_at else None), "status": "active"}


@app.post("/admin/users/{user_id}/impersonate")
async def admin_user_impersonate(user_id: str, request: Request, _guard: None = Depends(admin_guard)) -> dict:
    token = f"imp_{user_id}_token"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    _ACTIVITY.append({
        "kind": "impersonate",
        "entity": "user",
        "entity_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "diff_json": {"token": token, "expires_at": expires_at, "actor": "admin"},
    })
    return {"token": token, "expires_at": expires_at}


@app.patch("/admin/users/{user_id}")
async def admin_user_patch(user_id: str, request: Request, payload: dict, _guard: None = Depends(admin_guard), db: Session = Depends(get_db)) -> dict:
    # Accept simple fields: locale, tz, status
    locale = payload.get("locale")
    tz = payload.get("tz")
    status = payload.get("status")
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Not found")
    if locale: u.locale = locale
    if tz: u.tz = tz
    db.add(u); db.commit()
    return {"id": user_id, "updated": True, "locale": u.locale, "tz": u.tz, "status": status}


@app.get("/admin/workspaces")
def admin_workspaces(
    request: Request,
    query: str | None = Query(default=None),
    plan: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    cursor: str | None = Query(default=None),
    _guard: None = Depends(admin_guard),
    db: Session = Depends(get_db),
) -> dict:
    q = db.query(Workspace)
    if query:
        q = q.filter(Workspace.name.ilike(f"%{query}%"))
    rows = q.limit(limit).all()
    items = [{"id": w.id, "name": w.name, "plan": w.plan, "concurrency_limit": _CONCURRENCY.get("limit", 10), "members": 0, "minutes_mtd": 0, "spend_mtd_cents": 0} for w in rows]
    return {"items": items, "next_cursor": None}


@app.get("/admin/workspaces/{ws_id}")
def admin_workspace_detail(ws_id: str, request: Request, _guard: None = Depends(admin_guard), db: Session = Depends(get_db)) -> dict:
    w = db.query(Workspace).filter(Workspace.id == ws_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Not found")
    return {"id": w.id, "name": w.name, "plan": w.plan, "members": _WORKSPACE_MEMBERS, "campaigns": [], "usage_30d": [], "credits_cents": 0, "suspended": False}


@app.get("/admin/billing/overview")
def admin_billing_overview(request: Request, period: str | None = Query(default=None), _guard: None = Depends(admin_guard)) -> dict:
    return {"period": period or "2025-08", "mrr_cents": 0, "arr_cents": 0, "arpu_cents": 0, "churn_rate": 0.0}


@app.get("/admin/usage/overview")
def admin_usage_overview(request: Request, period: str | None = Query(default=None), _guard: None = Depends(admin_guard)) -> dict:
    return {
        "period": period or "2025-08",
        "by_lang": [{"lang": "it-IT", "minutes": 0, "cost_cents": 0}],
        "by_country": [{"iso": "IT", "minutes": 0, "cost_cents": 0}],
        "provider": [{"name": "retell", "minutes": 0, "avg_ttfb_ms": 0}],
    }


@app.get("/admin/calls/search")
def admin_calls_search(
    request: Request,
    query: str | None = Query(default=None),
    iso: str | None = Query(default=None),
    lang: str | None = Query(default=None),
    agent: str | None = Query(default=None),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    cursor: str | None = Query(default=None),
    _guard: None = Depends(admin_guard),
    db: Session = Depends(get_db),
) -> dict:
    q = db.query(Call)
    if iso: q = q.filter(Call.iso == iso)
    if lang: q = q.filter(Call.lang == lang)
    if status: q = q.filter(Call.status == status)
    rows = q.order_by(Call.created_at.desc()).limit(limit).all()
    items = [{"id": c.id, "workspace_id": c.workspace_id, "lang": c.lang, "iso": c.iso, "status": c.status, "duration_s": c.duration_s, "cost_cents": c.cost_cents} for c in rows]
    return {"items": items, "next_cursor": None}


@app.get("/admin/campaigns")
def admin_campaigns(
    request: Request,
    query: str | None = Query(default=None),
    status: str | None = Query(default=None),
    owner: str | None = Query(default=None),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    _guard: None = Depends(admin_guard),
    db: Session = Depends(get_db),
) -> dict:
    q = db.query(Campaign)
    if status: q = q.filter(Campaign.status == status)
    rows = q.limit(50).all()
    return {"items": [{"id": c.id, "name": c.name, "status": c.status, "pacing_npm": c.pacing_npm, "budget_cap_cents": c.budget_cap_cents} for c in rows]}


@app.post("/admin/campaigns/{campaign_id}/pause")
async def admin_campaign_pause(campaign_id: str, request: Request, _guard: None = Depends(admin_guard)) -> dict:
    return {"id": campaign_id, "status": "paused"}


@app.post("/admin/campaigns/{campaign_id}/resume")
async def admin_campaign_resume(campaign_id: str, request: Request, _guard: None = Depends(admin_guard)) -> dict:
    return {"id": campaign_id, "status": "running"}


@app.get("/admin/search")
def admin_search(request: Request, q: str, _guard: None = Depends(admin_guard), db: Session = Depends(get_db)) -> dict:
    """Unified global search across users, workspaces, calls, and campaigns"""
    if not q or len(q.strip()) < 2:
        return {"users": [], "workspaces": [], "calls": [], "campaigns": []}
    
    query = q.strip().lower()
    results = {
        "users": [],
        "workspaces": [], 
        "calls": [],
        "campaigns": []
    }
    
    try:
        # Search users by email or name
        users = db.query(User).filter(
            or_(
                User.email.ilike(f"%{query}%"),
                User.name.ilike(f"%{query}%")
            )
        ).limit(5).all()
        results["users"] = [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "is_admin_global": u.is_admin_global,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None
            }
            for u in users
        ]
        
        # Search workspaces by name
        workspaces = db.query(Workspace).filter(
            Workspace.name.ilike(f"%{query}%")
        ).limit(5).all()
        results["workspaces"] = [
            {
                "id": w.id,
                "name": w.name,
                "created_at": w.created_at.isoformat() if w.created_at else None
            }
            for w in workspaces
        ]
        
        # Search calls by phone number, language, or ISO
        calls = db.query(Call).filter(
            or_(
                Call.to.ilike(f"%{query}%"),
                Call.from_.ilike(f"%{query}%"),
                Call.lang.ilike(f"%{query}%"),
                Call.iso.ilike(f"%{query}%")
            )
        ).limit(5).all()
        results["calls"] = [
            {
                "id": c.id,
                "workspace_id": c.workspace_id,
                "to": c.to,
                "from": c.from_,
                "lang": c.lang,
                "iso": c.iso,
                "status": c.status,
                "started_at": c.started_at.isoformat() if c.started_at else None
            }
            for c in calls
        ]
        
        # Search campaigns by name or goal
        campaigns = db.query(Campaign).filter(
            or_(
                Campaign.name.ilike(f"%{query}%"),
                Campaign.goal.ilike(f"%{query}%"),
                Campaign.role.ilike(f"%{query}%")
            )
        ).limit(5).all()
        results["campaigns"] = [
            {
                "id": c.id,
                "name": c.name,
                "goal": c.goal,
                "role": c.role,
                "lang_default": c.lang_default,
                "status": c.status,
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in campaigns
        ]
        
    except Exception as e:
        # Fallback to mock data if DB query fails
        print(f"Search query failed: {e}")
        results = {
            "users": [{"id": "u_1", "email": "owner@example.com", "name": "Owner", "is_admin_global": True}][:5],
            "workspaces": [{"id": "ws_1", "name": "Demo"}][:5],
            "calls": [{"id": "call_1", "to": "+390212345678", "lang": "it-IT", "iso": "IT"}][:5],
            "campaigns": [{"id": "c_1", "name": "RFQ IT", "goal": "rfq", "role": "supplier"}][:5],
        }
    
    return results


# ===================== Admin: Calls & Campaigns =====================
@app.get("/admin/calls/live")
def admin_calls_live(
    request: Request,
    workspace_id: str | None = Query(default=None),
    lang: str | None = Query(default=None),
    _guard: None = Depends(admin_guard),
) -> dict:
    # Demo: no live calls
    return {"items": []}


@app.get("/admin/calls/{call_id}")
def admin_call_detail(call_id: str, request: Request, _guard: None = Depends(admin_guard)) -> dict:
    return {
        "id": call_id,
        "workspace_id": "ws_1",
        "provider": "retell",
        "lang": "it-IT",
        "iso": "IT",
        "status": "finished",
        "duration_s": 210,
        "cost_cents": 42,
        "transcript_url": "/calls/transcript/demo",
    }


# ===================== Admin: Compliance =====================
@app.get("/admin/compliance/attestations")
def admin_attestations(
    request: Request,
    workspace_id: str | None = Query(default=None),
    campaign_id: str | None = Query(default=None),
    iso: str | None = Query(default=None),
    _guard: None = Depends(admin_guard),
) -> dict:
    items = [
        {"id": "att_1", "workspace_id": "ws_1", "campaign_id": "c_1", "iso": "IT", "notice_version": "it-2025-08-01", "signed_at": "2025-08-18T10:00:00Z", "pdf_url": "/attestations/att_1"},
    ]
    # naive filters
    if workspace_id:
        items = [x for x in items if x.get("workspace_id") == workspace_id]
    if campaign_id:
        items = [x for x in items if x.get("campaign_id") == campaign_id]
    if iso:
        items = [x for x in items if x.get("iso") == iso.upper()]
    return {"items": items}


@app.post("/pdf/generate")
async def generate_pdf(payload: dict):
    """Generate PDF from HTML using Chromium headless"""
    try:
        html = payload.get("html") or "<html><body><h1>Empty</h1></body></html>"
        landscape = payload.get("landscape", False)
        format = payload.get("format", "A4")
        
        if not PDF_GENERATOR_AVAILABLE:
            raise HTTPException(status_code=503, detail="PDF generator not available")
        
        pdf_bytes = html_to_pdf_chromium(html, landscape=landscape, format=format)
        
        return {
            "ok": True,
            "size_bytes": len(pdf_bytes),
            "format": format,
            "landscape": landscape
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation error: {str(e)}")

@app.post("/admin/compliance/attestations/generate")
async def admin_attestations_generate(request: Request, payload: dict, _guard: None = Depends(admin_guard)) -> dict:
    """Generate compliance attestation PDF"""
    try:
        workspace_id = payload.get("workspace_id")
        campaign_id = payload.get("campaign_id")
        iso = payload.get("iso", "US")
        inputs = payload.get("inputs", {})
        
        if not workspace_id:
            raise HTTPException(status_code=400, detail="workspace_id is required")
        
        if PDF_GENERATOR_AVAILABLE:
            # Use Chromium PDF generator
            from pdf_chromium import html_to_pdf_chromium
            
            # Generate HTML content (you can customize this)
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Compliance Attestation</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 40px; }}
                    .header {{ text-align: center; margin-bottom: 30px; }}
                    .content {{ line-height: 1.6; }}
                    .footer {{ margin-top: 40px; text-align: center; font-size: 12px; }}
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Compliance Attestation</h1>
                    <p>Generated on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
                </div>
                <div class="content">
                    <h2>Details</h2>
                    <p><strong>Workspace:</strong> {workspace_id}</p>
                    <p><strong>Campaign:</strong> {campaign_id}</p>
                    <p><strong>Country:</strong> {iso}</p>
                    <p><strong>Inputs:</strong> {json.dumps(inputs, indent=2)}</p>
                </div>
                <div class="footer">
                    <p>Generated by Agoralia Compliance System</p>
                </div>
            </body>
            </html>
            """
            
            # Generate PDF
            pdf_bytes = html_to_pdf_chromium(html_content, format="A4")
            
            # Create attestation record
            att_id = f"att_{len(_ATTESTATIONS)+1}"
            attestation = {
                "id": att_id,
                "workspace_id": workspace_id,
                "campaign_id": campaign_id,
                "iso": iso,
                "inputs": inputs,
                "pdf_content": pdf_bytes,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "signed_by_user_id": "admin_user"
            }
            
            # Store attestation in database (in production)
            att_id = attestation['id']
            _ATTESTATIONS[att_id] = {
                "id": att_id,
                "workspace_id": workspace_id,
                "campaign_id": campaign_id,
                "iso": iso,
                "inputs": inputs,
                "pdf_url": f"/attestations/{att_id}",
                "sha256": attestation['hash'],
                "generated_at": attestation['generated_at'],
                "signed_by_user_id": attestation['signed_by_user_id']
            }
            
            return {
                "id": att_id,
                "pdf_url": f"/attestations/{att_id}",
                "sha256": attestation['hash'],
                "message": "PDF generated successfully"
            }
        else:
            # Fallback to mock attestation
            att_id = f"att_{len(_ATTESTATIONS)+1}"
            _ATTESTATIONS[att_id] = {
                "id": att_id,
                "workspace_id": workspace_id,
                "campaign_id": campaign_id,
                "iso": iso,
                "inputs": inputs,
                "pdf_url": f"/attestations/{att_id}",
                "sha256": "sha256:fallback",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "signed_by_user_id": "admin_user"
            }
            
            return {
                "id": att_id,
                "pdf_url": f"/attestations/{att_id}",
                "sha256": "sha256:fallback",
                "message": "Mock attestation created (PDF generator not available)"
            }
            
    except Exception as e:
        print(f"Failed to generate attestation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate attestation: {str(e)}")


@app.get("/admin/compliance/preflight/logs")
def admin_preflight_logs(
    request: Request,
    workspace_id: str | None = Query(default=None),
    iso: str | None = Query(default=None),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    _guard: None = Depends(admin_guard),
) -> dict:
    items = [
        {"id": "pfl_1", "workspace_id": "ws_1", "iso": "IT", "decision": "delay", "reasons": ["QUIET_HOURS"], "created_at": "2025-08-18T08:00:00Z"},
        {"id": "pfl_2", "workspace_id": "ws_1", "iso": "IT", "decision": "block", "reasons": ["DNC_HIT"], "created_at": "2025-08-18T09:00:00Z"},
    ]
    if workspace_id:
        items = [x for x in items if x.get("workspace_id") == workspace_id]
    if iso:
        items = [x for x in items if x.get("iso") == iso.upper()]
    return {"items": items}


# ===================== Admin: Billing =====================
@app.get("/admin/workspaces/{ws_id}/billing")
def admin_ws_billing(ws_id: str, request: Request, _guard: None = Depends(admin_guard)) -> dict:
    return {"workspace_id": ws_id, "plan": "core", "subscription_status": "active", "current_period_end": "2025-09-01", "credits_cents": 0}


@app.post("/admin/workspaces/{ws_id}/credits")
async def admin_ws_add_credit(ws_id: str, request: Request, payload: dict, _guard: None = Depends(admin_guard)) -> dict:
    cents = int(payload.get("cents") or 0)
    return {"workspace_id": ws_id, "added_cents": cents, "created_at": datetime.now(timezone.utc).isoformat()}


# ===================== Admin: Compliance templates (read-only) =====================
@app.get("/admin/compliance/templates")
def admin_compliance_templates(request: Request, _guard: None = Depends(admin_guard)) -> dict:
    templates = [
        {"iso": "IT", "lang": "it-IT", "disclosure": "Buongiorno...", "recording": "La chiamata può essere registrata...", "version": "it-2025-08-01"},
        {"iso": "EN", "lang": "en-US", "disclosure": "Hello, this is an AI assistant...", "recording": "This call may be recorded...", "version": "en-2025-08-01"},
    ]
    return {"items": templates}


@app.patch("/admin/workspaces/{ws_id}")
async def admin_ws_patch(ws_id: str, request: Request, payload: dict, _guard: None = Depends(admin_guard)) -> dict:
    # Accept: plan_id, concurrency_limit, suspend
    plan_id = payload.get("plan_id")
    concurrency_limit = payload.get("concurrency_limit")
    suspend = payload.get("suspend")
    if isinstance(concurrency_limit, int):
        _CONCURRENCY["limit"] = max(0, concurrency_limit)
        _CONCURRENCY["free"] = max(0, _CONCURRENCY["limit"] - _CONCURRENCY["used"])
    return {"id": ws_id, "updated": True, "plan_id": plan_id, "concurrency_limit": _CONCURRENCY["limit"], "suspended": bool(suspend)}


# ===================== Admin: Notifications =====================
@app.post("/admin/notifications/preview")
async def admin_notifications_preview(request: Request, payload: dict, _guard: None = Depends(admin_guard)) -> dict:
    subject = payload.get("subject") or ""
    body_md = payload.get("body_md") or ""
    html = f"<h1>{subject}</h1><div><pre>{body_md}</pre></div>"
    return {"html": html}


@app.post("/admin/notifications/send")
async def admin_notifications_send(request: Request, payload: dict, _guard: None = Depends(admin_guard)) -> dict:
    kind = (payload.get("kind") or "email").lower()
    locale = payload.get("locale") or "en-US"
    subject = payload.get("subject") or ""
    body_md = payload.get("body_md") or ""
    user_ids = payload.get("user_ids") or []
    if not user_ids:
        user_ids = ["owner@example.com", "viewer@example.com"]
    notif_id = f"ntf_{int(datetime.now(timezone.utc).timestamp())}"
    with next(get_db()) as db:
        n = Notification(id=notif_id, kind=kind, locale=locale, subject=subject, body_md=body_md, sent_at=None, stats_json={"queued": len(user_ids)})
        db.add(n)
        for uid in user_ids:
            db.add(NotificationTarget(notification_id=notif_id, user_id=str(uid)))
        db.commit()
    _ACTIVITY.append({"kind": "notify", "entity": "notification", "entity_id": notif_id, "created_at": datetime.now(timezone.utc).isoformat(), "diff_json": {"kind": kind, "subject": subject}})
    try:
        from .worker import send_notification_job  # type: ignore
        if send_notification_job:
            send_notification_job.send(notif_id)  # type: ignore
    except Exception:
        pass
    return {"id": notif_id, "scheduled_at": payload.get("schedule_at"), "kind": kind, "stats": {"queued": len(user_ids)}}


@app.get("/admin/notifications/{notif_id}")
def admin_notifications_get(notif_id: str, request: Request, _guard: None = Depends(admin_guard)) -> dict:
    with next(get_db()) as db:
        n = db.query(Notification).filter(Notification.id == notif_id).first()
        if not n:
            return {"id": notif_id, "stats": {}}
        return {"id": notif_id, "kind": n.kind, "subject": n.subject, "stats": n.stats_json or {}}


# ===================== Admin: Activity =====================
@app.get("/admin/activity")
def admin_activity(request: Request, limit: int = 100, _guard: None = Depends(admin_guard)) -> dict:
    try:
        return {"items": list(reversed(_ACTIVITY))[: limit if isinstance(limit, int) else 100]}
    except Exception:
        return {"items": []}


# ===================== Auth endpoints =====================
@app.post("/auth/login")
async def auth_login(payload: dict) -> Response:
    email = (payload.get("email") or "").strip().lower()
    password = (payload.get("password") or "").encode("utf-8")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Missing email or password")
    with next(get_db()) as db:
        user = db.query(User).filter(User.email.ilike(email)).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        ua = db.query(UserAuth).filter(UserAuth.user_id == user.id, UserAuth.provider == "password").first()
        if not ua or not ua.pass_hash or bcrypt is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        try:
            ok = bcrypt.checkpw(password, ua.pass_hash.encode("utf-8"))
        except Exception:
            ok = False
        if not ok:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        # Build claims (memberships minimal for now)
        claims = {
            "user_id": user.id,
            "email": user.email,
            "is_admin_global": bool(user.is_admin_global),
            "memberships": [],
        }
    resp = Response(content=json.dumps({"ok": True}), media_type="application/json")
    _create_session(resp, claims)
    return resp


@app.get("/auth/me")
def auth_me(request: Request) -> dict:
    sess = _get_session(request)
    if not sess:
        return {"authenticated": False}
    return {"authenticated": True, "claims": sess.get("claims"), "csrf": sess.get("csrf")}


@app.post("/auth/logout")
async def auth_logout(request: Request) -> Response:
    sid = request.cookies.get("session_id")
    if sid:
        _SESSIONS.delete(sid)
    resp = Response(content=json.dumps({"ok": True}), media_type="application/json")
    resp.delete_cookie("session_id", path="/")
    return resp
    try:
        return {"items": list(reversed(_ACTIVITY))[: limit if isinstance(limit, int) else 100]}
    except Exception:
        return {"items": []}

# ===================== Sprint 2 stubs =====================

@app.get("/leads")
def list_leads(
    query: str | None = Query(default=None),
    limit: int = Query(default=25),
    offset: int = Query(default=0),
    sort: str | None = Query(default=None),
) -> dict:
    items = [
        {"id": "l_101", "name": "Mario Rossi", "company": "Rossi Srl", "phone_e164": "+390212345678", "country_iso": "IT", "lang": "it-IT", "role": "supplier", "consent": True, "created_at": "2025-08-17T09:12:00Z"},
        {"id": "l_102", "name": "Claire Dubois", "company": "Dubois SA", "phone_e164": "+33123456789", "country_iso": "FR", "lang": "fr-FR", "role": "supplied", "consent": False, "created_at": "2025-08-16T15:02:00Z"},
    ]
    return {"total": 244, "items": items}


@app.post("/leads")
async def create_lead(payload: dict) -> dict:
    # Echo back with a fake id
    payload = dict(payload)
    payload["id"] = "l_new"
    return payload


@app.post("/schedule")
async def schedule_call(payload: dict) -> dict:
    # Enrich with Retell metadata scripts (stub)
    e164 = payload.get("to") or payload.get("phone_e164") or "+390212345678"
    lang = payload.get("lang") or "en-US"
    iso = "IT" if str(e164).startswith("+39") else ("FR" if str(e164).startswith("+33") else "US")
    rules = {
        "disclosure": "Buongiorno, sono un assistente virtuale di {Company}.",
        "record_consent": "La chiamata può essere registrata. Desidera procedere?",
        "fallback": "Posso inviarle le informazioni via email.",
        "version": "it-2025-08-01",
    }
    retell_metadata = {"kb": {"rules": rules, "iso": iso, "lang": lang, "direction": "outbound"}}
    return {"scheduled": True, "payload": payload, "retell_metadata": retell_metadata}


@app.post("/schedule/bulk")
async def schedule_bulk(payload: dict) -> dict:
    # Attach one script example for the batch (stub)
    retell_metadata = {"kb": {"rules": {"disclosure": "Hello, virtual assistant.", "record_consent": "This call may be recorded.", "fallback": "We can email details.", "version": "en-2025-08-01"}}}
    return {"scheduled": len(payload.get("lead_ids", [])), "retell_metadata": retell_metadata}


@app.get("/i18n/locales")
def get_locales() -> dict:
    return {
        "ui_supported": ["en-US", "it-IT", "fr-FR", "hi-IN", "ar-EG", "es-419", "pt-BR", "de-DE", "tr-TR", "id-ID", "vi-VN", "sw"],
        "ui_default": "en-US",
        "call_supported": [
            "en-US","en-GB","es-ES","es-419","fr-FR","de-DE","it-IT","pt-BR","pt-PT","tr-TR","vi-VN","id-ID","nl-NL","ru-RU","ja-JP","ko-KR","zh-CN"
        ],
        "call_default": "en-US",
        "prefer_detect": True,
    }


@app.post("/webhooks/retell")
async def webhook_retell(request: Request, x_retell_signature: str | None = Header(default=None)) -> Response:
    api_key = os.environ.get("RETELL_API_KEY", "")
    raw_body = await request.body()

    if Retell is None:
        # SDK missing; reject in production environment
        raise HTTPException(status_code=500, detail="retell-sdk not available")

    if not api_key or not x_retell_signature:
        raise HTTPException(status_code=400, detail="Missing signature or api key")

    try:
        # Retell.verify accepts raw bytes or string; pass bytes to avoid encoding issues
        is_valid = Retell.verify(raw_body, api_key, x_retell_signature)
    except Exception:
        raise HTTPException(status_code=400, detail="Signature verification error")

    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Process payload quickly (offload heavy work to background worker if needed)
    # payload = await request.json()
    return Response(status_code=204)


# ===================== Sprint 3 stubs =====================

@app.post("/campaigns")
async def create_campaign(payload: dict) -> dict:
    # Include default scripts into campaign metadata (stub)
    lang = payload.get("lang_default") or "en-US"
    rules = {
        "disclosure": "Buongiorno, sono un assistente virtuale di {Company}.",
        "record_consent": "La chiamata può essere registrata. Desidera procedere?",
        "fallback": "Posso inviarle le informazioni via email.",
        "version": "it-2025-08-01",
    }
    retell_metadata = {"kb": {"rules": rules, "lang": lang}}
    return {"id": "c_new", "retell_metadata": retell_metadata}


@app.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str) -> dict:
    return {"id": campaign_id, "name": "Sample", "status": "active", "pacing_npm": 10, "budget_cap_cents": 15000, "window": {"quiet_hours": True}}


@app.patch("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, payload: dict) -> dict:
    return {"id": campaign_id, "updated": True, "payload": payload}


@app.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(campaign_id: str) -> dict:
    return {"id": campaign_id, "status": "paused"}


@app.post("/campaigns/{campaign_id}/resume")
async def resume_campaign(campaign_id: str) -> dict:
    return {"id": campaign_id, "status": "active"}


@app.get("/campaigns/{campaign_id}/kpi")
def campaign_kpi(campaign_id: str) -> dict:
    return {"leads": 0, "calls": 0, "qualified": 0, "success_pct": 0.0, "cost_per_min": 0, "p95": 0}


@app.post("/campaigns/{campaign_id}/schedule")
async def campaign_schedule(campaign_id: str, payload: dict) -> dict:
    return {"scheduled": True}


@app.get("/campaigns/{campaign_id}/events")
def campaign_events(campaign_id: str, start: str | None = None, end: str | None = None) -> dict:
    return {"events": []}


@app.get("/calendar")
def calendar_events(start: str, end: str, scope: str = "tenant", campaign_id: str | None = None) -> dict:
    # Minimal example data within provided range
    try:
        # Return a couple of scheduled events at 10:00 and 14:00 on the start day
        from datetime import datetime, timezone
        start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
        day = datetime(start_dt.year, start_dt.month, start_dt.day, tzinfo=start_dt.tzinfo or timezone.utc)
        e1 = day.replace(hour=10)
        e2 = day.replace(hour=14)
        return {
            "events": [
                {"id": "sch_100", "kind": "scheduled", "title": "Call A", "at": e1.isoformat(), "lang": "it-IT"},
                {"id": "sch_200", "kind": "scheduled", "title": "Call B", "at": e2.isoformat(), "lang": "fr-FR"},
                {"id": "blk_1", "kind": "blocked", "title": "Quiet hours", "at": day.replace(hour=7).isoformat(), "end": day.replace(hour=8).isoformat()},
                {"id": "wrn_budget", "kind": "warn", "title": "Budget nearing 80%", "at": day.replace(hour=12).isoformat(), "reason": "BUDGET", "budget_used_pct": 82},
                {"id": "wrn_conc", "kind": "warn", "title": "Concurrency full", "at": day.replace(hour=11).isoformat(), "reason": "CONCURRENCY", "used": _CONCURRENCY.get("used",0), "limit": _CONCURRENCY.get("limit",0)},
            ]
        }
    except Exception:
        return {"events": []}


@app.patch("/schedule/{schedule_id}")
async def update_schedule(schedule_id: str, payload: dict) -> dict:
    # Demo validation: block hours outside 8-18 with QUIET_HOURS
    try:
        from datetime import datetime, timezone, timedelta
        if payload.get("cancel"):
            return {"id": schedule_id, "canceled": True}
        at = payload.get("at")
        if not at:
            return {"id": schedule_id, "updated": False}
        at_dt = datetime.fromisoformat(str(at).replace("Z", "+00:00"))
        hour = at_dt.hour
        if hour < 8 or hour >= 18:
            suggest = (at_dt.replace(hour=8, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()
            raise HTTPException(status_code=409, detail={
                "code": "QUIET_HOURS",
                "message": "Outside allowed hours",
                "suggest": ["next_window_at", suggest]
            })
        # Demo varying conflicts based on minute
        m = at_dt.minute % 10
        if m == 1:
            raise HTTPException(status_code=409, detail={"code": "RPO", "message": "RPO/DNC blocked", "iso": "IT"})
        if m == 2:
            raise HTTPException(status_code=409, detail={"code": "BUDGET", "message": "Budget reached"})
        if m == 3:
            # Demo concurrency detail with suggestion and metrics
            from datetime import timedelta
            next_slot = (at_dt + timedelta(minutes=15)).isoformat()
            raise HTTPException(status_code=409, detail={
                "code": "CONCURRENCY",
                "message": "No free slots",
                "suggest": ["next_window_at", next_slot],
                "used": _CONCURRENCY.get("used", 0),
                "free": _CONCURRENCY.get("free", 0),
                "limit": _CONCURRENCY.get("limit", 0),
            })
        return {"id": schedule_id, "at": at_dt.isoformat(), "updated": True}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")


# ===================== Sprint 4 stubs =====================

@app.get("/analytics/overview")
def analytics_overview(
    range: str | None = None,
    scope: str | None = None,
    lang: str | None = None,
    agent: str | None = None,
    country: str | None = None,
    outcome: str | None = None,
    direction: str | None = None,
) -> dict:
    return {
        "kpi": {
            "calls": 1240,
            "connected_rate": 0.62,
            "qualified_rate": 0.28,
            "avg_duration_sec": 146,
            "cost_per_min_eur": 0.12,
            "p95_ms": 540,
        },
        "charts": {
            "calls_over_time": [{"ts": "2025-08-01", "attempted": 120, "connected": 70, "finished": 68}],
            "outcomes_over_time": [{"ts": "2025-08-01", "qualified": 20, "not_interested": 18, "callback": 5, "voicemail": 10, "no_answer": 12, "failed": 5}],
            "lang_distribution": [{"lang": "it-IT", "calls": 420}, {"lang": "en-US", "calls": 360}, {"lang": "fr-FR", "calls": 210}],
            "agent_perf": [{"agent": "it-outbound-a", "qualified_rate": 0.31, "avg_duration_sec": 152}],
            "cost_minutes_over_time": [{"ts": "2025-08-01", "minutes": 220, "eur": 26.4}],
        },
        "tables": {
            "by_campaign": [{"id": "c_1", "name": "RFQ IT", "calls": 580, "qualified_rate": 0.29, "avg_duration_sec": 150, "cost_per_min_eur": 0.12, "p95_ms": 520}],
            "by_agent": [{"id": "a_1", "name": "it-outbound-a", "lang": "it-IT", "calls": 320, "qualified_rate": 0.31, "avg_duration_sec": 152, "cost_per_min_eur": 0.12, "p95_ms": 530}],
            "by_country": [{"iso": "IT", "calls": 600, "connected_rate": 0.66, "quiet_violations": 2, "rpo_blocks": 5}],
        },
    }


@app.get("/analytics/export.json")
def analytics_export_json(locale: str | None = None, range: str | None = None, scope: str | None = None) -> dict:
    return analytics_overview(range=range, scope=scope)


@app.get("/analytics/export.csv")
def analytics_export_csv(locale: str | None = None) -> Response:
    sep = ","
    head_map = {
        "en-US": ["metric", "value"],
        "it-IT": ["metrica", "valore"],
        "fr-FR": ["métrique", "valeur"],
        "hi-IN": ["मेट्रिक", "मान"],
        "ar-EG": ["المعيار", "القيمة"],
    }
    headers = sep.join(head_map.get(locale or "en-US", head_map["en-US"])) + "\n"
    body = sep.join(["calls", "1240"]) + "\n" + sep.join(["connected_rate", "0.62"]) + "\n"
    return Response(content=headers + body, media_type="text/csv")


@app.get("/history")
def history_list(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    q: str | None = Query(default=None),
    lang: str | None = Query(default=None),
    country: str | None = Query(default=None),
    agent: str | None = Query(default=None),
    outcome: str | None = Query(default=None),
    direction: str | None = Query(default=None),
    group_by: str | None = Query(default=None),
    limit: int = 25,
    offset: int = 0,
    sort: str | None = Query(default="-ts"),
) -> dict:
    items = [
        {"id": "call_9001", "ts": "2025-08-17T09:22:00Z", "direction": "outbound", "to": "+390212345678", "from": "+390298765432", "company": "Rossi Srl", "lang": "it-IT", "agent": "it-outbound-a", "outcome": "qualified", "duration_sec": 210, "cost_eur": 0.42},
        {"id": "call_9002", "ts": "2025-08-17T09:25:00Z", "direction": "outbound", "to": "+33123456789", "from": "+33987654321", "company": "Dubois SA", "lang": "fr-FR", "agent": "fr-outbound-a", "outcome": "no_answer", "duration_sec": 0, "cost_eur": 0.0},
    ]
    reverse = sort.startswith("-") if sort else True
    key = sort.lstrip("-") if sort else "ts"
    try:
        items.sort(key=lambda x: x.get(key, ""), reverse=reverse)
    except Exception:
        pass
    total = len(items)
    return {"total": total, "items": items[offset: offset+limit]}


@app.get("/history/{call_id}/brief")
def history_brief(call_id: str) -> dict:
    return {
        "id": call_id,
        "ts": "2025-08-17T09:22:00Z",
        "header": {"phone": "+390212345678", "company": "Rossi Srl", "lang": "it-IT", "agent": "it-outbound-a", "outcome": "qualified"},
        "last_turns": [{"role": "agent", "text": "Hello"}, {"role": "user", "text": "Hi"}],
        "summary": {"bullets": ["Qualified lead", "Requested callback next week"]},
        "cost": {"total_eur": 0.42, "minutes": 3.5},
    }


@app.get("/history/export.csv")
def history_export_csv(locale: str | None = None) -> Response:
    head_map = {
        "en-US": ["id","time","direction","to","from","company","outcome","duration_sec","cost_eur"],
        "it-IT": ["id","ora","direzione","a","da","azienda","esito","durata_sec","costo_eur"],
        "fr-FR": ["id","heure","direction","à","de","société","résultat","durée_sec","coût_eur"],
        "hi-IN": ["id","समय","दिशा","को","से","कंपनी","परिणाम","अवधि_सेक","लागत_यूरो"],
        "ar-EG": ["id","الوقت","الاتجاه","إلى","من","الشركة","النتيجة","المدة_ث","التكلفة_يورو"],
    }
    headers = ",".join(head_map.get(locale or "en-US", head_map["en-US"])) + "\n"
    row = ["call_9001","2025-08-17T09:22:00Z","outbound","+390212345678","+390298765432","Rossi Srl","qualified","210","0.42"]
    return Response(content=headers+",".join(row)+"\n", media_type="text/csv")


# ===================== Compliance & Call Settings (stubs) =====================

@app.post("/compliance/preflight")
async def compliance_preflight(payload: dict) -> dict:
    items = payload.get("items", [])
    out: list[dict] = []
    allow, delay, block = 0, 0, 0
    for it in items:
        e164 = it.get("e164", "")
        iso = (it.get("country_iso") or ("IT" if e164.startswith("+39") else "FR" if e164.startswith("+33") else "US")).upper()
        fused = _COMPLIANCE.get("fused_by_iso", {}).get(iso) or {}
        flags = fused.get("flags") or {}
        quiet_hours = fused.get("quiet_hours")
        sched_str = it.get("schedule_at") or datetime.now(timezone.utc).isoformat()
        try:
            sched_dt = datetime.fromisoformat(str(sched_str).replace("Z", "+00:00"))
        except Exception:
            sched_dt = datetime.now(timezone.utc)

        reasons: list[str] = []
        decision = "allow"

        # Quiet hours check → delay if outside allowed windows
        if flags.get("has_quiet_hours") and not _time_in_any_window(quiet_hours, sched_dt):
            decision = "delay"
            reasons.append("QUIET_HOURS")

        # DNC scrub requirement → block if explicit `dnc_hit` in request, otherwise mark requirement
        if flags.get("requires_dnc_scrub"):
            if it.get("dnc_hit") is True:
                decision = "block"
                reasons.append("DNC_HIT")
            else:
                reasons.append("DNC_REQUIRED")

        # Consent rules
        if flags.get("requires_consent_b2c") and it.get("contact_class") == "b2c" and not it.get("has_consent"):
            decision = "block"
            reasons.append("CONSENT_REQUIRED_B2C")
        if flags.get("requires_consent_b2b") and it.get("contact_class") == "b2b" and not it.get("has_consent"):
            decision = "block"
            reasons.append("CONSENT_REQUIRED_B2B")

        # Recording consent
        if flags.get("recording_requires_consent") and it.get("recording_enabled") and not it.get("recording_consent"):
            decision = "block"
            reasons.append("RECORDING_CONSENT_REQUIRED")

        # Automated calling
        if flags.get("allows_automated") is False and it.get("automated") is True:
            decision = "block"
            reasons.append("AUTOMATED_NOT_ALLOWED")

        next_window_at = None
        if decision == "delay" and flags.get("has_quiet_hours"):
            # naive: try next day at first allowed slot if present
            try:
                # find first window of following day
                day_ahead = (sched_dt + timedelta(days=1)).replace(second=0, microsecond=0)
                # try 08:00 as generic fallback
                next_window_at = day_ahead.replace(hour=8, minute=0).isoformat()
            except Exception:
                next_window_at = None

        if decision == "allow":
            allow += 1
        elif decision == "delay":
            delay += 1
        else:
            block += 1

        out.append({
            "e164": e164,
            "country_iso": iso,
            "decision": decision,
            "reasons": reasons,
            "required_scripts": [
                "AI_DISCLOSURE_REQ" if (fused.get("ai_disclosure") == "required") else None,
                "REC_CONSENT_REQ" if flags.get("recording_requires_consent") else None,
            ],
            "next_window_at": next_window_at,
            "warnings": ["LANG_NOT_SUPPORTED"] if it.get("call_lang") == "ar-EG" else [],
        })
    # cleanup None entries in required_scripts
    for it in out:
        it["required_scripts"] = [x for x in it.get("required_scripts", []) if x]
    return {"items": out, "summary": {"allow": allow, "delay": delay, "block": block}}


@app.get("/compliance/scripts")
def compliance_scripts(iso: str, lang: str, direction: str, contact_class: str) -> dict:
    return {
        "iso": iso,
        "lang": lang,
        "direction": direction,
        "class": contact_class,
        "disclosure": "Buongiorno, sono un assistente virtuale di {Company}.",
        "record_consent": "La chiamata può essere registrata. Desidera procedere?",
        "fallback": "Posso inviarle le informazioni via email.",
        "version": "it-2025-08-01",
    }


@app.get("/compliance/countries")
def compliance_countries() -> dict:
    # Returns list of countries with iso, confidence, last_verified
    try:
        countries = _COMPLIANCE.get("countries") or []
        # Ensure ISO upper
        for c in countries:
            if isinstance(c.get("iso"), str):
                c["iso"] = c["iso"].upper()
        return {"items": countries}
    except Exception:
        return {"items": []}


@app.get("/compliance/country/{iso}")
def compliance_country(iso: str) -> dict:
    iso_up = (iso or "").upper()
    fused = _COMPLIANCE.get("fused_by_iso", {}).get(iso_up)
    if not fused:
        raise HTTPException(status_code=404, detail="Not found")
    return fused


@app.post("/attestations")
async def attestations_create(payload: dict) -> dict:
    att_id = f"att_{len(_ATTESTATIONS)+1}"
    _ATTESTATIONS[att_id] = {"id": att_id, **payload}
    return {"id": att_id, "url": f"/attestations/{att_id}", "hash": "sha256:demo"}


@app.get("/attestations/{att_id}")
def attestations_get(att_id: str) -> Response:
    if att_id not in _ATTESTATIONS:
        raise HTTPException(status_code=404, detail="Not found")
    pdf = b"%PDF-1.4\n% demo stub\n"
    return Response(content=pdf, media_type="application/pdf")


# ===================== Workspaces & Concurrency (stubs) =====================

@app.get("/metrics/account/concurrency")
def metrics_concurrency() -> dict:
    return _CONCURRENCY


@app.get("/workspaces/current")
def ws_current() -> dict:
    return {"id": "ws_1", "name": "Demo", "members": len(_WORKSPACE_MEMBERS)}


@app.get("/workspaces/members")
def ws_members() -> dict:
    return {"items": _WORKSPACE_MEMBERS}


@app.post("/workspaces/members/invite")
@audit("invite", "member")
@require_role("admin")
async def ws_invite(payload: dict, request: Request) -> dict:
    invite = {"id": f"inv_{len(_WORKSPACE_INVITES)+1}", "email": payload.get("email"), "role": payload.get("role","viewer"), "token": "demo-token", "invited_at": "2025-08-18T10:00:00Z"}
    _WORKSPACE_INVITES.append(invite)
    return invite


@app.get("/workspaces/activity")
def ws_activity(limit: int = 100) -> dict:
    return {"items": list(reversed(_ACTIVITY))[:limit]}


@app.post("/workspaces/members/accept")
async def ws_accept(payload: dict) -> dict:
    token = payload.get("token")
    inv = next((i for i in _WORKSPACE_INVITES if i.get("token") == token), None)
    if not inv:
        raise HTTPException(status_code=400, detail="Invalid token")
    new_member = {"user_id": f"u_{len(_WORKSPACE_MEMBERS)+1}", "email": inv["email"], "role": inv.get("role","viewer"), "invited_at": inv.get("invited_at"), "joined_at": "2025-08-18T12:00:00Z"}
    _WORKSPACE_MEMBERS.append(new_member)
    inv["accepted_at"] = "2025-08-18T12:00:00Z"
    return {"joined": True, "member": new_member}


@app.patch("/workspaces/members/{user_id}")
@require_role("admin")
async def ws_change_role(user_id: str, payload: dict, request: Request) -> dict:
    role = payload.get("role")
    found = next((m for m in _WORKSPACE_MEMBERS if m.get("user_id") == user_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="Not found")
    found["role"] = role
    return {"updated": True}


@app.delete("/workspaces/members/{user_id}")
@require_role("admin")
async def ws_remove(user_id: str, request: Request) -> dict:
    idx = next((i for i,m in enumerate(_WORKSPACE_MEMBERS) if m.get("user_id") == user_id), -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail="Not found")
    _WORKSPACE_MEMBERS.pop(idx)
    return {"deleted": True}


@app.post("/worker/call/start")
def worker_call_start() -> dict:
    if _CONCURRENCY["free"] <= 0:
        raise HTTPException(status_code=409, detail={"code": "CONCURRENCY"})
    _CONCURRENCY["used"] += 1
    _CONCURRENCY["free"] = max(0, _CONCURRENCY["limit"] - _CONCURRENCY["used"])
    return _CONCURRENCY


@app.post("/worker/call/finish")
def worker_call_finish() -> dict:
    _CONCURRENCY["used"] = max(0, _CONCURRENCY["used"] - 1)
    _CONCURRENCY["free"] = max(0, _CONCURRENCY["limit"] - _CONCURRENCY["used"])
    return _CONCURRENCY


@app.get("/campaigns/{campaign_id}/leads")
def campaign_leads(campaign_id: str, limit: int = 25, offset: int = 0) -> dict:
    items = [
        {"id":"l_101","name":"Mario Rossi","phone_e164":"+390212345678","status":"pending"},
        {"id":"l_102","name":"Claire Dubois","phone_e164":"+33123456789","status":"scheduled"},
    ]
    return {"total": len(items), "items": items}

@app.post("/templates")
async def create_template(
    request: Request,
    template: dict = Body(...)
):
    """Create a new outcome template"""
    # For MVP, return a mock template ID
    return {"id": "template_123", "name": template.get("name", "New Template")}

@app.get("/templates")
async def list_templates(request: Request):
    """List available outcome templates"""
    # Return 3 preset templates for MVP
    return {
        "templates": [
            {
                "id": "sales_qualification",
                "name": "Sales Qualification",
                "description": "Standard sales lead qualification template",
                "fields": [
                    {"name": "interest_level", "type": "select", "options": ["High", "Medium", "Low"], "required": True},
                    {"name": "budget_range", "type": "select", "options": ["<10k", "10k-50k", "50k+", "Unknown"], "required": False},
                    {"name": "decision_maker", "type": "boolean", "required": True},
                    {"name": "timeline", "type": "select", "options": ["Immediate", "30 days", "90 days", "Unknown"], "required": False},
                    {"name": "next_step", "type": "text", "required": True}
                ],
                "is_preset": True
            },
            {
                "id": "customer_support",
                "name": "Customer Support",
                "description": "Support ticket resolution template",
                "fields": [
                    {"name": "issue_type", "type": "select", "options": ["Technical", "Billing", "Feature Request", "Other"], "required": True},
                    {"name": "severity", "type": "select", "options": ["Critical", "High", "Medium", "Low"], "required": True},
                    {"name": "resolution", "type": "text", "required": True},
                    {"name": "customer_satisfaction", "type": "select", "options": ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied"], "required": False},
                    {"name": "follow_up_required", "type": "boolean", "required": True}
                ],
                "is_preset": True
            },
            {
                "id": "appointment_booking",
                "name": "Appointment Booking",
                "description": "Calendar scheduling template",
                "fields": [
                    {"name": "appointment_type", "type": "select", "options": ["Consultation", "Demo", "Follow-up", "Training"], "required": True},
                    {"name": "preferred_date", "type": "date", "required": True},
                    {"name": "preferred_time", "type": "select", "options": ["Morning", "Afternoon", "Evening"], "required": True},
                    {"name": "duration", "type": "select", "options": ["30 min", "1 hour", "2 hours"], "required": True},
                    {"name": "notes", "type": "text", "required": False}
                ],
                "is_preset": True
            }
        ]
    }

# ===================== Sprint 6: Auth & RBAC =====================

@app.post("/auth/magic/request")
async def auth_magic_request(payload: dict, db: Session = Depends(get_db)) -> dict:
    """Request magic link authentication"""
    email = payload.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    # Check if user exists
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate magic link token
    import secrets
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Create magic link record
    magic_link = MagicLink(
        id=f"ml_{secrets.token_urlsafe(16)}",
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15)
    )
    db.add(magic_link)
    db.commit()
    
    # In production, send email with magic link
    # For now, return token for testing
    return {
        "message": "Magic link sent to email",
        "token": token,  # Remove in production
        "expires_in": "15 minutes"
    }


@app.post("/auth/magic/verify")
async def auth_magic_verify(payload: dict, db: Session = Depends(get_db)) -> dict:
    """Verify magic link token"""
    token = payload.get("token", "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token required")
    
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Find magic link
    magic_link = db.query(MagicLink).filter(
        MagicLink.token_hash == token_hash,
        MagicLink.expires_at > datetime.now(timezone.utc),
        MagicLink.used_at.is_(None)
    ).first()
    
    if not magic_link:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    # Mark as used
    magic_link.used_at = datetime.now(timezone.utc)
    db.add(magic_link)
    
    # Get user
    user = db.query(User).filter(User.id == magic_link.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    
    # Create session (in production, use proper session management)
    session_id = f"session_{secrets.token_urlsafe(32)}"
    
    return {
        "message": "Magic link verified successfully",
        "session_id": session_id,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_admin_global": user.is_admin_global
        }
    }


@app.post("/auth/oauth/google/start")
async def auth_google_start() -> dict:
    """Start Google OAuth flow"""
    # In production, redirect to Google OAuth
    # For now, return mock URL
    return {
        "auth_url": "https://accounts.google.com/oauth/authorize?client_id=mock&redirect_uri=mock&scope=email profile"
    }


@app.post("/auth/totp/setup")
async def auth_totp_setup(request: Request, db: Session = Depends(get_db)) -> dict:
    """Setup TOTP 2FA for user"""
    # Get user from session (in production)
    user_id = "u_1"  # Mock for now
    
    # Generate TOTP secret
    import pyotp
    secret = pyotp.random_base32()
    
    # Generate QR code URL
    totp = pyotp.TOTP(secret)
    qr_url = totp.provisioning_uri(
        name="admin@example.com",
        issuer_name="Agoralia"
    )
    
    # Save secret to user_auth (in production)
    return {
        "secret": secret,  # Remove in production
        "qr_url": qr_url,
        "message": "Scan QR code with authenticator app"
    }


@app.post("/auth/totp/verify")
async def auth_totp_verify(payload: dict) -> dict:
    """Verify TOTP code"""
    code = payload.get("code", "").strip()
    secret = payload.get("secret", "").strip()
    
    if not code or not secret:
        raise HTTPException(status_code=400, detail="Code and secret required")
    
    # Verify TOTP code
    import pyotp
    totp = pyotp.TOTP(secret)
    
    if totp.verify(code):
        return {"message": "TOTP verified successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid TOTP code")


# ===================== Sprint 6: Numbers Provisioning (Retell) =====================

@app.post("/numbers/retell/provision")
async def numbers_retell_provision(payload: dict, db: Session = Depends(get_db)) -> dict:
    """Provision phone number from Retell"""
    iso = (payload.get("country_iso") or "US").upper()
    number_type = payload.get("type", "geographic")  # geographic, national, toll-free
    capabilities = payload.get("capabilities", ["outbound"])
    
    # Mock Retell API call (in production, call actual Retell API)
    import secrets
    number_id = f"num_{secrets.token_urlsafe(16)}"
    e164 = f"+1{secrets.token_urlsafe(9)}"  # Mock US number
    
    # Create number record
    number = Number(
        id=number_id,
        workspace_id="ws_1",  # In production, get from session
        e164=e164,
        country_iso=iso,
        source="agoralia",
        capabilities=capabilities,
        verified=True,
        verification_method="none",
        provider="retell",
        provider_ref=f"retell_{number_id}",
        can_inbound="inbound" in capabilities,
        # New Sprint 6 fields
        provider_number_id=f"retell_{number_id}",
        verification_status="verified",
        purchase_cost_cents=500,  # $5.00
        monthly_cost_cents=100,   # $1.00/month
        assigned_to="workspace",
        assigned_id="ws_1"
    )
    
    db.add(number)
    db.commit()
    
    return {
        "id": number_id,
        "e164": e164,
        "country_iso": iso,
        "capabilities": capabilities,
        "provider": "retell",
        "costs": {
            "purchase": "$5.00",
            "monthly": "$1.00"
        }
    }


@app.post("/numbers/verify-caller-id")
async def numbers_verify_caller_id(payload: dict, db: Session = Depends(get_db)) -> dict:
    """Start caller ID verification process"""
    number_id = payload.get("number_id")
    method = payload.get("method", "voice_otp")
    
    if not number_id:
        raise HTTPException(status_code=400, detail="Number ID required")
    
    # Get number
    number = db.query(Number).filter(Number.id == number_id).first()
    if not number:
        raise HTTPException(status_code=404, detail="Number not found")
    
    # Generate verification code
    import secrets
    code = str(secrets.randbelow(900000) + 100000)  # 6-digit code
    
    # Create verification record
    verification = NumberVerification(
        id=f"nv_{secrets.token_urlsafe(16)}",
        number_id=number_id,
        method=method,
        code=code,
        status="sent",
        attempts=0,
        last_sent_at=datetime.now(timezone.utc)
    )
    
    db.add(verification)
    db.commit()
    
    # In production, call Retell API to initiate voice call
    # For now, return code for testing
    return {
        "verification_id": verification.id,
        "method": method,
        "code": code,  # Remove in production
        "message": f"Calling {number.e164} to read verification code"
    }


# ===================== Sprint 6: Outcomes & CRM =====================

@app.post("/calls/{call_id}/outcome")
async def create_call_outcome(call_id: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    """Create or update call outcome with BANT/TRADE schema"""
    
    # Get or create outcome
    outcome = db.query(CallOutcome).filter(CallOutcome.call_id == call_id).first()
    if not outcome:
        outcome = CallOutcome(
            id=f"out_{call_id}",
            call_id=call_id,
            workspace_id="ws_1",  # In production, get from session
            campaign_id=payload.get("campaign_id"),
            template_name=payload.get("template_name", "BANT Qualification"),
            schema_version=1
        )
    
    # Update fields
    if "fields_json" in payload:
        outcome.fields_json = payload["fields_json"]
    
    if "bant_json" in payload:
        outcome.bant_json = payload["bant_json"]
    
    if "disposition" in payload:
        outcome.disposition = payload["disposition"]
    
    if "next_action" in payload:
        outcome.next_action = payload["next_action"]
    
    if "summary_short" in payload:
        outcome.ai_summary_short = payload["summary_short"]
    
    if "summary_long" in payload:
        outcome.ai_summary_long = payload["summary_long"]
    
    if "action_items" in payload:
        outcome.action_items_json = payload["action_items"]
    
    if "sentiment" in payload:
        outcome.sentiment = payload["sentiment"]
    
    if "score" in payload:
        outcome.score_lead = payload["score"]
    
    if "next_step" in payload:
        outcome.next_step = payload["next_step"]
    
    outcome.updated_at = datetime.now(timezone.utc)
    
    db.add(outcome)
    db.commit()
    
    # Trigger CRM sync if enabled
    # In production, enqueue CRM sync job
    
    return {
        "id": outcome.id,
        "call_id": call_id,
        "schema_version": outcome.schema_version,
        "message": "Outcome saved successfully"
    }


@app.get("/calls/export.csv")
async def export_calls_csv(
    workspace_id: str = Query(default="ws_1"),
    filters: str = Query(default="{}"),
    db: Session = Depends(get_db)
) -> dict:
    """Export calls to CSV (async job)"""
    
    # Parse filters
    try:
        filter_data = json.loads(filters)
    except json.JSONDecodeError:
        filter_data = {}
    
    # Create export job
    import secrets
    job_id = f"export_{secrets.token_urlsafe(16)}"
    
    export_job = ExportJob(
        id=job_id,
        workspace_id=workspace_id,
        user_id="u_1",  # In production, get from session
        type="calls",
        filters_json=filter_data,
        status="pending"
    )
    
    db.add(export_job)
    db.commit()
    
    # In production, enqueue CSV generation job
    # For now, return job status
    
    return {
        "job_id": job_id,
        "status": "pending",
        "message": "CSV export job created. Check status for download link."
    }


# ===================== Sprint 6: CRM HubSpot Integration =====================

@app.get("/crm/hubspot/start")
async def crm_hubspot_start() -> dict:
    """Start HubSpot OAuth flow"""
    # In production, redirect to HubSpot OAuth
    # For now, return mock URL
    return {
        "auth_url": "https://app.hubspot.com/oauth/authorize?client_id=mock&redirect_uri=mock&scope=contacts deals"
    }


@app.get("/crm/hubspot/callback")
async def crm_hubspot_callback(code: str, state: str) -> dict:
    """Handle HubSpot OAuth callback"""
    # In production, exchange code for tokens
    # For now, return mock success
    
    return {
        "message": "HubSpot connected successfully",
        "portal_id": "12345",
        "access_token": "mock_token"
    }


@app.get("/crm/mapping")
async def get_crm_mapping(workspace_id: str = Query(default="ws_1")) -> dict:
    """Get CRM field mapping for workspace"""
    
    # Default mapping
    default_mapping = {
        "contact": {
            "firstname": "name",
            "lastname": "surname",
            "phone": "phone",
            "email": "email",
            "company": "company"
        },
        "company": {
            "name": "company",
            "phone": "phone",
            "country": "country"
        },
        "deal": {
            "dealname": "opportunity_name",
            "amount": "budget",
            "dealstage": "next_step"
        }
    }
    
    return {
        "workspace_id": workspace_id,
        "provider": "hubspot",
        "mapping": default_mapping
    }


@app.post("/crm/mapping")
async def update_crm_mapping(payload: dict, db: Session = Depends(get_db)) -> dict:
    """Update CRM field mapping"""
    
    workspace_id = payload.get("workspace_id", "ws_1")
    provider = payload.get("provider", "hubspot")
    mapping = payload.get("mapping", {})
    
    # Save mapping
    mapping_record = CrmFieldMapping(
        id=f"mapping_{secrets.token_urlsafe(16)}",
        workspace_id=workspace_id,
        crm_provider=provider,
        mapping_json=mapping
    )
    
    db.add(mapping_record)
    db.commit()
    
    return {
        "id": mapping_record.id,
        "message": "CRM mapping updated successfully"
    }


# ===================== Sprint 9: CRM Integrations (Zoho & Odoo) =====================

@app.post("/crm/zoho/connect")
async def crm_zoho_connect(payload: dict, db: Session = Depends(get_db)) -> dict:
    """Connect Zoho CRM"""
    workspace_id = payload.get("workspace_id", "ws_1")
    
    # In production, validate OAuth flow
    # For now, return mock success
    return {
        "message": "Zoho CRM connected successfully",
        "dc": "US",
        "access_token": "mock_token"
    }


@app.post("/crm/zoho/disconnect")
async def crm_zoho_disconnect(workspace_id: str = Query(default="ws_1")) -> dict:
    """Disconnect Zoho CRM"""
    # In production, revoke tokens
    return {
        "message": "Zoho CRM disconnected successfully"
    }


@app.post("/crm/zoho/sync")
async def crm_zoho_sync(payload: dict) -> dict:
    """Sync data to/from Zoho CRM"""
    # In production, queue background job
    return {
        "message": "Zoho sync job queued",
        "job_id": f"zoho_sync_{secrets.token_urlsafe(8)}"
    }


@app.get("/crm/zoho/mapping")
async def get_zoho_mapping(workspace_id: str = Query(default="ws_1")) -> dict:
    """Get Zoho field mapping"""
    default_mapping = {
        "contact": {
            "firstname": "First_Name",
            "lastname": "Last_Name",
            "phone": "Phone",
            "email": "Email",
            "company": "Account_Name",
            "country": "Mailing_Country"
        },
        "company": {
            "name": "Account_Name",
            "phone": "Phone",
            "country": "Billing_Country",
            "industry": "Industry"
        },
        "deal": {
            "dealname": "Deal_Name",
            "amount": "Amount",
            "dealstage": "Stage",
            "closedate": "Closing_Date"
        }
    }
    
    return {
        "workspace_id": workspace_id,
        "provider": "zoho",
        "mapping": default_mapping
    }


@app.post("/crm/zoho/test")
async def test_zoho_connection(payload: dict) -> dict:
    """Test Zoho connection"""
    # In production, validate credentials
    return {
        "status": "connected",
        "dc": "US",
        "org_name": "Demo Organization"
    }


@app.post("/crm/odoo/connect")
async def crm_odoo_connect(payload: dict, db: Session = Depends(get_db)) -> dict:
    """Connect Odoo CRM"""
    workspace_id = payload.get("workspace_id", "ws_1")
    
    # In production, validate connection
    return {
        "message": "Odoo CRM connected successfully",
        "url": payload.get("url"),
        "database": payload.get("database")
    }


@app.post("/crm/odoo/disconnect")
async def crm_odoo_disconnect(workspace_id: str = Query(default="ws_1")) -> dict:
    """Disconnect Odoo CRM"""
    return {
        "message": "Odoo CRM disconnected successfully"
    }


@app.post("/crm/odoo/sync")
async def crm_odoo_sync(payload: dict) -> dict:
    """Sync data to/from Odoo CRM"""
    return {
        "message": "Odoo sync job queued",
        "job_id": f"odoo_sync_{secrets.token_urlsafe(8)}"
    }


@app.get("/crm/odoo/mapping")
async def get_odoo_mapping(workspace_id: str = Query(default="ws_1")) -> dict:
    """Get Odoo field mapping"""
    default_mapping = {
        "contact": {
            "firstname": "name (first part)",
            "lastname": "name (last part)",
            "phone": "phone",
            "email": "email",
            "company": "parent_id",
            "country": "country_id"
        },
        "company": {
            "name": "name",
            "phone": "phone",
            "country": "country_id",
            "industry": "industry"
        },
        "deal": {
            "dealname": "name",
            "amount": "expected_revenue",
            "dealstage": "stage_id",
            "closedate": "date_deadline"
        }
    }
    
    return {
        "workspace_id": workspace_id,
        "provider": "odoo",
        "mapping": default_mapping
    }


@app.post("/crm/odoo/test")
async def test_odoo_connection(payload: dict) -> dict:
    """Test Odoo connection"""
    return {
        "status": "connected",
        "url": payload.get("url"),
        "database": payload.get("database")
    }


# ===================== Health Check =====================

@app.get("/health")
async def health_check():
    """Health check endpoint for Railway"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "0.1.0"
    }

# ===================== Include Routers =====================

# Include CRM router
app.include_router(crm.router)

# ===================== Main Entry Point =====================

if __name__ == "__main__":
    import uvicorn
    import os
    
    # Use PORT from environment (Railway) or fallback to 8080
    port = int(os.getenv("PORT", 8080))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",  # Bind to all interfaces
        port=port,
        reload=False,  # Disable reload in production
        log_level="info"
    )

# ===================== Sprint 6: Admin Dashboard KPI =====================

@app.get("/admin/kpi")
async def admin_kpi(request: Request, _guard: None = Depends(admin_guard)) -> dict:
    """Get admin dashboard KPI data"""
    
    # Mock KPI data (in production, calculate from database)
    kpi_data = {
        "users": {
            "total": 1250,
            "active_7d": 847,
            "active_30d": 1123
        },
        "minutes": {
            "mtd": 45600,
            "cap": 100000,
            "utilization": 45.6
        },
        "calls": {
            "today": 234,
            "week": 1247,
            "month": 5234
        },
        "performance": {
            "success_rate": 78.5,
            "avg_duration_sec": 187,
            "error_rate": 2.1
        },
        "revenue": {
            "mrr_cents": 1250000,  # $12,500
            "arr_cents": 15000000,  # $150,000
            "arpu_cents": 10000     # $100
        }
    }
    
    return kpi_data


@app.get("/admin/usage")
async def admin_usage(
    period: str = Query(default="2025-01"),
    request: Request = None,
    _guard: None = Depends(admin_guard)
) -> dict:
    """Get usage analytics for admin"""
    
    # Mock usage data (in production, aggregate from database)
    usage_data = {
        "period": period,
        "by_workspace": [
            {
                "workspace_id": "ws_1",
                "name": "Demo Workspace",
                "minutes": 1250,
                "calls": 89,
                "cost_cents": 2500
            },
            {
                "workspace_id": "ws_2", 
                "name": "Enterprise Client",
                "minutes": 8900,
                "calls": 456,
                "cost_cents": 17800
            }
        ],
        "by_language": [
            {"lang": "en-US", "minutes": 4500, "calls": 234},
            {"lang": "it-IT", "minutes": 3200, "calls": 189},
            {"lang": "fr-FR", "minutes": 2400, "calls": 122}
        ],
        "by_country": [
            {"iso": "US", "minutes": 3800, "calls": 198},
            {"iso": "IT", "minutes": 3200, "calls": 189},
            {"iso": "FR", "minutes": 2400, "calls": 122}
        ]
    }
    
    return usage_data


@app.get("/admin/calls/live")
async def admin_calls_live_stream(request: Request, _guard: None = Depends(admin_guard)):
    """Stream live calls for admin dashboard (SSE)"""
    
    # Mock SSE response (in production, implement real-time streaming)
    from fastapi.responses import StreamingResponse
    
    async def generate_live_calls():
        # In production, stream real-time call updates
        yield "data: {\"type\": \"live_calls\", \"data\": []}\n\n"
    
    return StreamingResponse(
        generate_live_calls(),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

@app.get("/pdf/health")
async def pdf_health():
    """Health check endpoint for Chromium PDF generator"""
    try:
        if PDF_GENERATOR_AVAILABLE:
            from pdf_chromium import get_chromium_version
            version = get_chromium_version()
            return {
                "ok": True,
                "chromium": "available",
                "version": version,
                "message": "PDF generator ready"
            }
        else:
            return {
                "ok": False,
                "chromium": "unavailable",
                "message": "Chromium not found - check apt.txt dependencies"
            }
    except Exception as e:
        return {
            "ok": False,
            "chromium": "error",
            "error": str(e),
            "message": "PDF generator failed to initialize"
        }

# ===================== Knowledge Base System =====================

def _get_workspace_from_user(request: Request) -> str:
    """Get workspace ID from authenticated user session"""
    # In production, get from session/token
    # For now, fallback to header with validation
    workspace_id = request.headers.get("X-Workspace-Id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="X-Workspace-Id header required")
    return workspace_id

def _create_error_response(code: str, message: str, details: dict = None, hint: str = None) -> dict:
    """Create uniform error response shape"""
    error = {
        "code": code,
        "message": message
    }
    if details:
        error["details"] = details
    if hint:
        error["hint"] = hint
    return error

def _audit_kb_change(
    db: Session, 
    kb_id: str, 
    actor_user_id: str, 
    operation: str, 
    diff: dict
) -> None:
    """Log KB changes to audit trail"""
    history = KbHistory(
        id=f"hist_{secrets.token_urlsafe(8)}",
        kb_id=kb_id,
        actor_user_id=actor_user_id,
        diff_json={
            "operation": operation,
            "timestamp": datetime.utcnow().isoformat(),
            "changes": diff
        }
    )
    db.add(history)

@app.get("/kb")
def list_knowledge_bases(
    request: Request,
    kind: str = Query(None, description="Filter by KB kind"),
    status: str = Query(None, description="Filter by status"),
    q: str = Query(None, description="Search query"),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """List knowledge bases for current workspace"""
    # Get workspace from authenticated user (in production, from session)
    workspace_id = _get_workspace_from_user(request)
    
    with next(get_db()) as db:
        query = db.query(KnowledgeBase).filter(KnowledgeBase.workspace_id == workspace_id)
        
        if kind:
            query = query.filter(KnowledgeBase.kind == kind)
        if status:
            query = query.filter(KnowledgeBase.status == status)
        if q:
            query = query.filter(
                or_(
                    KnowledgeBase.name.ilike(f"%{q}%"),
                    KnowledgeBase.meta_json.cast(str).ilike(f"%{q}%")
                )
            )
        
        total = query.count()
        offset = (page - 1) * per_page
        kbs = query.offset(offset).limit(per_page).all()
        
        return {
            "results": [
                {
                    "id": kb.id,
                    "workspace_id": kb.workspace_id,
                    "kind": kb.kind,
                    "name": kb.name,
                    "type": kb.type,
                    "locale_default": kb.locale_default,
                    "version": kb.version,
                    "status": kb.status,
                    "completeness_pct": kb.completeness_pct,
                    "freshness_score": kb.freshness_score,
                    "created_at": kb.created_at,
                    "updated_at": kb.updated_at,
                    "published_at": kb.published_at
                }
                for kb in kbs
            ],
            "total": total,
            "page": page,
            "per_page": per_page
        }


@app.post("/kb")
def create_knowledge_base(
    request: Request,
    payload: schemas.KnowledgeBaseCreate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Create a new knowledge base"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    user_id = "u_1"  # In production, get from session
    
    with next(get_db()) as db:
        # Create KB
        kb_id = f"kb_{secrets.token_urlsafe(8)}"
        kb = KnowledgeBase(
            id=kb_id,
            workspace_id=workspace_id,
            kind=payload.kind,
            name=payload.name,
            type=payload.type,
            locale_default=payload.locale_default,
            meta_json=payload.meta_json or {}
        )
        db.add(kb)
        
        # Create default sections based on template
        template_name = payload.kind
        sections_data = create_default_sections(kb_id, template_name)
        
        for section_data in sections_data:
            section = KbSection(
                id=section_data["id"],
                kb_id=kb_id,
                key=section_data["key"],
                title=section_data["title"],
                order_index=section_data["order_index"]
            )
            db.add(section)
        
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, kb_id)
        
        # Audit trail
        _audit_kb_change(db, kb_id, "u_1", "create", {
            "field": "metadata",
            "old_values": {},
            "new_values": payload.dict(exclude_unset=True)
        })
        
        return {
            "id": kb_id,
            "name": kb.name,
            "kind": kb.kind,
            "status": "created"
        }


@app.get("/kb/{kb_id}")
def get_knowledge_base(
    request: Request,
    kb_id: str,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get knowledge base details with sections and fields"""
    # Validate workspace ownership
    workspace_id = _get_workspace_from_user(request)
    
    with next(get_db()) as db:
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not kb:
            raise HTTPException(
                status_code=404, 
                detail=_create_error_response(
                    "KB_NOT_FOUND",
                    "Knowledge base not found",
                    {"kb_id": kb_id, "workspace_id": workspace_id},
                    "Verify the KB ID and ensure it belongs to your workspace"
                )
            )
    """Get knowledge base details with sections and fields"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Get sections
        sections = db.query(KbSection).filter(
            KbSection.kb_id == kb_id
        ).order_by(KbSection.order_index).all()
        
        # Get fields
        fields = db.query(KbField).filter(
            KbField.kb_id == kb_id
        ).all()
        
        # Get sources
        sources = db.query(KbSource).filter(
            KbSource.workspace_id == workspace_id
        ).join(KbChunk, KbChunk.source_id == KbSource.id).filter(
            KbChunk.kb_id == kb_id
        ).distinct().all()
        
        # Get assignments
        assignments = db.query(KbAssignment).filter(
            KbAssignment.kb_id == kb_id,
            KbAssignment.workspace_id == workspace_id
        ).all()
        
        return {
            "id": kb.id,
            "workspace_id": kb.workspace_id,
            "kind": kb.kind,
            "name": kb.name,
            "type": kb.type,
            "locale_default": kb.locale_default,
            "version": kb.version,
            "status": kb.status,
            "completeness_pct": kb.completeness_pct,
            "freshness_score": kb.freshness_score,
            "meta_json": kb.meta_json,
            "created_at": kb.created_at,
            "updated_at": kb.updated_at,
            "published_at": kb.published_at,
            "sections": [
                {
                    "id": s.id,
                    "key": s.key,
                    "title": s.title,
                    "order_index": s.order_index,
                    "content_md": s.content_md,
                    "content_json": s.content_json,
                    "completeness_pct": s.completeness_pct,
                    "updated_at": s.updated_at
                }
                for s in sections
            ],
            "fields": [
                {
                    "id": f.id,
                    "key": f.key,
                    "label": f.label,
                    "value_text": f.value_text,
                    "value_json": f.value_json,
                    "lang": f.lang,
                    "confidence": f.confidence,
                    "updated_at": f.updated_at
                }
                for f in fields
            ],
            "sources": [
                {
                    "id": s.id,
                    "kind": s.kind,
                    "url": s.url,
                    "filename": s.filename,
                    "status": s.status,
                    "created_at": s.created_at
                }
                for s in sources
            ],
            "assignments": [
                {
                    "id": a.id,
                    "scope": a.scope,
                    "scope_id": a.scope_id,
                    "created_at": a.created_at
                }
                for a in assignments
            ]
        }


@app.patch("/kb/{kb_id}")
def update_knowledge_base(
    request: Request,
    kb_id: str,
    payload: schemas.KnowledgeBaseUpdate,
    if_match: str = Header(None, alias="If-Match"),
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Update knowledge base metadata"""
    workspace_id = _get_workspace_from_user(request)
    
    with next(get_db()) as db:
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Check If-Match header for concurrency control
        if if_match and if_match != kb.updated_at.isoformat():
            raise HTTPException(status_code=412, detail="Precondition failed - resource modified")
        
        # Update fields
        if payload.name is not None:
            kb.name = payload.name
        if payload.type is not None:
            kb.type = payload.type
        if payload.locale_default is not None:
            kb.locale_default = payload.locale_default
        if payload.status is not None:
            kb.status = payload.status
            if payload.status == "published":
                kb.published_at = datetime.utcnow()
        if payload.meta_json is not None:
            kb.meta_json = payload.meta_json
        
        kb.updated_at = datetime.utcnow()
        db.commit()
        
        # Audit trail
        _audit_kb_change(db, kb_id, "u_1", "update", {
            "field": "metadata",
            "old_values": {},
            "new_values": payload.dict(exclude_unset=True)
        })
        
        return {"id": kb_id, "status": "updated"}


@app.post("/kb/imports")
def start_kb_import(
    request: Request,
    payload: schemas.ImportSourceRequest,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Start knowledge base import from source"""
    workspace_id = _get_workspace_from_user(request)
    user_id = "u_1"  # In production, get from session
    
    # Validate file size limits
    if payload.source.kind == "file":
        # TODO: Get actual file size from multipart upload
        # For now, assume reasonable size
        pass
    
    # Validate CSV row limits
    if payload.source.kind == "csv":
        # TODO: Validate CSV row count
        # Max 100k rows for now
        pass
    """Start knowledge base import from source"""
    workspace_id = _get_workspace_from_user(request)
    user_id = "u_1"  # In production, get from session
    
    with next(get_db()) as db:
        # Check idempotency if key provided
        if payload.idempotency_key:
            # Create hash of payload for true idempotency
            payload_hash = hashlib.sha256(json.dumps(payload.dict(), sort_keys=True).encode()).hexdigest()
            
            existing_job = db.query(KbImportJob).filter(
                KbImportJob.workspace_id == workspace_id,
                KbImportJob.meta_json.contains({"idempotency_key": payload.idempotency_key}),
                KbImportJob.meta_json.contains({"payload_hash": payload_hash})
            ).first()
            
            if existing_job:
                return {
                    "job_id": existing_job.id,
                    "source_id": existing_job.source_id,
                    "status": existing_job.status,
                    "idempotent": True,
                    "message": "Duplicate request detected, returning existing job"
                }
        
        # Create source record
        source_id = f"source_{secrets.token_urlsafe(8)}"
        source = KbSource(
            id=source_id,
            workspace_id=workspace_id,
            kind=payload.source.kind,
            url=payload.source.url,
            filename=payload.source.filename,
            sha256="placeholder",  # Will be updated by worker
            meta_json=payload.source.meta_json or {},
            status="pending"
        )
        db.add(source)
        
        # Create import job
        job_id = f"job_{secrets.token_urlsafe(8)}"
        job = KbImportJob(
            id=job_id,
            workspace_id=workspace_id,
            user_id=user_id,
            source_id=source_id,
            target_kb_id=payload.target_kb_id,
            template=payload.template or "generic",
            status="pending"
        )
        
        # Store idempotency key and payload hash in job metadata
        if payload.idempotency_key:
            job.meta_json = job.meta_json or {}
            job.meta_json["idempotency_key"] = payload.idempotency_key
            job.meta_json["payload_hash"] = payload_hash
        
        db.add(job)
        db.commit()
        
        # TODO: Queue background job for processing
        # kb_import_job.send(job_id)
        
        return {
            "job_id": job_id,
            "source_id": source_id,
            "status": "pending",
            "estimated_cost_cents": 0,  # Will be calculated by worker
            "message": "Import job queued successfully"
        }


@app.get("/kb/imports/{job_id}")
def get_import_job_status(
    request: Request,
    job_id: str,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get import job status and progress"""
    workspace_id = _get_workspace_from_user(request)
    
    with next(get_db()) as db:
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        return {
            "id": job.id,
            "status": job.status,
            "progress_pct": job.progress_pct,
            "estimated_cost_cents": job.estimated_cost_cents,
            "actual_cost_cents": job.actual_cost_cents,
            "error_message": job.error_message,
            "created_at": job.created_at,
            "completed_at": job.completed_at
        }


@app.post("/kb/assign")
def assign_knowledge_base(
    request: Request,
    payload: schemas.KbAssignmentCreate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Assign knowledge base to scope (number, campaign, agent, or workspace default)"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Check if KB exists and belongs to workspace
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == payload.kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Remove existing assignment for this scope
        existing = db.query(KbAssignment).filter(
            KbAssignment.workspace_id == workspace_id,
            KbAssignment.scope == payload.scope,
            KbAssignment.scope_id == payload.scope_id
        ).first()
        
        if existing:
            db.delete(existing)
        
        # Create new assignment
        assignment = KbAssignment(
            id=f"assign_{secrets.token_urlsafe(8)}",
            workspace_id=workspace_id,
            scope=payload.scope,
            scope_id=payload.scope_id,
            kb_id=payload.kb_id
        )
        db.add(assignment)
        db.commit()
        
        return {
            "id": assignment.id,
            "scope": assignment.scope,
            "scope_id": assignment.scope_id,
            "kb_id": assignment.kb_id,
            "status": "assigned"
        }


@app.get("/kb/resolve")
def resolve_knowledge_base(
    request: Request,
    campaign_id: str = Query(None),
    number_id: str = Query(None),
    agent_id: str = Query(None),
    lang: str = Query("en-US"),
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Resolve knowledge base for runtime use (campaign > number > agent > workspace default)"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Find KB assignment with precedence: campaign > number > agent > workspace_default
        assignment = None
        
        if campaign_id:
            assignment = db.query(KbAssignment).filter(
                KbAssignment.workspace_id == workspace_id,
                KbAssignment.scope == "campaign",
                KbAssignment.scope_id == campaign_id
            ).first()
        
        if not assignment and number_id:
            assignment = db.query(KbAssignment).filter(
                KbAssignment.workspace_id == workspace_id,
                KbAssignment.scope == "number",
                KbAssignment.scope_id == number_id
            ).first()
        
        if not assignment and agent_id:
            assignment = db.query(KbAssignment).filter(
                KbAssignment.workspace_id == workspace_id,
                KbAssignment.scope == "agent",
                KbAssignment.scope_id == agent_id
            ).first()
        
        if not assignment:
            assignment = db.query(KbAssignment).filter(
                KbAssignment.workspace_id == workspace_id,
                KbAssignment.scope == "workspace_default"
            ).first()
        
        if not assignment:
            raise HTTPException(status_code=404, detail="No knowledge base assigned")
        
        # Get KB details
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == assignment.kb_id,
            KnowledgeBase.status == "published"
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="Assigned knowledge base not found or not published")
        
        # Get sections and fields
        sections = db.query(KbSection).filter(
            KbSection.kb_id == kb.id
        ).order_by(KbSection.order_index).all()
        
        fields = db.query(KbField).filter(
            KbField.kb_id == kb.id,
            KbField.lang == lang
        ).all()
        
        return {
            "kb_id": kb.id,
            "kind": kb.kind,
            "name": kb.name,
            "type": kb.type,
            "locale": lang,
            "sections": [
                {
                    "id": s.id,
                    "key": s.key,
                    "title": s.title,
                    "content_md": s.content_md,
                    "content_json": s.content_json
                }
                for s in sections
            ],
            "fields": [
                {
                    "id": f.id,
                    "key": f.key,
                    "label": f.label,
                    "value_text": f.value_text,
                    "value_json": f.value_json,
                    "confidence": f.confidence
                }
                for f in fields
            ],
            "meta": kb.meta_json or {}
        }


@app.get("/kb/progress")
def get_kb_progress(
    request: Request,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get progress overview for all KBs in workspace"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        kbs = db.query(KnowledgeBase).filter(
            KnowledgeBase.workspace_id == workspace_id
        ).all()
        
        progress = []
        for kb in kbs:
            # Count sections and fields
            sections_count = db.query(KbSection).filter(
                KbSection.kb_id == kb.id
            ).count()
            
            fields_count = db.query(KbField).filter(
                KbField.kb_id == kb.id
            ).count()
            
            progress.append({
                "kb_id": kb.id,
                "name": kb.name,
                "kind": kb.kind,
                "completeness_pct": kb.completeness_pct,
                "freshness_score": kb.freshness_score,
                "sections_count": sections_count,
                "fields_count": fields_count,
                "last_updated": kb.updated_at
            })
        
        return {"progress": progress}


# ===================== Knowledge Base Sections & Fields =====================

@app.post("/kb/{kb_id}/sections")
def create_kb_section(
    request: Request,
    kb_id: str,
    payload: schemas.KbSectionCreate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Create a new section in knowledge base"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify KB exists and belongs to workspace
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Create section
        section_id = f"section_{secrets.token_urlsafe(8)}"
        section = KbSection(
            id=section_id,
            kb_id=kb_id,
            key=payload.key,
            title=payload.title,
            order_index=payload.order_index,
            content_md=payload.content_md,
            content_json=payload.content_json
        )
        db.add(section)
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, kb_id)
        
        # Audit trail
        _audit_kb_change(db, kb_id, "u_1", "create_section", {
            "section_id": section_id,
            "section_key": section.key,
            "section_title": section.title
        })
        
        return {
            "id": section_id,
            "key": section.key,
            "title": section.title,
            "status": "created"
        }


@app.patch("/kb/sections/{section_id}")
def update_kb_section(
    request: Request,
    section_id: str,
    payload: schemas.KbSectionUpdate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Update a knowledge base section"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify section exists and belongs to workspace
        section = db.query(KbSection).join(KnowledgeBase).filter(
            KbSection.id == section_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        
        # Update fields
        if payload.title is not None:
            section.title = payload.title
        if payload.order_index is not None:
            section.order_index = payload.order_index
        if payload.content_md is not None:
            section.content_md = payload.content_md
        if payload.content_json is not None:
            section.content_json = payload.content_json
        
        section.updated_at = datetime.utcnow()
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, kb_id)
        
        # Audit trail
        _audit_kb_change(db, kb_id, "u_1", "update_section", {
            "section_id": section_id,
            "changes": payload.dict(exclude_unset=True)
        })
        
        return {"id": section_id, "status": "updated"}


@app.delete("/kb/sections/{section_id}")
def delete_kb_section(
    request: Request,
    section_id: str,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Delete a knowledge base section"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify section exists and belongs to workspace
        section = db.query(KbSection).join(KnowledgeBase).filter(
            KbSection.id == section_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        
        # Delete associated fields first
        db.query(KbField).filter(KbField.section_id == section_id).delete()
        
        # Delete section
        db.delete(section)
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, kb_id)
        
        # Audit trail
        _audit_kb_change(db, kb_id, "u_1", "delete_section", {
            "section_id": section_id,
            "section_key": section.key
        })
        
        return {"id": section_id, "status": "deleted"}


@app.post("/kb/{kb_id}/fields")
def create_kb_field(
    request: Request,
    kb_id: str,
    payload: schemas.KbFieldCreate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Create a new field in knowledge base"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify KB exists and belongs to workspace
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Verify section exists if specified
        if payload.section_id:
            section = db.query(KbSection).filter(
                KbSection.id == payload.section_id,
                KbSection.kb_id == kb_id
            ).first()
            if not section:
                raise HTTPException(status_code=404, detail="Section not found")
        
        # Create field
        field_id = f"field_{secrets.token_urlsafe(8)}"
        field = KbField(
            id=field_id,
            kb_id=kb_id,
            section_id=payload.section_id,
            key=payload.key,
            label=payload.label,
            value_text=payload.value_text,
            value_json=payload.value_json,
            lang=payload.lang,
            confidence=payload.confidence
        )
        db.add(field)
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, kb_id)
        
        # Audit trail
        _audit_kb_change(db, kb_id, "u_1", "create_field", {
            "field_id": field_id,
            "field_key": field.key,
            "field_label": field.label
        })
        
        return {
            "id": field_id,
            "key": field.key,
            "label": field.label,
            "status": "created"
        }


@app.patch("/kb/fields/{field_id}")
def update_kb_field(
    request: Request,
    field_id: str,
    payload: schemas.KbFieldUpdate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Update a knowledge base field"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify field exists and belongs to workspace
        field = db.query(KbField).join(KnowledgeBase).filter(
            KbField.id == field_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not field:
            raise HTTPException(status_code=404, detail="Field not found")
        
        # Update fields
        if payload.label is not None:
            field.label = payload.label
        if payload.value_text is not None:
            field.value_text = payload.value_text
        if payload.value_json is not None:
            field.value_json = payload.value_json
        if payload.lang is not None:
            field.lang = payload.lang
        if payload.confidence is not None:
            field.confidence = payload.confidence
        
        field.updated_at = datetime.utcnow()
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, field.kb_id)
        
        # Audit trail
        _audit_kb_change(db, field.kb_id, "u_1", "update_field", {
            "field_id": field_id,
            "changes": payload.dict(exclude_unset=True)
        })
        
        return {"id": field_id, "status": "updated"}


@app.delete("/kb/fields/{field_id}")
def delete_kb_field(
    request: Request,
    field_id: str,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Delete a knowledge base field"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify field exists and belongs to workspace
        field = db.query(KbField).join(KnowledgeBase).filter(
            KbField.id == field_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not field:
            raise HTTPException(status_code=404, detail="Field not found")
        
        # Delete field
        db.delete(field)
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, field.kb_id)
        
        # Audit trail
        _audit_kb_change(db, field.kb_id, "u_1", "delete_field", {
            "field_id": field_id,
            "field_key": field.key
        })
        
        return {"id": field_id, "status": "deleted"}


@app.get("/kb/templates")
def get_kb_templates(
    request: Request,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get available KB templates"""
    from .ai_client import KB_TEMPLATES
    
    return {
        "templates": [
            {
                "name": template_name,
                "display_name": template_data.get("name", template_name.title()),
                "sections": template_data.get("sections", [])
            }
            for template_name, template_data in KB_TEMPLATES.items()
        ]
    }


@app.post("/kb/imports/{job_id}/mapping")
def update_import_mapping(
    request: Request,
    job_id: str,
    payload: schemas.ImportMappingRequest,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Update field mappings for import job"""
    workspace_id = _get_workspace_from_user(request)
    
    with next(get_db()) as db:
        # Verify job exists and belongs to workspace
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        # Update job with mappings
        job.meta_json = job.meta_json or {}
        job.meta_json["mappings"] = payload.mappings
        db.commit()
        
        return {"job_id": job_id, "status": "mapping_updated"}


@app.post("/kb/imports/{job_id}/commit")
def commit_import_job(
    request: Request,
    job_id: str,
    payload: schemas.ImportReviewRequest,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Commit and apply import job changes"""
    workspace_id = _get_workspace_from_user(request)
    
    with next(get_db()) as db:
        # Verify job exists and belongs to workspace
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail="Import job not completed")
        
        # TODO: Process review and apply changes
        # This would involve:
        # 1. Applying field mappings
        # 2. Merging conflicts based on auto_merge flag
        # 3. Publishing if publish_after is True
        
        job.status = "reviewed"
        if payload.publish_after:
            # Update target KB status to published
            if job.target_kb_id:
                target_kb = db.query(KnowledgeBase).filter(
                    KnowledgeBase.id == job.target_kb_id,
                    KnowledgeBase.workspace_id == workspace_id
                ).first()
                if target_kb:
                    target_kb.status = "published"
                    target_kb.published_at = datetime.utcnow()
        
        db.commit()
        
        return {"job_id": job_id, "status": "reviewed"}


@app.get("/kb/assignments")
def list_kb_assignments(
    request: Request,
    scope: str = Query(None, description="Filter by scope"),
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """List knowledge base assignments for workspace"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        query = db.query(KbAssignment).filter(
            KbAssignment.workspace_id == workspace_id
        )
        
        if scope:
            query = query.filter(KbAssignment.scope == scope)
        
        assignments = query.all()
        
        # Enrich with KB details
        enriched = []
        for assignment in assignments:
            kb = db.query(KnowledgeBase).filter(
                KnowledgeBase.id == assignment.kb_id
            ).first()
            
            if kb:
                enriched.append({
                    "id": assignment.id,
                    "scope": assignment.scope,
                    "scope_id": assignment.scope_id,
                    "kb_id": assignment.kb_id,
                    "kb_name": kb.name,
                    "kb_kind": kb.kind,
                    "kb_status": kb.status,
                    "created_at": assignment.created_at
                })
        
        return {"assignments": enriched}


@app.get("/kb/ai-usage")
def get_ai_usage(
    request: Request,
    period: str = Query("2025-01", description="Period in YYYY-MM format"),
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get AI usage statistics for workspace"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Parse period
        try:
            year, month = period.split("-")
            start_date = datetime(int(year), int(month), 1)
            if int(month) == 12:
                end_date = datetime(int(year) + 1, 1, 1)
            else:
                end_date = datetime(int(year), int(month) + 1, 1)
        except:
            start_date = datetime(2025, 1, 1)
            end_date = datetime(2025, 2, 1)
        
        # Get usage for period
        usage = db.query(AiUsage).filter(
            AiUsage.workspace_id == workspace_id,
            AiUsage.created_at >= start_date,
            AiUsage.created_at < end_date
        ).all()
        
        # Aggregate by kind
        by_kind = {}
        total_tokens_in = 0
        total_tokens_out = 0
        total_cost_micros = 0
        
        for u in usage:
            kind = u.kind
            if kind not in by_kind:
                by_kind[kind] = {
                    "tokens_in": 0,
                    "tokens_out": 0,
                    "cost_micros": 0,
                    "count": 0
                }
            
            by_kind[kind]["tokens_in"] += u.tokens_in or 0
            by_kind[kind]["tokens_out"] += u.tokens_out or 0
            by_kind[kind]["cost_micros"] += u.cost_micros or 0
            by_kind[kind]["count"] += 1
            
            total_tokens_in += u.tokens_in or 0
            total_tokens_out += u.tokens_out or 0
            total_cost_micros += u.cost_micros or 0
        
        return {
            "period": period,
            "by_kind": by_kind,
            "totals": {
                "tokens_in": total_tokens_in,
                "tokens_out": total_tokens_out,
                "cost_cents": total_cost_micros / 1000000,  # Convert microcents to cents
                "jobs_count": len(usage)
            }
        }


# ===================== Knowledge Base Fields Management =====================

@app.post("/kb/{kb_id}/fields")
def create_kb_field(
    request: Request,
    kb_id: str,
    payload: schemas.KbFieldCreate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Create a new field in knowledge base"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify KB exists and belongs to workspace
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Verify section exists if specified
        if payload.section_id:
            section = db.query(KbSection).filter(
                KbSection.id == payload.section_id,
                KbSection.kb_id == kb_id
            ).first()
            if not section:
                raise HTTPException(status_code=404, detail="Section not found")
        
        # Create field
        field_id = f"field_{secrets.token_urlsafe(8)}"
        field = KbField(
            id=field_id,
            kb_id=kb_id,
            section_id=payload.section_id,
            key=payload.key,
            label=payload.label,
            value_text=payload.value_text,
            value_json=payload.value_json,
            lang=payload.lang,
            confidence=payload.confidence
        )
        db.add(field)
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, kb_id)
        
        # Audit trail
        _audit_kb_change(db, kb_id, "u_1", "create_field", {
            "field_id": field_id,
            "field_key": field.key,
            "field_label": field.label
        })
        
        return {
            "id": field_id,
            "key": field.key,
            "label": field.label,
            "status": "created"
        }


@app.patch("/kb/fields/{field_id}")
def update_kb_field(
    request: Request,
    field_id: str,
    payload: schemas.KbFieldUpdate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Update a knowledge base field"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify field exists and belongs to workspace
        field = db.query(KbField).join(KnowledgeBase).filter(
            KbField.id == field_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not field:
            raise HTTPException(status_code=404, detail="Field not found")
        
        # Update fields
        if payload.label is not None:
            field.label = payload.label
        if payload.value_text is not None:
            field.value_text = payload.value_text
        if payload.value_json is not None:
            field.value_json = payload.value_json
        if payload.lang is not None:
            field.lang = payload.lang
        if payload.confidence is not None:
            field.confidence = payload.confidence
        
        field.updated_at = datetime.utcnow()
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, field.kb_id)
        
        # Audit trail
        _audit_kb_change(db, field.kb_id, "u_1", "update_field", {
            "field_id": field_id,
            "changes": payload.dict(exclude_unset=True)
        })
        
        return {"id": field_id, "status": "updated"}


@app.delete("/kb/fields/{field_id}")
def delete_kb_field(
    request: Request,
    field_id: str,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Delete a knowledge base field"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify field exists and belongs to workspace
        field = db.query(KbField).join(KnowledgeBase).filter(
            KbField.id == field_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not field:
            raise HTTPException(status_code=404, detail="Field not found")
        
        # Delete field
        db.delete(field)
        db.commit()
        
        return {"id": field_id, "status": "deleted"}


@app.get("/kb/templates")
def get_kb_templates(
    request: Request,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get available KB templates"""
    from .ai_client import KB_TEMPLATES
    
    return {
        "templates": [
            {
                "name": template_name,
                "display_name": template_data.get("name", template_name.title()),
                "sections": template_data.get("sections", [])
            }
            for template_name, template_data in KB_TEMPLATES.items()
        ]
    }


@app.post("/kb/imports/{job_id}/mapping")
def update_import_mapping(
    request: Request,
    job_id: str,
    payload: schemas.ImportMappingRequest,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Update field mappings for import job"""
    workspace_id = _get_workspace_from_user(request)
    
    with next(get_db()) as db:
        # Verify job exists and belongs to workspace
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        # Update job with mappings
        job.meta_json = job.meta_json or {}
        job.meta_json["mappings"] = payload.mappings
        db.commit()
        
        return {"job_id": job_id, "status": "mapping_updated"}


@app.post("/kb/imports/{job_id}/commit")
def commit_import_job(
    request: Request,
    job_id: str,
    payload: schemas.ImportReviewRequest,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Commit and apply import job changes"""
    workspace_id = _get_workspace_from_user(request)
    
    with next(get_db()) as db:
        # Verify job exists and belongs to workspace
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail="Import job not completed")
        
        # TODO: Process review and apply changes
        # This would involve:
        # 1. Applying field mappings
        # 2. Merging conflicts based on auto_merge flag
        # 3. Publishing if publish_after is True
        
        job.status = "reviewed"
        if payload.publish_after:
            # Update target KB status to published
            if job.target_kb_id:
                target_kb = db.query(KnowledgeBase).filter(
                    KnowledgeBase.id == job.target_kb_id,
                    KnowledgeBase.workspace_id == workspace_id
                ).first()
                if target_kb:
                    target_kb.status = "published"
                    target_kb.published_at = datetime.utcnow()
        
        db.commit()
        
        return {"job_id": job_id, "status": "reviewed"}


@app.get("/kb/assignments")
def list_kb_assignments(
    request: Request,
    scope: str = Query(None, description="Filter by scope"),
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """List knowledge base assignments for workspace"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        query = db.query(KbAssignment).filter(
            KbAssignment.workspace_id == workspace_id
        )
        
        if scope:
            query = query.filter(KbAssignment.scope == scope)
        
        assignments = query.all()
        
        # Enrich with KB details
        enriched = []
        for assignment in assignments:
            kb = db.query(KnowledgeBase).filter(
                KnowledgeBase.id == assignment.kb_id
            ).first()
            
            if kb:
                enriched.append({
                    "id": assignment.id,
                    "scope": assignment.scope,
                    "scope_id": assignment.scope_id,
                    "kb_id": assignment.kb_id,
                    "kb_name": kb.name,
                    "kb_kind": kb.kind,
                    "kb_status": kb.status,
                    "created_at": assignment.created_at
                })
        
        return {"assignments": enriched}


@app.get("/kb/ai-usage")
def get_ai_usage(
    request: Request,
    period: str = Query("2025-01", description="Period in YYYY-MM format"),
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get AI usage statistics for workspace"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Parse period
        try:
            year, month = period.split("-")
            start_date = datetime(int(year), int(month), 1)
            if int(month) == 12:
                end_date = datetime(int(year) + 1, 1, 1)
            else:
                end_date = datetime(int(year), int(month) + 1, 1)
        except:
            start_date = datetime(2025, 1, 1)
            end_date = datetime(2025, 2, 1)
        
        # Get usage for period
        usage = db.query(AiUsage).filter(
            AiUsage.workspace_id == workspace_id,
            AiUsage.created_at >= start_date,
            AiUsage.created_at < end_date
        ).all()
        
        # Aggregate by kind
        by_kind = {}
        total_tokens_in = 0
        total_tokens_out = 0
        total_cost_micros = 0
        
        for u in usage:
            kind = u.kind
            if kind not in by_kind:
                by_kind[kind] = {
                    "tokens_in": 0,
                    "tokens_out": 0,
                    "cost_micros": 0,
                    "count": 0
                }
            
            by_kind[kind]["tokens_in"] += u.tokens_in or 0
            by_kind[kind]["tokens_out"] += u.tokens_out or 0
            by_kind[kind]["cost_micros"] += u.cost_micros or 0
            by_kind[kind]["count"] += 1
            
            total_tokens_in += u.tokens_in or 0
            total_tokens_out += u.tokens_out or 0
            total_cost_micros += u.cost_micros or 0
        
        return {
            "period": period,
            "by_kind": by_kind,
            "totals": {
                "tokens_in": total_tokens_in,
                "tokens_out": total_tokens_out,
                "cost_cents": total_cost_micros / 1000000,  # Convert microcents to cents
                "jobs_count": len(usage)
            }
        }


# ===================== Knowledge Base Fields Management =====================

@app.post("/kb/{kb_id}/fields")
def create_kb_field(
    request: Request,
    kb_id: str,
    payload: schemas.KbFieldCreate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Create a new field in knowledge base"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify KB exists and belongs to workspace
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Verify section exists if specified
        if payload.section_id:
            section = db.query(KbSection).filter(
                KbSection.id == payload.section_id,
                KbSection.kb_id == kb_id
            ).first()
            if not section:
                raise HTTPException(status_code=404, detail="Section not found")
        
        # Create field
        field_id = f"field_{secrets.token_urlsafe(8)}"
        field = KbField(
            id=field_id,
            kb_id=kb_id,
            section_id=payload.section_id,
            key=payload.key,
            label=payload.label,
            value_text=payload.value_text,
            value_json=payload.value_json,
            lang=payload.lang,
            confidence=payload.confidence
        )
        db.add(field)
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, kb_id)
        
        # Audit trail
        _audit_kb_change(db, kb_id, "u_1", "create_field", {
            "field_id": field_id,
            "field_key": field.key,
            "field_label": field.label
        })
        
        return {
            "id": field_id,
            "key": field.key,
            "label": field.label,
            "status": "created"
        }


@app.patch("/kb/fields/{field_id}")
def update_kb_field(
    request: Request,
    field_id: str,
    payload: schemas.KbFieldUpdate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Update a knowledge base field"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify field exists and belongs to workspace
        field = db.query(KbField).join(KnowledgeBase).filter(
            KbField.id == field_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not field:
            raise HTTPException(status_code=404, detail="Field not found")
        
        # Update fields
        if payload.label is not None:
            field.label = payload.label
        if payload.value_text is not None:
            field.value_text = payload.value_text
        if payload.value_json is not None:
            field.value_json = payload.value_json
        if payload.lang is not None:
            field.lang = payload.lang
        if payload.confidence is not None:
            field.confidence = payload.confidence
        
        field.updated_at = datetime.utcnow()
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, field.kb_id)
        
        # Audit trail
        _audit_kb_change(db, field.kb_id, "u_1", "update_field", {
            "field_id": field_id,
            "changes": payload.dict(exclude_unset=True)
        })
        
        return {"id": field_id, "status": "updated"}


@app.delete("/kb/fields/{field_id}")
def delete_kb_field(
    request: Request,
    field_id: str,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Delete a knowledge base field"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify field exists and belongs to workspace
        field = db.query(KbField).join(KnowledgeBase).filter(
            KbField.id == field_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not field:
            raise HTTPException(status_code=404, detail="Field not found")
        
        # Delete field
        db.delete(field)
        db.commit()
        
        return {"id": field_id, "status": "deleted"}


@app.get("/kb/templates")
def get_kb_templates(
    request: Request,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get available KB templates"""
    from .ai_client import KB_TEMPLATES
    
    return {
        "templates": [
            {
                "name": template_name,
                "display_name": template_data.get("name", template_name.title()),
                "sections": template_data.get("sections", [])
            }
            for template_name, template_data in KB_TEMPLATES.items()
        ]
    }


# ===================== Knowledge Base Sections Management =====================

@app.post("/kb/{kb_id}/sections")
def create_kb_section(
    request: Request,
    kb_id: str,
    payload: schemas.KbSectionCreate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Create a new section in knowledge base"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify KB exists and belongs to workspace
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Create section
        section_id = f"section_{secrets.token_urlsafe(8)}"
        section = KbSection(
            id=section_id,
            kb_id=kb_id,
            key=payload.key,
            title=payload.title,
            order_index=payload.order_index,
            content_md=payload.content_md,
            content_json=payload.content_json
        )
        db.add(section)
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, kb_id)
        
        # Audit trail
        _audit_kb_change(db, kb_id, "u_1", "create_section", {
            "section_id": section_id,
            "section_key": section.key,
            "section_title": section.title
        })
        
        return {
            "id": section_id,
            "key": section.key,
            "title": section.title,
            "status": "created"
        }


@app.patch("/kb/sections/{section_id}")
def update_kb_section(
    request: Request,
    section_id: str,
    payload: schemas.KbSectionUpdate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Update a knowledge base section"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify section exists and belongs to workspace
        section = db.query(KbSection).join(KnowledgeBase).filter(
            KbSection.id == section_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        
        # Update fields
        if payload.title is not None:
            section.title = payload.title
        if payload.order_index is not None:
            section.order_index = payload.order_index
        if payload.content_md is not None:
            section.content_md = payload.content_md
        if payload.content_json is not None:
            section.content_json = payload.content_json
        
        section.updated_at = datetime.utcnow()
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, kb_id)
        
        # Audit trail
        _audit_kb_change(db, kb_id, "u_1", "update_section", {
            "section_id": section_id,
            "changes": payload.dict(exclude_unset=True)
        })
        
        return {"id": section_id, "status": "updated"}


@app.delete("/kb/sections/{section_id}")
def delete_kb_section(
    request: Request,
    section_id: str,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Delete a knowledge base section"""
    workspace_id = request.headers.get("X-Workspace-Id", "ws_1")
    
    with next(get_db()) as db:
        # Verify section exists and belongs to workspace
        section = db.query(KbSection).join(KnowledgeBase).filter(
            KbSection.id == section_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        
        # Delete associated fields first
        db.query(KbField).filter(KbField.section_id == section_id).delete()
        
        # Delete section
        db.delete(section)
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, kb_id)
        
        # Audit trail
        _audit_kb_change(db, kb_id, "u_1", "delete_section", {
            "section_id": section_id,
            "section_key": section.key
        })
        
        return {"id": section_id, "status": "deleted"}


@app.post("/kb/imports/{job_id}/cancel")
def cancel_import_job(
    request: Request,
    job_id: str,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Cancel an import job"""
    workspace_id = _get_workspace_from_user(request)
    
    with next(get_db()) as db:
        # Verify job exists and belongs to workspace
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        if job.status in ["completed", "failed", "canceled"]:
            raise HTTPException(status_code=400, detail="Cannot cancel job in terminal state")
        
        job.status = "canceled"
        db.commit()
        
        # TODO: Cancel background job if running
        # dramatiq.cancel(job_id)
        
        return {"job_id": job_id, "status": "canceled"}


@app.post("/kb/imports/{job_id}/retry")
def retry_import_job(
    request: Request,
    job_id: str,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Retry a failed import job"""
    workspace_id = _get_workspace_from_user(request)
    
    with next(get_db()) as db:
        # Verify job exists and belongs to workspace
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        if job.status != "failed":
            raise HTTPException(status_code=400, detail="Can only retry failed jobs")
        
        job.status = "pending"
        job.error_message = None
        db.commit()
        
        # TODO: Queue background job for processing
        # kb_import_job.send(job_id)
        
        return {"job_id": job_id, "status": "retrying"}


@app.post("/kb/imports/{job_id}/commit")
def commit_import_job(
    request: Request,
    job_id: str,
    payload: schemas.ImportReviewRequest,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Commit and apply import job changes"""
    workspace_id = _get_workspace_from_user(request)
    user_id = "u_1"  # In production, get from session
    
    with next(get_db()) as db:
        # Verify job exists and belongs to workspace
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail="Import job not completed")
        
        # Apply field mappings and merge changes with advisory lock
        if job.target_kb_id:
            # Acquire advisory lock to prevent concurrent commits on same KB
            db.execute(f"SELECT pg_advisory_xact_lock('{job.target_kb_id}')")
            
            # Update existing KB with FOR UPDATE
            target_kb = db.query(KnowledgeBase).filter(
                KnowledgeBase.id == job.target_kb_id,
                KnowledgeBase.workspace_id == workspace_id
            ).with_for_update().first()
            
            if not target_kb:
                raise HTTPException(status_code=404, detail="Target KB not found")
            
                    # Apply changes based on mappings in job.meta_json
        mappings = job.meta_json.get("mappings", {}) if job.meta_json else {}
        
        # Validate mapping conflicts (one source column -> one destination)
        if mappings:
            source_columns = list(mappings.keys())
            dest_fields = list(mappings.values())
            
            # Check for duplicate destinations
            if len(dest_fields) != len(set(dest_fields)):
                duplicates = [field for field in set(dest_fields) if dest_fields.count(field) > 1]
                raise HTTPException(
                    status_code=422, 
                    detail=_create_error_response(
                        "MAPPING_CONFLICT",
                        "Multiple source columns map to the same destination field",
                        {"duplicate_fields": duplicates},
                        "Ensure each destination field is mapped to only one source column"
                    )
                )
        
        # TODO: Apply actual field updates based on mappings
        # For now, just update the timestamp
        target_kb.updated_at = datetime.utcnow()
        
        # Publish if requested
        if payload.publish_after:
            target_kb.status = "published"
            target_kb.published_at = datetime.utcnow()
        
        # Recalculate metrics
        _recalculate_kb_metrics(db, target_kb.id)
        
        # Audit trail
        _audit_kb_change(db, target_kb.id, user_id, "import_commit", {
            "job_id": job_id,
            "auto_merge": payload.auto_merge,
            "publish_after": payload.publish_after
        })
        
        # Update job status
        job.status = "committed"
        job.completed_at = datetime.utcnow()
        
        # Commit all changes in transaction
        db.commit()
        
        return {
            "job_id": job_id, 
            "status": "committed",
            "target_kb_id": job.target_kb_id
        }


@app.post("/kb/imports/{job_id}/cancel")
def cancel_import_job(
    request: Request,
    job_id: str,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Cancel an import job"""
    workspace_id = _get_workspace_from_user(request)
    
    with next(get_db()) as db:
        # Verify job exists and belongs to workspace
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        if job.status in ["completed", "failed", "canceled", "committed"]:
            raise HTTPException(status_code=400, detail="Cannot cancel job in terminal state")
        
        job.status = "canceled"
        job.completed_at = datetime.utcnow()
        db.commit()
        
        # TODO: Cancel background job if running
        # dramatiq.cancel(job_id)
        
        return {"job_id": job_id, "status": "canceled"}


async def get_tenant_id(request: Request) -> str:
    """Get tenant ID from request (placeholder implementation)"""
    # In production, extract from JWT token or session
    # For now, use workspace ID from header or default
    return request.headers.get("X-Workspace-Id", "ws_1")

def _recalculate_kb_metrics(db: Session, kb_id: str) -> None:
    """Recalculate KB completeness and freshness metrics"""
    # Get all sections and fields for KB
    sections = db.query(KbSection).filter(KbSection.kb_id == kb_id).all()
    fields = db.query(KbField).filter(KbField.kb_id == kb_id).all()
    
    # Calculate completeness
    total_sections = len(sections)
    total_fields = len(fields)
    
    if total_sections == 0:
        completeness_pct = 0
    else:
        # Section completeness (50% weight)
        section_completeness = sum(s.completeness_pct or 0 for s in sections) / total_sections
        
        # Field completeness (50% weight)
        field_completeness = sum(1 for f in fields if f.value_text or f.value_json) / total_fields if total_fields > 0 else 0
        
        completeness_pct = int((section_completeness * 0.5 + field_completeness * 0.5) * 100)
    
    # Calculate freshness (days since last update)
    now = datetime.utcnow()
    last_updated = max(
        [kb.updated_at for kb in [sections + fields] if hasattr(kb, 'updated_at') and kb.updated_at],
        default=now
    )
    
    days_since_update = (now - last_updated).days
    if days_since_update <= 7:
        freshness_score = 100
    elif days_since_update <= 30:
        freshness_score = 75
    elif days_since_update <= 90:
        freshness_score = 50
    else:
        freshness_score = 25
    
    # Update KB metrics
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if kb:
        kb.completeness_pct = completeness_pct
        kb.freshness_score = freshness_score
        db.commit()

@app.get("/metrics/funnel")
async def get_funnel_metrics(days: int = 30):
	"""Get conversion funnel metrics for the specified period"""
	try:
		# Calculate date range
		end_date = datetime.utcnow()
		start_date = end_date - timedelta(days=days)
		
		# Mock data for now - replace with real queries
		funnel_data = {
			"reached": 1250,
			"connected": 890,
			"qualified": 445,
			"booked": 178
		}
		
		return funnel_data
	except Exception as e:
		logger.error(f"Error getting funnel metrics: {e}")
		raise HTTPException(status_code=500, detail="Failed to get funnel metrics")

@app.get("/metrics/agents/top")
async def get_top_agents(days: int = 30, limit: int = 10):
	"""Get top performing agents for the specified period"""
	try:
		# Calculate date range
		end_date = datetime.utcnow()
		start_date = end_date - timedelta(days=days)
		
		# Mock data for now - replace with real queries
		top_agents = [
			{"id": "agent_1", "name": "Marco Rossi", "calls": 156, "qualified_rate": 0.42, "avg_duration_sec": 138},
			{"id": "agent_2", "name": "Anna Bianchi", "calls": 142, "qualified_rate": 0.38, "avg_duration_sec": 145},
			{"id": "agent_3", "name": "Luca Verdi", "calls": 128, "qualified_rate": 0.35, "avg_duration_sec": 132},
			{"id": "agent_4", "name": "Sofia Neri", "calls": 115, "qualified_rate": 0.31, "avg_duration_sec": 128},
			{"id": "agent_5", "name": "Giuseppe Gialli", "calls": 98, "qualified_rate": 0.28, "avg_duration_sec": 125}
		]
		
		return top_agents[:limit]
	except Exception as e:
		logger.error(f"Error getting top agents: {e}")
		raise HTTPException(status_code=500, detail="Failed to get top agents")

@app.get("/metrics/geo")
async def get_geo_metrics(days: int = 30):
	"""Get geographic distribution metrics for the specified period"""
	try:
		# Calculate date range
		end_date = datetime.utcnow()
		start_date = end_date - timedelta(days=days)
		
		# Mock data for now - replace with real queries
		geo_data = [
			{"iso2": "IT", "calls": 684, "qualified": 156},
			{"iso2": "US", "calls": 456, "qualified": 98},
			{"iso2": "DE", "calls": 234, "qualified": 67},
			{"iso2": "FR", "calls": 198, "qualified": 45},
			{"iso2": "UK", "calls": 167, "qualified": 38}
		]
		
		return geo_data
	except Exception as e:
		logger.error(f"Error getting geo metrics: {e}")
		raise HTTPException(status_code=500, detail="Failed to get geo metrics")

@app.get("/metrics/cost/series")
async def get_cost_series(days: int = 30):
	"""Get cost series data for sparkline and projections"""
	try:
		# Calculate date range
		end_date = datetime.utcnow()
		start_date = end_date - timedelta(days=days)
		
		# Mock data for now - replace with real queries
		cost_series = []
		for i in range(days):
			date = start_date + timedelta(days=i)
			cost_series.append({
				"date": date.strftime("%Y-%m-%d"),
				"spend_cents": random.randint(5000, 25000),  # €50-250 per day
				"cost_per_min": random.uniform(0.15, 0.35)  # €0.15-0.35 per minute
			})
		
		return cost_series
	except Exception as e:
		logger.error(f"Error getting cost series: {e}")
		raise HTTPException(status_code=500, detail="Failed to get cost series")

