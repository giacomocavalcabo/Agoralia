import os
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
import secrets
from typing import Optional, List, Dict
from fastapi import FastAPI, Request, Header, HTTPException, Response, Body
from fastapi import Query
from fastapi import Depends, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

# bootstrap opzionale per esecuzione "da dentro backend/"
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Import assoluti dal pacchetto backend
from backend.db import Base, engine, get_db
from backend.logger import logger
from backend.config import settings

# Import di tutti i modelli all'inizio per evitare conflitti SQLAlchemy
from backend.models import (
    User, UserAuth, Workspace, WorkspaceMember, ProviderAccount, 
    TelephonyProvider, NumberOrder, Number, MagicLink, 
    RegulatorySubmission, KnowledgeBase, KbUsage
)

# 🔒 Assert di sicurezza per Base.metadata
import sqlalchemy as sa
assert isinstance(Base.metadata, sa.schema.MetaData), "Base.metadata corrotto (sovrascritto)"
from backend.routers import crm, auth, auth_microsoft, compliance, integrations, settings
from backend.utils.rate_limiter import telephony_rate_limiter
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from backend.services.webhook_verification import require_valid_webhook_signature
from backend.schemas import (
    LoginRequest, RegisterRequest, KnowledgeBaseCreate, KnowledgeBaseUpdate, ImportSourceRequest,
    KbAssignmentCreate, MergeDecisions, PromptBricksRequest, KbSectionCreate,
    KbSectionUpdate, KbFieldCreate, KbFieldUpdate, ImportMappingRequest,
    ImportReviewRequest, KbUsageTrackRequest, KbCrawlStart, KbCrawlStartResponse, KbCrawlStatus
)
from backend.schemas_billing import BudgetSettings, BudgetState, BudgetUpdateRequest
from backend.services.billing_service import (
    month_window, sum_ledger, check_budget, append_ledger, 
    get_workspace_budget_state, check_idempotency
)
from backend.services.budget_guard import atomic_ledger_write, atomic_budget_check
from backend import schemas
from backend.deps import auth_guard, admin_guard

# Models will be imported locally where needed to avoid duplication
from typing import Callable, Any, List, Dict
from sqlalchemy import or_, cast, String
import hashlib
import pyotp
import random
from pydantic import BaseModel, AnyHttpUrl, Field
from urllib.parse import urlparse
import re
import time
import httpx
from fastapi import BackgroundTasks

# Import services for Gamma (commented until models are implemented)
# from services.call_service import CallService
# from services.ai_service import AIService
# from services.shadow_analytics import ShadowAnalyticsService
# from ai_client import OpenAIClient

# ===================== Delta Models & Helpers =====================
class SegmentFilters(BaseModel):
    days: int = 30
    campaign_id: Optional[str] = None
    agent_id: Optional[str] = None
    lang: Optional[str] = None
    country: Optional[str] = None

class CompareRequest(BaseModel):
    left: SegmentFilters
    right: SegmentFilters

class GoalRule(BaseModel):
    metric: str  # e.g. booked_rate|qualified_rate|cost_per_min|connect_rate|dead_air
    op: str      # "<" | ">" | "<=" | ">=" | "==" | "!="
    threshold: float
    window_days: int = 7
    filters: SegmentFilters

class AlertCheckResponse(BaseModel):
    checks: List[Dict[str, Any]]
    filters: Dict[str, Any]

# Helper functions for Delta
import operator

OPS = {"<": operator.lt, ">": operator.gt, "<=": operator.le, ">=": operator.ge, "==": operator.eq, "!=": operator.ne}

def _delta(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or b is None:
        return None
    return round(a - b, 6)

def _safe_op(op: str):
    return OPS.get(op)

async def _build_metrics_overview(
    days: int = 30,
    campaign_id: str | None = None,
    agent_id: str | None = None,
    lang: str | None = "en-US",
    country: str | None = None,
) -> Dict[str, Any]:
    """
    Helper function to build metrics overview payload.
    Reuses existing mock generators for consistency.
    """
    funnel = await get_funnel_metrics(days=days)
    agents = await get_top_agents(days=days, limit=10)
    geo = await get_geo_metrics(days=days)
    cost = await get_cost_series(days=days)
    
    # Generate timeseries data
    timeseries = await get_timeseries_data(
        days=days, 
        campaign_id=campaign_id, 
        agent_id=agent_id, 
        lang=lang, 
        country=country
    )
    
    # Generate heatmap data
    heatmap = await get_heatmap_data(days=days)
    
    # Generate outcomes data
    outcomes = await get_outcomes_data(
        days=days, 
        campaign_id=campaign_id, 
        agent_id=agent_id, 
        lang=lang, 
        country=country
    )
    
    return {
        "funnel": funnel,
        "agents_top": agents,
        "geo": geo,
        "cost_series": cost,
        "timeseries": timeseries,
        "heatmap": heatmap,
        "outcomes": outcomes
    }

# ===================== Utility comuni: workspace & response adapter =====================
DEMO_MODE: bool = bool(int(os.getenv("DEMO_MODE", "0")))  # 1 abilita demo BE

def get_workspace_id(request: Request, fallback: Optional[str] = "ws_1") -> Optional[str]:
    """
    Estrae il workspace_id da (ordine):
    - header 'X-Workspace-Id'
    - request.state.workspace_id (se middleware a monte lo popola)
    - fallback (default 'ws_1')
    Non lancia eccezioni: se non c'è, ritorna fallback (anche None se fallback=None).
    """
    hdr = request.headers.get("X-Workspace-Id")
    if hdr:
        return hdr.strip()
    ws = getattr(request.state, "workspace_id", None)
    if ws:
        return ws
    return fallback

def adapt_list_response(items: List[Dict[str, Any]], total: Optional[int] = None) -> Dict[str, Any]:
    """
    Uniforma lo shape a {data, total} mantenendo retro-compat con {items}.
    """
    total_count = len(items) if total is None else int(total)
    return {
        "data": items,
        "total": total_count,
        "items": items,  # retro-compat per client legacy
    }

# ===================== Fine utility comuni =====================

try:
    # retell-sdk is optional during local dev, but required in prod for webhook verification
    from retell import Retell  # type: ignore
except Exception: # pragma: no cover
    Retell = None  # type: ignore

try:
    import bcrypt  # type: ignore
except Exception: # pragma: no cover
    bcrypt = None  # type: ignore

try:
    import redis  # type: ignore
except Exception: # pragma: no cover
    redis = None  # type: ignore

# Chromium PDF generator
PDF_GENERATOR_AVAILABLE = False
try:
    from backend.pdf_chromium import html_to_pdf_chromium, check_chromium_available
    PDF_GENERATOR_AVAILABLE = check_chromium_available()
    if PDF_GENERATOR_AVAILABLE:
        print("✅ Chromium PDF generator available")
    else:
        print("⚠️ Chromium not found in PATH")
except Exception as e:
    print(f"Warning: Chromium PDF generator not available: {e}. Compliance attestations will use fallback.")

logger.info("Starting Agoralia API initialization...")

# Lifespan sicuro: NON fallisce l'avvio se Redis/DB non rispondono subito
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Esempi di init sicuri (facoltativi):
        #   - ping leggero di Redis/DB avvolto in try/except
        #   - warmup di cache opzionali
        # Se qualcosa va giù, logghiamo ma non buttiamo giù il server.
        logger.info("App startup...")
        # await maybe_init_things_safely()
    except Exception:
        logger.exception("Startup hook failed (continuing with app up).")
    yield
    try:
        logger.info("App shutdown...")
        # await maybe_close_things_safely()
    except Exception:
        logger.exception("Shutdown hook failed.")

app = FastAPI(title="Agoralia API", version="0.1.0", lifespan=lifespan)
app.state.oauth_state = {}  # per validare 'state' su OAuth callback (temp store)

# ===================== CORS Configuration =====================
# Firma di runtime per identificare quale app sta girando
GIT_SHA = os.getenv("RAILWAY_GIT_COMMIT_SHA") or os.getenv("GIT_SHA") or "unknown"
GIT_BRANCH = os.getenv("RAILWAY_GIT_BRANCH") or os.getenv("GIT_BRANCH") or "unknown"
ENTRYPOINT = __name__  # dovrebbe essere "backend.main"

# logger (evita il NameError visto nei log)
logger = logging.getLogger("uvicorn.error")

# CORS per cookie cross-site da Vercel → Railway
ALLOWED_ORIGINS = [
    "https://app.agoralia.app",           # prod SPA
    # "https://staging.agoralia.app",     # se/quando serve
    # "http://localhost:5173",            # dev SPA vite
]

# CORS deve essere l'ULTIMO add_middleware (outermost nello stack)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Middleware di log richieste (non interferisce con CORS)
@app.middleware("http")
async def _log_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    logger.info("[CORS] %s %s | Origin=%s", request.method, request.url.path, origin)
    return await call_next(request)

logger.info("CORS middleware configured successfully")

# ===================== User Trace Middleware =====================
@app.middleware("http")
async def user_trace(request: Request, call_next):
    """Debug middleware: aggiunge header X-Req-User per tracciare utente"""
    try:
        from backend.sessions import get_user_id, read_session_cookie
        session_id = read_session_cookie(request)
        if session_id:
            user_id = get_user_id(session_id)
            if user_id:
                response = await call_next(request)
                response.headers["X-Req-User"] = f"{user_id}|session:{session_id[:8]}"
                return response
    except Exception:
        pass
    
    response = await call_next(request)
    return response

logger.info("User trace middleware configured successfully")

# ===================== Static Files & SPA Configuration =====================
import os
from fastapi.responses import FileResponse
# StaticFiles non serve più - backend API-only

# Backend API-only: frontend servito separatamente da Vercel
logger.info("Backend configurato come API-only - frontend su Vercel (app.agoralia.app)")

logger.info("FastAPI app created successfully")

# ===================== Health check endpoint =====================
@app.get("/_whoami", include_in_schema=False)
def whoami():
    return {
        "git_sha": GIT_SHA,
        "git_branch": GIT_BRANCH,
        "entrypoint": ENTRYPOINT,
        "routes": sorted(set(r.path for r in app.routes)),
    }

@app.get("/health")
def health():
    """
    Health check endpoint per Railway - risponde IMMEDIATAMENTE
    NON fa chiamate a OpenAI/Redis qui per essere sempre veloce
    """
    return {
        "ok": True, 
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "git_sha": GIT_SHA,
        "git_branch": GIT_BRANCH,
        "entrypoint": ENTRYPOINT,
    }

# Endpoint di debug visibile nei log dello screenshot (prima era 404)
@app.get("/debug/cors", include_in_schema=False)
def debug_cors(request: Request):
    return {
        "allow_origins": settings.cors_allow_origins,
        "allow_origin_regex": settings.cors_allow_origin_regex,
        "seen_origin": request.headers.get("origin"),
        "host": request.headers.get("host"),
        "x_forwarded_proto": request.headers.get("x-forwarded-proto"),
    }

@app.get("/db/health")
def db_health(db: Session = Depends(get_db)):
    """
    Health check specifico per il database - testa la connessione
    Se fallisce, il problema è connessione DB, non la logica dell'app
    """
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        return {"db": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not reachable: {str(e)}")

@app.get("/auth/test")
def auth_test():
    """
    Health check endpoint for authentication system
    Tests database connection and session management
    """
    try:
        # Test database connection
        from sqlalchemy import text
        db = next(get_db())
        db.execute(text("SELECT 1"))
        
        return {
            "status": "ok",
            "auth_system": "operational",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=503, 
            detail=f"Authentication system unavailable: {str(e)}"
        )

# /auth/me endpoint moved to backend/routers/auth.py

@app.post("/setup/admin")
def setup_admin():
    """
    Endpoint temporaneo per creare l'admin user
    Da rimuovere dopo il primo utilizzo
    """
    try:
        import bcrypt
        
        db = next(get_db())
        
        # Check if admin already exists
        existing_user = db.query(User).filter(
            User.email == 'giacomo.cavalcabo14@gmail.com'
        ).first()
        
        if existing_user:
            return {
                "message": "Admin user already exists",
                "email": existing_user.email,
                "is_admin": existing_user.is_admin_global
            }
        
        # Create new admin user
        password = "Palemone01!"
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        # Create user
        user = User(
            id=f"u_{int(datetime.now(timezone.utc).timestamp())}",
            email='giacomo.cavalcabo14@gmail.com',
            name='Giacomo Cavalcabo',
            is_admin_global=True,
            email_verified_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(user)
        db.flush()
        
        # Create user auth record
        user_auth = UserAuth(
            id=f"ua_{int(datetime.now(timezone.utc).timestamp())}",
            user_id=user.id,
            provider='password',
            pass_hash=hashed.decode('utf-8'),
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(user_auth)
        db.commit()
        
        return {
            "message": "Admin user created successfully!",
            "email": user.email,
            "password": password,
            "is_admin": user.is_admin_global
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating admin: {str(e)}")

@app.post("/setup/user")
def setup_user(payload: RegisterRequest):
    """
    Endpoint per creare utenti normali (non admin)
    """
    try:
        import bcrypt
        
        email = payload.email
        password = payload.password
        name = payload.name
        
        # Password policy validation is handled by Pydantic schema
        
        db = next(get_db())
        
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            return {
                "message": "User already exists",
                "email": existing_user.email
            }
        
        # Create new user
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        user = User(
            id=f"u_{int(datetime.now(timezone.utc).timestamp())}",
            email=email,
            name=name,
            is_admin_global=False,
            email_verified_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(user)
        db.flush()
        
        # Create user auth record
        user_auth = UserAuth(
            id=f"ua_{int(datetime.now(timezone.utc).timestamp())}",
            user_id=user.id,
            provider='password',
            pass_hash=hashed.decode('utf-8'),
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(user_auth)
        db.commit()
        
        return {
            "message": "User created successfully!",
            "email": user.email,
            "name": user.name,
            "is_admin": user.is_admin_global
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")

# ===================== Boot logging =====================
# Startup event rimosso - ora gestito dal lifespan robusto sopra

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
# Database setup rimosso - ora gestito da Alembic in Railway

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



# Routers already imported above
logger.info("Importing routers...")

# Tutte le rotte sotto /api (una sola versione, niente duplicati "nudi")
logger.info("Including API routers...")
api = APIRouter(prefix="/api")

logger.info("Including Auth router...")
api.include_router(auth.router, tags=["auth"])
logger.info("Auth router included successfully")

logger.info("Including Auth Microsoft router...")
api.include_router(auth_microsoft.router, prefix="/auth", tags=["auth"])
logger.info("Auth Microsoft router included successfully")

logger.info("Including Compliance router...")
api.include_router(compliance.router, prefix="/compliance", tags=["compliance"])
logger.info("Compliance router included successfully")

logger.info("Including CRM router...")
api.include_router(crm.router, prefix="/crm", tags=["crm"])
logger.info("CRM router included successfully")

logger.info("Including Integrations router...")
api.include_router(integrations.router, prefix="/settings", tags=["integrations"])
logger.info("Integrations router included successfully")

logger.info("Including Settings router...")
api.include_router(settings.router, tags=["settings"])
logger.info("Settings router included successfully")

logger.info("Including Audit router...")
from backend.routers import audit
api.include_router(audit.router, tags=["audit"])
logger.info("Audit router included successfully")

app.include_router(api)
logger.info("API routers included successfully")

# Session management moved to backend/sessions.py to avoid circular imports


# Session management moved to backend/sessions.py to avoid circular imports


# CSRF middleware removed - using sessions.py for session management


# --- Google OAuth aliases (retrocompatibilità) ---
# Google Console ha il redirect URI senza /api, ma le route reali sono sotto /api

@app.get("/auth/oauth/google/callback")
async def _alias_google_callback(request: Request):
    # preserve querystring (state, code, ecc.)
    qs = request.url.query
    target = "/api/auth/oauth/google/callback"
    if qs:
        target = f"{target}?{qs}"
    # 307 = keep method
    return RedirectResponse(url=target, status_code=307)

@app.post("/auth/oauth/google/start")
async def _alias_google_start():
    # il frontend/estensioni potrebbero ancora chiamare questo path
    return RedirectResponse(url="/api/auth/oauth/google/start", status_code=307)

# --- Microsoft OAuth aliases (retrocompatibilità) ---

@app.get("/auth/oauth/microsoft/callback")
async def _alias_ms_callback(request: Request):
    qs = request.url.query
    target = "/api/auth/oauth/microsoft/callback"
    if qs:
        target = f"{target}?{qs}"
    return RedirectResponse(url=target, status_code=307)

@app.post("/auth/oauth/microsoft/start")
async def _alias_ms_start():
    return RedirectResponse(url="/api/auth/oauth/microsoft/start", status_code=307)

@app.get("/health")
def healthcheck() -> dict:
    return {
        "ok": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "git_sha": GIT_SHA,
        "git_branch": GIT_BRANCH,
        "entrypoint": ENTRYPOINT
    }

@app.get("/test")
def test_endpoint() -> dict:
    """Endpoint di test senza autenticazione per verificare il proxy Vercel"""
    return {
        "message": "Test endpoint working",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "backend": "FastAPI",
        "deployment": "Railway"
    }

@app.get("/__routes")
def __routes():
    """Debug endpoint per vedere tutte le rotte esposte"""
    routes = []
    for route in app.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": getattr(route, "name", "unknown")
            })
    return {"routes": routes, "total": len(routes)}


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

# --- NUOVO: alias per /api/metrics/* e /api/dashboard/* (redirect 307)
@app.get("/api/metrics/{rest:path}")
def _alias_metrics(rest: str, request: Request):
    """Alias per /api/metrics/* → redirect a /metrics/*"""
    return RedirectResponse(url=f"/metrics/{rest}", status_code=307)

@app.get("/api/dashboard/{rest:path}")
def _alias_dashboard(rest: str, request: Request):
    """Alias per /api/dashboard/* → redirect a /dashboard/*"""
    return RedirectResponse(url=f"/dashboard/{rest}", status_code=307)

# --- NUOVO: alias per /api/integrations/* (redirect 307)
@app.get("/api/integrations/{rest:path}")
def _alias_integrations(rest: str, request: Request):
    """Alias per /api/integrations/* → redirect a /api/settings/integrations/*"""
    return RedirectResponse(url=f"/api/settings/integrations/{rest}", status_code=307)

@app.post("/api/integrations/{rest:path}")
def _alias_integrations_post(rest: str, request: Request):
    """Alias POST per /api/integrations/* → redirect a /api/settings/integrations/*"""
    return RedirectResponse(url=f"/api/settings/integrations/{rest}", status_code=307)

@app.delete("/api/integrations/{rest:path}")
def _alias_integrations_delete(rest: str, request: Request):
    """Alias DELETE per /api/integrations/* → redirect a /api/settings/integrations/*"""
    return RedirectResponse(url=f"/api/settings/integrations/{rest}", status_code=307)


# ===================== Numbers Endpoints =====================
@app.get("/numbers")
def numbers_list(
    request: Request,
    workspace_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    q: Optional[str] = None,
    db: Session = Depends(get_db)
) -> dict:
    wsid = workspace_id or get_workspace_id(request, fallback="ws_1")
    
    # logica attuale → recupera `items` (lista dict)
    rows = db.query(Number).filter(Number.workspace_id == wsid).limit(limit).offset(offset).all()
    items = [{
        "id": n.id, "e164": n.e164, "country_iso": n.country_iso, "source": n.source,
        "capabilities": n.capabilities or [], "verified": bool(n.verified), "provider": n.provider,
        "can_inbound": bool(n.can_inbound),
    } for n in rows]
    
    # UNIFICAZIONE SHAPE (retro-compat: includi anche `items`)
    return adapt_list_response(items, len(items))


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
async def campaign_set_from(cid: str, payload: dict, db: Session = Depends(get_db), user=Depends(auth_guard)) -> dict:
    c = db.query(Campaign).filter(Campaign.id == cid, Campaign.workspace_id == user.workspace_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    e164 = payload.get("e164")
    if e164:
        # Validate number belongs to workspace and can be used for outbound
        number = db.query(Number).filter(
            Number.phone_e164 == e164,
            Number.workspace_id == user.workspace_id
        ).first()
        
        if not number:
            raise HTTPException(status_code=400, detail="Number not found in workspace")
        
        if not number.outbound_enabled:
            raise HTTPException(status_code=400, detail="Number not enabled for outbound")
        
        if not (number.hosted or number.verified_cli):
            raise HTTPException(status_code=400, detail="Number must be hosted or verified for outbound")
    
    c.from_number_e164 = e164
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
    from backend.auth.session import get_session
    sess = get_session(request)
    claims = (sess or {}).get("claims") if sess else None
    if not claims or not claims.get("is_admin_global"):
        raise HTTPException(status_code=403, detail="Admin required")


# admin_guard è ora importato da backend.deps


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
        from worker import send_notification_job  # type: ignore
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
# NOTE: All auth endpoints are now handled by backend/routers/auth.py
# under /api/auth/* prefix. Legacy endpoints removed to avoid conflicts.


# All auth endpoints moved to backend/routers/auth.py
    
    start_time = time.time()
    request_id = f"login_{int(time.time())}_{hash(str(payload)) % 1000}"
    
    try:
        print(f"🚀 [{request_id}] Login attempt started")
        print(f"📧 [{request_id}] Payload received: {payload}")
        print(f"🌐 [{request_id}] Origin: {request.headers.get('origin', 'unknown')}")
        print(f"🔍 [{request_id}] User-Agent: {request.headers.get('user-agent', 'unknown')}")
        
        # ===================== Rate Limiting =====================
        try:
            auth_rate_limiter.check_rate_limit(request)
            print(f"⏱️ [{request_id}] Rate limit check passed")
        except HTTPException as e:
            # Log failed attempt due to rate limiting
            auth_audit_logger.log_auth_event(
                "login_rate_limited", 
                None, 
                False, 
                request,
                {"reason": "rate_limit_exceeded"}
            )
            raise e
        
        # ===================== Input Validation =====================
        email = payload.email.strip().lower()
        password = payload.password
        
        print(f"📝 [{request_id}] Email: {email}, Password: provided")
        
        # ===================== Database Connection Test =====================
        print(f"🗄️ [{request_id}] Testing database connection...")
        try:
            db = next(get_db())
            print(f"✅ [{request_id}] Database connection successful")
        except OperationalError as e:
            print(f"❌ [{request_id}] Database connection failed (OperationalError): {e}")
            auth_audit_logger.log_auth_event(
                "login_failed", 
                email, 
                False, 
                request,
                {"reason": "database_unavailable", "error": str(e)}
            )
            raise HTTPException(status_code=503, detail="Service temporarily unavailable")
        except Exception as e:
            print(f"❌ [{request_id}] Database connection failed (other): {e}")
            auth_audit_logger.log_auth_event(
                "login_failed", 
                email, 
                False, 
                request,
                {"reason": "database_error", "error": str(e)}
            )
            raise HTTPException(status_code=500, detail="Internal server error")
        
        # ===================== User Authentication =====================
        try:
            with db:
                print(f"🔍 [{request_id}] Starting database queries...")
                
                # Query User
                query_start = time.time()
                try:
                    user = db.query(User).filter(User.email.ilike(email)).first()
                    query_time = time.time() - query_start
                    print(f"📊 [{request_id}] Query User took {query_time:.3f}s")
                    print(f"👤 [{request_id}] User found: {user.id if user else 'None'}")
                except OperationalError as e:
                    print(f"❌ [{request_id}] Query User failed (OperationalError): {e}")
                    raise HTTPException(status_code=503, detail="Service temporarily unavailable")
                except Exception as e:
                    print(f"❌ [{request_id}] Query User failed (other): {e}")
                    raise HTTPException(status_code=500, detail="Internal server error")
                
                # Check if user is disabled/banned
                if user and hasattr(user, 'is_disabled') and user.is_disabled:
                    auth_audit_logger.log_auth_event(
                        "login_failed", 
                        email, 
                        False, 
                        request,
                        {"reason": "account_disabled"}
                    )
                    raise HTTPException(status_code=403, detail="Account is disabled")
                
                # Password validation with timing attack protection
                password_valid = False
                if user:
                    print(f"🔑 [{request_id}] User exists, checking password...")
                    
                    # Query UserAuth
                    auth_start = time.time()
                    try:
                        ua = db.query(UserAuth).filter(
                            UserAuth.user_id == user.id, 
                            UserAuth.provider == "password"
                        ).first()
                        auth_time = time.time() - auth_start
                        print(f"🔑 [{request_id}] Query UserAuth took {auth_time:.3f}s")
                    except OperationalError as e:
                        raise HTTPException(status_code=503, detail="Service temporarily unavailable")
                    except Exception as e:
                        raise HTTPException(status_code=500, detail="Internal server error")
                    
                    if ua and ua.pass_hash and bcrypt:
                        try:
                            # Timing-safe password check
                            pwd_start = time.time()
                            password_valid = bcrypt.checkpw(
                                password.encode("utf-8"), 
                                ua.pass_hash.encode("utf-8")
                            )
                            pwd_time = time.time() - pwd_start
                            print(f"🔒 [{request_id}] Password check took {pwd_time:.3f}s")
                            print(f"✅ [{request_id}] Password valid: {password_valid}")
                        except Exception as e:
                            print(f"❌ [{request_id}] Password check error: {e}")
                            password_valid = False
                
                # Anti-enumeration: same error for invalid email or password
                if not user or not password_valid:
                    # Record failed attempt
                    auth_rate_limiter.record_attempt(request, False)
                    auth_audit_logger.log_auth_event(
                        "login_failed", 
                        email, 
                        False, 
                        request,
                        {"reason": "invalid_credentials"}
                    )
                    
                    # Log failed attempt for security monitoring
                    client_ip = request.client.host
                    user_agent = request.headers.get("user-agent", "")
                    print(f"❌ [{request_id}] Failed login attempt - IP: {client_ip}, Email: {email}, UA: {user_agent}")
                    
                    raise HTTPException(
                        status_code=401, 
                        detail="Invalid email or password. Please try again."
                    )
                
                # ===================== Success Path =====================
                print(f"🎯 [{request_id}] Authentication successful!")
                
                # Check TOTP if required
                if user.totp_enabled:
                    print(f"🔐 [{request_id}] TOTP required for user {user.id}")
                    auth_audit_logger.log_auth_event(
                        "login_totp_required", 
                        email, 
                        True, 
                        request,
                        {"user_id": user.id}
                    )
                    return Response(
                        content=json.dumps({
                            "requires_totp": True,
                            "user_id": user.id,
                            "message": "TOTP code required"
                        }),
                        media_type="application/json"
                    )
                
                # Auto-promote to admin if in allowlist
                admin_emails = os.getenv("ADMIN_EMAIL_ALLOWLIST", "").split(",")
                if user.email.strip() in [e.strip() for e in admin_emails]:
                    if not user.is_admin_global:
                        user.is_admin_global = True
                        db.add(user)
                        print(f"✅ [{request_id}] Auto-promoted {user.email} to global admin")
                
                # Build workspace memberships
                memberships = []
                try:
                    wm = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
                    if wm:
                        memberships.append({
                            "workspace_id": wm.workspace_id,
                            "role": wm.role
                        })
                except Exception as e:
                    print(f"⚠️ [{request_id}] WorkspaceMember query failed: {e}")
                    memberships = []
                
                claims = {
                    "user_id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "is_admin_global": bool(user.is_admin_global),
                    "email_verified": bool(user.email_verified_at),
                    "memberships": memberships,
                }
                
                # Update last login
                user.last_login_at = datetime.now(timezone.utc)
                db.add(user)
                
                try:
                    db.commit()
                    print(f"💾 [{request_id}] Database commit successful")
                except Exception as e:
                    print(f"⚠️ [{request_id}] Failed to update last_login: {e}")
                    # Don't fail login for this
                
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ [{request_id}] Database operation failed: {e}")
            auth_audit_logger.log_auth_event(
                "login_failed", 
                email, 
                False, 
                request,
                {"reason": "database_error", "error": str(e)}
            )
            raise HTTPException(status_code=500, detail="Internal server error")
        
        # ===================== Success Response =====================
        total_time = time.time() - start_time
        print(f"🎉 [{request_id}] Login successful in {total_time:.3f}s for user {email}")
        
        # Record successful attempt
        auth_rate_limiter.record_attempt(request, True)
        auth_audit_logger.log_auth_event(
            "login_success", 
            email, 
            True, 
            request,
            {"user_id": user.id, "login_time": total_time}
        )
        
        # Create response with secure session
        resp = Response(content=json.dumps({"ok": True, "user": claims}), media_type="application/json")
        
        # Use enhanced session manager
        session_id = session_manager.create_session(claims, request)
        resp.set_cookie(
            "session_id", 
            session_id, 
            httponly=True, 
            secure=True, 
            samesite="lax",
            max_age=86400  # 24 hours
        )
        
        return resp
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch all other exceptions and log them
        total_time = time.time() - start_time
        print(f"💥 [{request_id}] UNEXPECTED ERROR after {total_time:.3f}s: {e}")
        print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
        
        auth_audit_logger.log_auth_event(
            "login_failed", 
            email if 'email' in locals() else None, 
            False, 
            request,
            {"reason": "unexpected_error", "error": str(e)}
        )
        
        raise HTTPException(status_code=500, detail="Internal server error")

# /auth/register endpoint moved to backend/routers/auth.py
    """
    User registration endpoint for self-service signup
    Creates new user account with password policy validation
    """
    import time
    import traceback

    from backend.utils.auth_security import (
        auth_audit_logger, 
        session_manager,
        password_policy
    )
    
    start_time = time.time()
    request_id = f"register_{int(time.time())}_{hash(str(payload)) % 1000}"
    
    try:
        print(f"🚀 [{request_id}] Registration attempt started")
        print(f"📧 [{request_id}] Email: {payload.email}")
        print(f"👤 [{request_id}] Name: {payload.name}")
        print(f"🌐 [{request_id}] Origin: {request.headers.get('origin', 'unknown')}")
        
        # ===================== Input Validation =====================
        email = payload.email.strip().lower()
        password = payload.password
        name = payload.name.strip()
        
        # Password policy validation is handled by Pydantic schema
        print(f"📝 [{request_id}] Input validation passed")
        
        # ===================== Database Connection Test =====================
        print(f"🗄️ [{request_id}] Testing database connection...")
        try:
            db = next(get_db())
            print(f"✅ [{request_id}] Database connection successful")
        except OperationalError as e:
            print(f"❌ [{request_id}] Database connection failed (OperationalError): {e}")
            auth_audit_logger.log_auth_event(
                "register_failed", 
                email, 
                False, 
                request,
                {"reason": "database_unavailable", "error": str(e)}
            )
            raise HTTPException(status_code=503, detail="Service temporarily unavailable")
        except Exception as e:
            print(f"❌ [{request_id}] Database connection failed (other): {e}")
            auth_audit_logger.log_auth_event(
                "register_failed", 
                email, 
                False, 
                request,
                {"reason": "database_error", "error": str(e)}
            )
            raise HTTPException(status_code=500, detail="Internal server error")
        
        # ===================== User Creation =====================
        try:
            with db:
                print(f"🔍 [{request_id}] Starting user creation...")
                
                # Check if user already exists
                existing_user = db.query(User).filter(User.email == email).first()
                if existing_user:
                    auth_audit_logger.log_auth_event(
                        "register_failed", 
                        email, 
                        False, 
                        request,
                        {"reason": "email_already_exists"}
                    )
                    raise HTTPException(
                        status_code=400, 
                        detail="An account with this email already exists"
                    )
                
                # Create new user
                user = User(
                    id=f"u_{int(datetime.now(timezone.utc).timestamp())}",
                    email=email,
                    name=name,
                    is_admin_global=False,  # New users are not admin by default
                    email_verified_at=None,  # Will be verified later
                    created_at=datetime.now(timezone.utc)
                )
                
                db.add(user)
                db.flush()  # Get the user ID
                print(f"👤 [{request_id}] User created with ID: {user.id}")
                
                # Create user auth record
                import bcrypt
                salt = bcrypt.gensalt()
                hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
                
                user_auth = UserAuth(
                    id=f"ua_{int(datetime.now(timezone.utc).timestamp())}",
                    user_id=user.id,
                    provider='password',
                    pass_hash=hashed.decode('utf-8'),
                    created_at=datetime.now(timezone.utc)
                )
                
                db.add(user_auth)
                print(f"🔐 [{request_id}] UserAuth record created")
                
                # Check if admin promotion is needed
                admin_emails = os.getenv("ADMIN_EMAIL_ALLOWLIST", "").split(",")
                if email.strip() in [e.strip() for e in admin_emails]:
                    user.is_admin_global = True
                    db.add(user)
                    print(f"✅ [{request_id}] Auto-promoted {email} to global admin")
                
                # Commit all changes
                db.commit()
                print(f"💾 [{request_id}] Database commit successful")
                
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ [{request_id}] User creation failed: {e}")
            auth_audit_logger.log_auth_event(
                "register_failed", 
                email, 
                False, 
                request,
                {"reason": "user_creation_error", "error": str(e)}
            )
            raise HTTPException(status_code=500, detail="Failed to create user account")
        
        # ===================== Success Response =====================
        total_time = time.time() - start_time
        print(f"🎉 [{request_id}] Registration successful in {total_time:.3f}s for user {email}")
        
        # Log successful registration
        auth_audit_logger.log_auth_event(
            "register_success", 
            email, 
            True, 
            request,
            {"user_id": user.id, "registration_time": total_time}
        )
        
        # Build user claims
        claims = {
            "user_id": user.id,
            "email": user.email,
            "name": user.name,
            "is_admin_global": bool(user.is_admin_global),
            "email_verified": bool(user.email_verified_at),
            "memberships": [],  # New users have no workspace memberships yet
        }
        
        # Create response with secure session (auto-login)
        resp = Response(
            content=json.dumps({
                "ok": True, 
                "message": "Account created successfully! You are now logged in.",
                "user": claims
            }), 
            media_type="application/json"
        )
        
        # Create session and set cookie (auto-login)
        session_id = session_manager.create_session(claims, request)
        resp.set_cookie(
            "session_id", 
            session_id, 
            httponly=True, 
            secure=True, 
            samesite="lax",
            max_age=86400  # 24 hours
        )
        
        return resp
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch all other exceptions and log them
        total_time = time.time() - start_time
        print(f"💥 [{request_id}] UNEXPECTED ERROR after {total_time:.3f}s: {e}")
        print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
        
        auth_audit_logger.log_auth_event(
            "register_failed", 
            email if 'email' in locals() else None, 
            False, 
            request,
            {"reason": "unexpected_error", "error": str(e)}
        )
        
        raise HTTPException(status_code=500, detail="Internal server error")
    import time
    import traceback
    from backend.utils.rate_limiter import rate_limiter, require_rate_limit

    
    start_time = time.time()
    request_id = f"login_{int(time.time())}_{hash(str(payload)) % 1000}"
    
    try:
        print(f"🚀 [{request_id}] Login attempt started")
        print(f"📧 [{request_id}] Payload received: {payload}")
        print(f"🌐 [{request_id}] Origin: {request.headers.get('origin', 'unknown')}")
        print(f"🔍 [{request_id}] User-Agent: {request.headers.get('user-agent', 'unknown')}")
        
        # TEMPORANEO: Rate limiting commentato per debug
        # require_rate_limit(request, "auth")
        print(f"⏱️ [{request_id}] Rate limiting bypassed (debug mode)")
        
        email = (payload.get("email") or "").strip().lower()
        password = (payload.get("password") or "").encode("utf-8")
        
        print(f"📝 [{request_id}] Email: {email}, Password length: {len(password)}")
        
        if not email or not password:
            print(f"❌ [{request_id}] Missing email or password")
            raise HTTPException(status_code=400, detail="Missing email or password")
        
        # Test database connection
        print(f"🗄️ [{request_id}] Testing database connection...")
        try:
            db = next(get_db())
            print(f"✅ [{request_id}] Database connection successful")
        except OperationalError as e:
            print(f"❌ [{request_id}] Database connection failed (OperationalError): {e}")
            print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
            # DB non raggiungibile o handshake fallito - errore specifico
            raise HTTPException(status_code=503, detail="Database unavailable - connection failed")
        except Exception as e:
            print(f"❌ [{request_id}] Database connection failed (other): {e}")
            print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        # Anti-enumeration: same error message for both cases
        try:
            with db:
                print(f"🔍 [{request_id}] Starting database queries...")
                
                # Query User con timing e error handling
                query_start = time.time()
                try:
                    user = db.query(User).filter(User.email.ilike(email)).first()
                    query_time = time.time() - query_start
                    print(f"📊 [{request_id}] Query User took {query_time:.3f}s")
                    print(f"👤 [{request_id}] User found: {user.id if user else 'None'}")
                except OperationalError as e:
                    print(f"❌ [{request_id}] Query User failed (OperationalError): {e}")
                    print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
                    raise HTTPException(status_code=503, detail="Database unavailable - query failed")
                except Exception as e:
                    print(f"❌ [{request_id}] Query User failed (other): {e}")
                    print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
                    raise HTTPException(status_code=500, detail="User query failed")
                
                # Always check password to prevent timing attacks
                password_valid = False
                if user:
                    print(f"🔑 [{request_id}] User exists, checking password...")
                    
                    # Query UserAuth con timing e error handling
                    auth_start = time.time()
                    try:
                        ua = db.query(UserAuth).filter(UserAuth.user_id == user.id, UserAuth.provider == "password").first()
                        auth_time = time.time() - auth_start
                        print(f"🔑 [{request_id}] Query UserAuth took {auth_time:.3f}s")
                        print(f"🔐 [{request_id}] UserAuth found: {ua.id if ua else 'None'}")
                    except OperationalError as e:
                        print(f"❌ [{request_id}] Query UserAuth failed (OperationalError): {e}")
                        print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
                        raise HTTPException(status_code=503, detail="Database unavailable - query failed")
                    except Exception as e:
                        print(f"❌ [{request_id}] Query UserAuth failed (other): {e}")
                        print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
                        raise HTTPException(status_code=500, detail="UserAuth query failed")
                    
                    if ua and ua.pass_hash and bcrypt:
                        try:
                            # Password check con timing
                            pwd_start = time.time()
                            password_valid = bcrypt.checkpw(password, ua.pass_hash.encode("utf-8"))
                            pwd_time = time.time() - pwd_start
                            print(f"🔒 [{request_id}] Password check took {pwd_time:.3f}s")
                            print(f"✅ [{request_id}] Password valid: {password_valid}")
                        except Exception as e:
                            print(f"❌ [{request_id}] Password check error: {e}")
                            print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
                            password_valid = False
                    else:
                        print(f"⚠️ [{request_id}] UserAuth missing: ua={ua}, pass_hash={bool(ua.pass_hash) if ua else False}, bcrypt={bool(bcrypt)}")
                
                # Anti-enumeration: same error for invalid email or password
                if not user or not password_valid:
                    # Log failed attempt for security monitoring
                    client_ip = request.client.host
                    user_agent = request.headers.get("user-agent", "")
                    print(f"❌ [{request_id}] Failed login attempt - IP: {client_ip}, Email: {email}, UA: {user_agent}")
                    
                    raise HTTPException(
                        status_code=401, 
                        detail="Invalid email or password. Please try again."
                    )
                
                print(f"🎯 [{request_id}] Authentication successful, checking TOTP...")
                
                # Check if TOTP is required
                if user.totp_enabled:
                    print(f"🔐 [{request_id}] TOTP required for user {user.id}")
                    # Return TOTP challenge instead of creating session
                    return Response(
                        content=json.dumps({
                            "requires_totp": True,
                            "user_id": user.id,
                            "message": "TOTP code required"
                        }),
                        media_type="application/json"
                    )
                
                print(f"👑 [{request_id}] Checking admin promotion...")
                
                # Auto-promote to admin if email is in allowlist
                admin_emails = os.getenv("ADMIN_EMAIL_ALLOWLIST", "").split(",")
                if user.email.strip() in [e.strip() for e in admin_emails]:
                    if not user.is_admin_global:
                        user.is_admin_global = True
                        db.add(user)
                        print(f"✅ [{request_id}] Auto-promoted {user.email} to global admin")
                
                print(f"🏢 [{request_id}] Building workspace memberships...")
                
                # Build claims with workspace memberships - Query ottimizzata
                memberships = []
                wm_start = time.time()
                try:
                    # Query ottimizzata: usa first() invece di all() per evitare caricamento completo
                    wm = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
                    if wm:
                        memberships.append({
                            "workspace_id": wm.workspace_id,
                            "role": wm.role
                        })
                    wm_time = time.time() - wm_start
                    print(f"🏢 [{request_id}] WorkspaceMember query took {wm_time:.3f}s")
                    print(f"🏢 [{request_id}] Memberships: {memberships}")
                except OperationalError as e:
                    print(f"❌ [{request_id}] WorkspaceMember query failed (OperationalError): {e}")
                    print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
                    # Non bloccare il login per questo errore
                    memberships = []
                except Exception as e:
                    print(f"❌ [{request_id}] WorkspaceMember query failed (other): {e}")
                    print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
                    # Non bloccare il login per questo errore
                    memberships = []
                
                claims = {
                    "user_id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "is_admin_global": bool(user.is_admin_global),
                    "email_verified": bool(user.email_verified_at),
                    "memberships": memberships,
                }
                
                print(f"💾 [{request_id}] Updating last login...")
                
                # Update last login - Unificato in un unico commit
                user.last_login_at = datetime.now(timezone.utc)
                db.add(user)
                
                # Commit unificato per evitare deadlock
                commit_start = time.time()
                try:
                    db.commit()
                    commit_time = time.time() - commit_start
                    print(f"💾 [{request_id}] Database commit took {commit_time:.3f}s")
                except OperationalError as e:
                    print(f"❌ [{request_id}] Database commit failed (OperationalError): {e}")
                    print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
                    raise HTTPException(status_code=503, detail="Database unavailable - commit failed")
                except Exception as e:
                    print(f"❌ [{request_id}] Database commit failed (other): {e}")
                    print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
                    raise HTTPException(status_code=500, detail="Database commit failed")
                
        except OperationalError as e:
            print(f"❌ [{request_id}] Database operation failed (OperationalError): {e}")
            print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
            raise HTTPException(status_code=503, detail="Database unavailable - operation failed")
        except Exception as e:
            print(f"❌ [{request_id}] Database operation failed (other): {e}")
            print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
            raise
        
        total_time = time.time() - start_time
        print(f"🎉 [{request_id}] Login successful in {total_time:.3f}s for user {email}")
        
        resp = Response(content=json.dumps({"ok": True, "user": claims}), media_type="application/json")
        _create_session(resp, claims)
        return resp
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch all other exceptions and log them
        total_time = time.time() - start_time
        print(f"💥 [{request_id}] UNEXPECTED ERROR after {total_time:.3f}s: {e}")
        print(f"🔍 [{request_id}] Stack trace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    



# Auth endpoints moved to backend/routers/auth.py


# /auth/logout endpoint moved to backend/routers/auth.py


# TOTP endpoints moved to backend/routers/auth.py
# @app.post("/auth/totp/verify")
# async def auth_totp_verify(payload: dict, request: Request) -> Response:
    # Function body removed - moved to backend/routers/auth.py
    pass

# ===================== Sprint 2 stubs =====================

@app.get("/leads")
def list_leads(
    request: Request,
    query: str | None = Query(default=None),
    limit: int = Query(default=25),
    offset: int = Query(default=0),
    sort: str | None = Query(default=None),
    compliance_category: str | None = Query(default=None),
    country_iso: str | None = Query(default=None),
) -> dict:
    # Check if demo mode is enabled
    is_demo = DEMO_MODE or request.headers.get("X-Demo") == "1"
    
    if is_demo:
        # Demo mode: return stub data
        items = [
            {
                "id": "l_101",
                "name": "Mario Rossi",
                "company": "Rossi Srl",
                "phone_e164": "+390212345678",
                "country_iso": "IT",
                "lang": "it-IT",
                "role": "supplier",
                "contact_class": "b2b",
                "relationship_basis": "existing",
                "opt_in": None,
                "national_dnc": "unknown",
                "compliance_category": "allowed",
                "compliance_reasons": ["B2B con relazione esistente"],
                "created_at": "2025-08-17T09:12:00Z"
            },
            {
                "id": "l_102",
                "name": "Claire Dubois",
                "company": "Dubois SA",
                "phone_e164": "+33123456789",
                "lang": "fr-FR",
                "role": "supplied",
                "contact_class": "b2c",
                "relationship_basis": "none",
                "opt_in": False,
                "national_dnc": "unknown",
                "compliance_category": "blocked",
                "compliance_reasons": ["B2C richiede opt-in ma stato sconosciuto"],
                "created_at": "2025-08-16T15:02:00Z"
            }
        ]
        
        # Apply filters to demo data
        if compliance_category:
            items = [item for item in items if item.get("compliance_category") == compliance_category]
        
        if country_iso:
            items = [item for item in items if item.get("country_iso") == country_iso.upper()]
        
        return {"total": len(items), "items": items}
    
    # Real mode: return empty array (or actual DB query when implemented)
    items = []
    
    # TODO: Replace with actual database query
    # Apply filters
    if compliance_category:
        items = [item for item in items if item.get("compliance_category") == compliance_category]
    
    if country_iso:
        items = [item for item in items if item.get("country_iso") == country_iso.upper()]
    
    return {"total": len(items), "items": items}


@app.post("/leads")
async def create_lead(payload: dict) -> dict:
    # TODO: Replace with actual database insert
    payload = dict(payload)
    payload["id"] = f"l_{int(datetime.now().timestamp())}"
    
    # Apply compliance classification if compliance engine is available
    if compliance_engine and payload.get("country_iso"):
        contact_data = {
            "contact_class": payload.get("contact_class", "unknown"),
            "relationship_basis": payload.get("relationship_basis", "unknown"),
            "opt_in": payload.get("opt_in"),
            "national_dnc": payload.get("national_dnc", "unknown")
        }
        
        category, reasons = compliance_engine.classify_contact(contact_data, payload["country_iso"])
        payload["compliance_category"] = category
        payload["compliance_reasons"] = reasons
    
    return payload


@app.put("/leads/{lead_id}")
async def update_lead(lead_id: str, payload: dict) -> dict:
    # TODO: Replace with actual database update
    payload["id"] = lead_id
    payload["updated_at"] = datetime.now().isoformat()
    
    # Reclassify if compliance fields changed
    if compliance_engine and payload.get("country_iso"):
        contact_data = {
            "contact_class": payload.get("contact_class", "unknown"),
            "relationship_basis": payload.get("relationship_basis", "unknown"),
            "opt_in": payload.get("opt_in"),
            "national_dnc": payload.get("national_dnc", "unknown")
        }
        
        category, reasons = compliance_engine.classify_contact(contact_data, payload["country_iso"])
        payload["compliance_category"] = category
        payload["compliance_reasons"] = reasons
    
    return payload


@app.post("/leads/bulk-update")
async def bulk_update_leads(payload: dict) -> dict:
    """Bulk update leads with compliance classification"""
    lead_ids = payload.get("lead_ids", [])
    updates = payload.get("updates", {})
    
    # TODO: Replace with actual database bulk update
    results = []
    
    for lead_id in lead_ids:
        result = {
            "id": lead_id,
            "status": "updated",
            "compliance_category": "unknown",
            "compliance_reasons": []
        }
        
        # Apply updates
        if compliance_engine and updates.get("country_iso"):
            contact_data = {
                "contact_class": updates.get("contact_class", "unknown"),
                "relationship_basis": updates.get("relationship_basis", "unknown"),
                "opt_in": updates.get("opt_in"),
                "national_dnc": updates.get("national_dnc", "unknown")
            }
            
            category, reasons = compliance_engine.classify_contact(contact_data, updates["country_iso"])
            result["compliance_category"] = category
            result["compliance_reasons"] = reasons
        
        results.append(result)
    
    return {"updated": len(results), "results": results}


@app.post("/compliance/classify")
async def classify_contact(payload: dict) -> dict:
    """Classify a single contact for compliance"""
    if not compliance_engine:
        raise HTTPException(status_code=500, detail="Compliance engine not available")
    
    contact_data = payload.get("contact", {})
    country_iso = payload.get("country_iso")
    
    if not country_iso:
        raise HTTPException(status_code=400, detail="country_iso is required")
    
    category, reasons = compliance_engine.classify_contact(contact_data, country_iso)
    
    return {
        "contact": contact_data,
        "country_iso": country_iso,
        "compliance_category": category,
        "compliance_reasons": reasons
    }


@app.post("/compliance/classify-bulk")
async def classify_contacts_bulk(payload: dict) -> dict:
    """Classify multiple contacts for compliance"""
    if not compliance_engine:
        raise HTTPException(status_code=500, detail="Compliance engine not available")
    
    contacts = payload.get("contacts", [])
    results = []
    
    for contact in contacts:
        country_iso = contact.get("country_iso")
        if country_iso:
            category, reasons = compliance_engine.classify_contact(contact, country_iso)
            results.append({
                "contact": contact,
                "compliance_category": category,
                "compliance_reasons": reasons
            })
        else:
            results.append({
                "contact": contact,
                "compliance_category": "unknown",
                "compliance_reasons": ["Country ISO missing"]
            })
    
    # Get summary
    summary = compliance_engine.get_compliance_summary(results)
    
    return {
        "results": results,
        "summary": summary
    }


@app.post("/dnc/check")
async def check_dnc(payload: dict) -> dict:
    """Check DNC status for a phone number"""
    try:
        from backend.dnc_service import dnc_service
    except ImportError as e:
        logger.warning(f"DNC service not available: {e}")
        raise HTTPException(status_code=500, detail="DNC service not available")
    except Exception as e:
        logger.error(f"Error loading DNC service: {e}")
        raise HTTPException(status_code=500, detail="DNC service not available")
    
    country_iso = payload.get("country_iso")
    e164 = payload.get("e164")
    
    if not country_iso or not e164:
        raise HTTPException(status_code=400, detail="country_iso and e164 are required")
    
    in_registry, proof_url = dnc_service.check_dnc(country_iso, e164)
    
    return {
        "country_iso": country_iso,
        "e164": e164,
        "in_registry": in_registry,
        "proof_url": proof_url,
        "supported": dnc_service.is_supported(country_iso)
    }


@app.get("/dnc/supported-countries")
async def get_dnc_supported_countries() -> dict:
    """Get list of countries with DNC support"""
    try:
        from backend.dnc_service import dnc_service
        countries = dnc_service.get_supported_countries()
        return {"countries": countries}
    except ImportError:
        return {"countries": []}


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


@app.get("/campaigns")
def list_campaigns(
    request: Request,
    workspace_id: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=500),
    offset: int = Query(0, ge=0),
    q: Optional[str] = None
) -> dict:
    wsid = workspace_id or get_workspace_id(request, fallback="ws_1")

    # logica dati (riusa le tue repo/ORM) - per ora stub
    # TODO: sostituire con repo_campaigns_list e repo_campaigns_count reali
    demo_campaigns = [
        {
            "id": "c_demo_1",
            "name": "Q4 Sales Campaign",
            "status": "active",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": "c_demo_2", 
            "name": "Product Launch IT",
            "status": "paused",
            "created_at": datetime.now(timezone.utc) - timedelta(days=7)
        },
        {
            "id": "c_demo_3",
            "name": "Customer Retention",
            "status": "draft",
            "created_at": datetime.now(timezone.utc) - timedelta(days=14)
        }
    ]
    
    # mappatura a schema (garantisci ISO date)
    def to_campaign(r) -> dict:
        return {
            "id": str(r["id"]),
            "name": r["name"],
            "status": r.get("status", "draft"),
            "created_at": (r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"])),
        }

    items = [to_campaign(r) for r in demo_campaigns]
    payload = adapt_list_response(items, len(items))
    # Adatta a response_model (Pydantic) mantenendo retro-compat
    return payload


@app.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str) -> dict:
    return {"id": campaign_id, "name": "Sample", "status": "active", "pacing_npm": 10, "budget_cap_cents": 15000, "window": {"quiet_hours": True}}


@app.patch("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, payload: dict) -> dict:
    # Validate status transitions
    allowed_statuses = {"draft", "active", "paused", "completed"}
    new_status = payload.get("status")
    
    if new_status and new_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}. Allowed: {', '.join(allowed_statuses)}")
    
    # TODO: Replace with actual database update
    # For now, return the updated campaign data
    return {
        "id": campaign_id,
        "status": new_status or "draft",
        "updated_at": datetime.now().isoformat(),
        "updated": True
    }


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


@app.post("/calendar/events")
async def create_calendar_event(payload: dict) -> dict:
    """Create a new calendar event (quick schedule)"""
    try:
        # Validate required fields
        required_fields = ["lead_id", "agent_id", "at"]
        for field in required_fields:
            if not payload.get(field):
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # TODO: Replace with actual database insert
        event_id = f"evt_{int(datetime.now().timestamp())}"
        
        return {
            "id": event_id,
            "kind": "scheduled",
            "title": payload.get("title", "Scheduled call"),
            "at": payload["at"],
            "lead_id": payload["lead_id"],
            "agent_id": payload["agent_id"],
            "kb_id": payload.get("kb_id"),
            "from": payload.get("from"),
            "created_at": datetime.now().isoformat(),
            "status": "scheduled"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {str(e)}")


@app.get("/numbers")
def list_numbers(
    request: Request,
    query: str | None = Query(default=None),
    limit: int = Query(default=25),
    offset: int = Query(default=0),
    country_iso: str | None = Query(default=None),
    provider: str | None = Query(default=None),
    capabilities: str | None = Query(default=None),
) -> dict:
    # Check if demo mode is enabled
    is_demo = DEMO_MODE or request.headers.get("X-Demo") == "1"
    
    if is_demo:
        # Demo mode: return stub data
        items = [
            {
                "id": "n_101",
                "e164": "+390212345678",
                "country_iso": "IT",
                "provider": "Telecom Italia",
                "capabilities": ["voice", "sms"],
                "created_at": "2025-08-17T09:12:00Z"
            },
            {
                "id": "n_102",
                "e164": "+33123456789",
                "country_iso": "FR",
                "provider": "Orange",
                "capabilities": ["voice", "sms", "mms"],
                "created_at": "2025-08-16T15:02:00Z"
            }
        ]
        
        # Apply filters to demo data
        if country_iso:
            items = [item for item in items if item.get("country_iso") == country_iso.upper()]
        
        if provider:
            items = [item for item in items if provider.lower() in item.get("provider", "").lower()]
        
        if capabilities:
            cap_list = [c.strip() for c in capabilities.split(",")]
            items = [item for item in items if any(cap in item.get("capabilities", []) for cap in cap_list)]
        
        return {"total": len(items), "items": items}
    
    # Real mode: return empty array (or actual DB query when implemented)
    items = []
    
    # TODO: Replace with actual database query
    # Apply filters
    if country_iso:
        items = [item for item in items if item.get("country_iso") == country_iso.upper()]
    
    if provider:
        items = [item for item in items if provider.lower() in item.get("provider", "").lower()]
    
    if capabilities:
        cap_list = [c.strip() for c in capabilities.split(",")]
        items = [item for item in items if any(cap in item.get("capabilities", []) for cap in cap_list)]
    
    return {"total": len(items), "items": items}


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
def legacy_analytics_overview():
    # 410 GONE con hint chiaro per evitare doppi codici
    raise HTTPException(
        status_code=410,
        detail={"code":"DEPRECATED","message":"Use /metrics/overview instead"}
    )


@app.get("/analytics/export.json")
def legacy_analytics_export_json():
    raise HTTPException(status_code=410, detail={"code":"DEPRECATED","message":"Use /metrics/*"})


@app.get("/analytics/export.csv")
def legacy_analytics_export_csv():
    raise HTTPException(status_code=410, detail={"code":"DEPRECATED","message":"Use /metrics/*"})


@app.get("/history")
def history_list(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort: str = Query("-created_at"),
    q: str | None = Query(default=None),
    campaign_id: str | None = Query(default=None),
    next_step: str | None = Query(default=None),
    score_min: int | None = Query(default=None),
    score_max: int | None = Query(default=None),
    country: str | None = Query(default=None),
    lang: str | None = Query(default=None),
    agent_id: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
) -> dict:
    """List call history with pagination, filtering and sorting"""
    
    # In DEMO_MODE, generate mock data
    if DEMO_MODE:
        # Generate deterministic mock data based on parameters
        seed = hash(f"history:{page}:{page_size}:{sort}:{q}:{campaign_id}:{next_step}:{score_min}:{score_max}:{country}:{lang}:{agent_id}:{date_from}:{date_to}")
        random.seed(seed)
        
        # Generate mock items
        items = []
        for i in range(page_size):
            item_id = f"call_{random.randint(1000, 9999)}"
            score = random.randint(0, 100)
            next_step = random.choice(["callback", "email", "meeting", "qualified", "disqualified"])
            outcome = "qualified" if next_step in ["callback", "email", "meeting"] else "reached"
            sentiment = round(random.uniform(-1, 1), 2)
            
            items.append({
                "id": item_id,
                "campaign_name": f"Campaign {random.choice(['A', 'B', 'C'])}",
                "outcome": outcome,
                "score": score,
                "next_step": next_step,
                "sentiment": sentiment,
                "created_at": (datetime.now() - timedelta(days=random.randint(0, 30))).isoformat(),
                "duration_sec": random.randint(30, 600),
                "cost_cents": random.randint(50, 5000)
            })
        
        # Apply sorting
        reverse = sort.startswith("-")
        key = sort.lstrip("-")
        items.sort(key=lambda x: x.get(key, "created_at"), reverse=reverse)
        
        # Simulate total count
        total = random.randint(100, 1000)
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    
    # TODO: Implement real database query when not in DEMO_MODE
    # This would use SQLAlchemy to query the calls table with proper filtering
    # For now, return empty result
    return {
        "items": [],
        "total": 0,
        "page": page,
        "page_size": page_size,
    }


@app.get("/history/{call_id}/brief")
def history_brief(call_id: str) -> dict:
    return {
        "id": call_id,
        "ts": "2025-08-17T09:22:00Z",
        "header": {"phone": "+390212345678", "company": "Unknown Company", "lang": "it-IT", "agent": "it-outbound-a", "outcome": "qualified"},
        "last_turns": [{"role": "agent", "text": "Hello"}, {"role": "user", "text": "Hi"}],
        "summary": {"bullets": ["Qualified lead", "Requested callback next week"]},
        "cost": {"total_eur": 0.42, "minutes": 3.5},
    }


@app.get("/history/export.csv")
def history_export_csv(
    locale: str | None = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort: str = Query("-created_at"),
    q: str | None = Query(default=None),
    campaign_id: str | None = Query(default=None),
    next_step: str | None = Query(default=None),
    score_min: int | None = Query(default=None),
    score_max: int | None = Query(default=None),
    country: str | None = Query(default=None),
    lang: str | None = Query(default=None),
    agent_id: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
) -> Response:
    """Export call history as CSV with same filters as list endpoint"""
    
    # Get data using the same logic as list endpoint
    data = history_list(
        request=Request(scope={"type": "http", "method": "GET"}),
        page=page,
        page_size=page_size,
        sort=sort,
        q=q,
        campaign_id=campaign_id,
        next_step=next_step,
        score_min=score_min,
        score_max=score_max,
        country=country,
        lang=lang,
        agent_id=agent_id,
        date_from=date_from,
        date_to=date_to,
    )
    
    # CSV headers based on locale
    head_map = {
        "en-US": ["id","campaign","outcome","score","next_step","sentiment","created_at","duration_sec","cost_cents"],
        "it-IT": ["id","campagna","esito","punteggio","prossimo_passo","sentiment","creato","durata_sec","costo_centesimi"],
        "fr-FR": ["id","campagne","résultat","score","prochaine_étape","sentiment","créé","durée_sec","coût_centimes"],
        "hi-IN": ["id","अभियान","परिणाम","स्कोर","अगला_कदम","भावना","बनाया_गया","अवधि_सेक","लागत_सेंट"],
        "ar-EG": ["id","حملة","نتيجة","نتيجة","الخطوة_التالي","مشاعر","تم_إنشاؤه","المدة_ث","التكلفة_سنت"],
    }
    headers = ",".join(head_map.get(locale or "en-US", head_map["en-US"])) + "\n"
    
    # Generate CSV rows
    csv_rows = []
    for item in data.get("items", []):
        row = [
            item.get("id", ""),
            item.get("campaign_name", ""),
            item.get("outcome", ""),
            str(item.get("score", "")),
            item.get("next_step", ""),
            str(item.get("sentiment", "")),
            item.get("created_at", ""),
            str(item.get("duration_sec", "")),
            str(item.get("cost_cents", ""))
        ]
        csv_rows.append(",".join(row))
    
    csv_content = headers + "\n".join(csv_rows)
    
    return Response(
        content=csv_content, 
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=history.csv"}
    )


# ===================== Compliance & Call Settings =====================

# Import compliance engine
try:
    from backend.services.compliance_engine import compliance_engine
    logger.info("Compliance engine loaded successfully")
except ImportError as e:
    logger.warning(f"Compliance engine not available: {e}")
    compliance_engine = None
except Exception as e:
    logger.error(f"Error loading compliance engine: {e}")
    compliance_engine = None

@app.post("/compliance/preflight")
async def compliance_preflight(payload: dict) -> dict:
    items = payload.get("items", [])
    out: list[dict] = []
    allow, delay, block = 0, 0, 0
    
    for it in items:
        e164 = it.get("e164", "")
        iso = (it.get("country_iso") or ("IT" if e164.startswith("+39") else "FR" if e164.startswith("+33") else "US")).upper()
        
        # Use new compliance engine if available
        if compliance_engine:
            contact_data = {
                "contact_class": it.get("contact_class", "unknown"),
                "relationship_basis": it.get("relationship_basis", "unknown"),
                "opt_in": it.get("opt_in"),
                "national_dnc": it.get("national_dnc", "unknown")
            }
            
            # Classify contact using compliance engine
            category, reasons = compliance_engine.classify_contact(contact_data, iso)
            
            # Map compliance category to preflight decision
            if category == "blocked":
                decision = "block"
            elif category == "conditional":
                decision = "allow"  # Allow but with warnings
            else:  # allowed
                decision = "allow"
        else:
            # Fallback to old logic
            fused = _COMPLIANCE.get("fused_by_iso", {}).get(iso) or {}
            flags = fused.get("flags") or {}
            reasons = []
            decision = "allow"
            
            # Consent rules
            if flags.get("requires_consent_b2c") and it.get("contact_class") == "b2c" and not it.get("has_consent"):
                decision = "block"
                reasons.append("CONSENT_REQUIRED_B2C")
            if flags.get("requires_consent_b2b") and it.get("contact_class") == "b2b" and not it.get("has_consent"):
                decision = "block"
                reasons.append("CONSENT_REQUIRED_B2B")
        
        # Common checks (quiet hours, DNC, etc.)
        fused = _COMPLIANCE.get("fused_by_iso", {}).get(iso) or {}
        flags = fused.get("flags") or {}
        quiet_hours = fused.get("quiet_hours")
        sched_str = it.get("schedule_at") or datetime.now(timezone.utc).isoformat()
        
        try:
            sched_dt = datetime.fromisoformat(str(sched_str).replace("Z", "+00:00"))
        except Exception:
            sched_dt = datetime.now(timezone.utc)

        # Quiet hours check → delay if outside allowed windows
        if flags.get("has_quiet_hours") and not _time_in_any_window(quiet_hours, sched_dt):
            decision = "delay"
            reasons.append("QUIET_HOURS")

        # DNC scrub requirement → block if explicit `dnc_hit` in request
        if flags.get("requires_dnc_scrub"):
            if it.get("dnc_hit") is True:
                decision = "block"
                reasons.append("DNC_HIT")
            else:
                reasons.append("DNC_REQUIRED")

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


@app.get("/workspaces/invites")
def ws_invites() -> dict:
    """Get all pending invites for the current workspace"""
    return {"items": _WORKSPACE_INVITES}


@app.post("/workspaces/members/invite")
@require_role("admin")
async def ws_invite(payload: dict, request: Request, db: Session = Depends(get_db)) -> dict:
    invite = {"id": f"inv_{len(_WORKSPACE_INVITES)+1}", "email": payload.get("email"), "role": payload.get("role","viewer"), "token": "demo-token", "invited_at": "2025-08-18T10:00:00Z"}
    _WORKSPACE_INVITES.append(invite)
    
    # Log audit event
    from backend.audit import log_event
    from backend.models import WorkspaceMember
    from backend.sessions import read_session_cookie, get_user_id
    
    try:
        session_id = read_session_cookie(request)
        if session_id:
            user_id = get_user_id(session_id)
            if user_id:
                workspace_member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user_id).first()
                workspace_id = workspace_member.workspace_id if workspace_member else "unknown"
                
                log_event(db, workspace_id=workspace_id, user_id=user_id, 
                         action="member.invite", resource_type="member", 
                         resource_id=invite["id"], request=request,
                         meta={"email": payload.get("email"), "role": payload.get("role","viewer")})
    except Exception:
        pass  # Don't fail the invite if audit logging fails
    
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
    items = []
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

# Magic link endpoints moved to backend/routers/auth.py
# @app.post("/auth/magic/request")
# async def auth_magic_request(payload: dict, request: Request, db: Session = Depends(get_db)) -> dict:
    # Function body removed - moved to backend/routers/auth.py
    pass


# @app.post("/auth/magic/verify")
# async def auth_magic_verify(payload: dict, db: Session = Depends(get_db)) -> dict:
    # Function body removed - moved to backend/routers/auth.py
    pass


# Microsoft OAuth spostato in backend/routers/auth.py per consistenza


# Microsoft OAuth callback spostato in backend/routers/auth.py per consistenza
# Microsoft OAuth callback spostato in backend/routers/auth.py per consistenza
    
    # Microsoft OAuth callback spostato in backend/routers/auth.py per consistenza


# @app.post("/auth/totp/setup")
# async def auth_totp_setup(request: Request, db: Session = Depends(get_db)) -> dict:
    # Function body removed - moved to backend/routers/auth.py
    pass


# @app.post("/auth/totp/verify")
# async def auth_totp_verify(payload: dict) -> dict:
    # Function body removed - moved to backend/routers/auth.py
    pass


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


# ===================== Settings Telephony Proxies =====================
# These endpoints provide a clean /settings/telephony/* interface that maps to existing /numbers/* endpoints

@app.get("/settings/telephony/numbers")
async def settings_list_numbers(
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """List phone numbers for the current workspace (proxy to /numbers)"""
    wsid = get_workspace_id(request, fallback="ws_1")
    
    # Reuse the same logic as /numbers endpoint
    rows = db.query(Number).filter(Number.workspace_id == wsid).all()
    items = [{
        "id": n.id, "e164": n.e164, "country_iso": n.country_iso, "source": n.source,
        "capabilities": n.capabilities or [], "verified": bool(n.verified), "provider": n.provider,
        "can_inbound": bool(n.can_inbound),
    } for n in rows]
    
    return {"items": items}


@app.post("/settings/telephony/retell/purchase")
async def settings_purchase_retell(
    payload: dict, 
    db: Session = Depends(get_db)
) -> dict:
    """Purchase phone number from Retell (proxy to /numbers/retell/provision)"""
    # Transform payload to match the expected format
    transformed_payload = {
        "country_iso": payload.get("country"),
        "type": payload.get("type", "geographic"),
        "capabilities": ["outbound", "inbound"] if payload.get("type") != "tollfree" else ["outbound"]
    }
    
    # Call the existing function
    return await numbers_retell_provision(transformed_payload, db)


@app.post("/settings/telephony/import")
async def settings_import_number(
    payload: dict, 
    db: Session = Depends(get_db)
) -> dict:
    """Import phone number (proxy to /numbers/byo)"""
    # Transform payload to match the expected format
    transformed_payload = {
        "e164": payload.get("e164"),
        "method": "voice"  # Default to voice verification
    }
    
    # Call the existing function
    return await numbers_byo(transformed_payload, db)


from pydantic import BaseModel
from backend.services.telephony import assert_e164, enforce_outbound_policy, validate_number_binding
from backend.services.telephony_providers import start_purchase, start_import, finalize_activate_number
from backend.services.crypto import enc, dec

from backend.services.coverage_service import get_countries, get_capabilities, get_pricing_twilio
from backend.services.twilio_coverage import build_twilio_snapshot, save_twilio_snapshot, load_twilio_snapshot

class BindPayload(BaseModel):
    number_id: str
    inbound_enabled: bool = False
    outbound_enabled: bool = False
    inbound_agent_id: str | None = None
    outbound_agent_id: str | None = None

@app.post("/settings/telephony/bind")
async def settings_bind_number(
    payload: BindPayload, 
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """Bind number to agent with policy enforcement"""
    # 1) Recupera numero e valida ownership
    wsid = get_workspace_id(request, fallback="ws_1")
    number = validate_number_binding(payload.number_id, wsid, db)
    
    # 2) Policy outbound
    if payload.outbound_enabled:
        enforce_outbound_policy(number)
    
    # 3) (opzionale) Validazioni E.164 su eventuali campi 'forward_to', ecc.
    # assert_e164(number.phone_e164)
    
    # 4) Persist - aggiorna i campi del numero
    number.inbound_enabled = payload.inbound_enabled
    number.outbound_enabled = payload.outbound_enabled
    number.inbound_agent_id = payload.inbound_agent_id
    number.outbound_agent_id = payload.outbound_agent_id
    
    db.add(number)
    db.commit()
    
    return {"ok": True, "number_id": number.id}


class VerifyCliPayload(BaseModel):
    number_id: str

@app.post("/settings/telephony/numbers/verify-cli")
def telephony_verify_cli(payload: VerifyCliPayload, db: Session = Depends(get_db), user=Depends(auth_guard)):
    # Rate limiting: max 5 requests per minute per user
    from backend.utils.rate_limiter import rate_limit
    rate_limit(f"verify_cli:{user.id}", max_requests=5, window_seconds=60)
    
    n = db.query(Number).filter(Number.id==payload.number_id, Number.workspace_id==user.workspace_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Number not found")

    # Idempotency: if already verified, return success
    if n.verified_cli:
        return {"ok": True, "verified_cli": True}

    # Qui puoi integrare provider reali (Twilio Outgoing Caller ID / Telnyx verify)
    # Per ora: segniamo verified_cli=True se BYO e provider ∈ {twilio, telnyx}
    if n.hosted:
        return {"ok": True, "verified_cli": True}

    if n.provider in ("twilio", "telnyx"):
        n.verified_cli = True
        n.last_updated_at = datetime.utcnow()
        db.add(n); db.commit()
        
        # Audit trail
        from backend.logger import logger
        logger.info(f"Number CLI verified", extra={
            "user_id": user.id,
            "number_id": n.id,
            "provider": n.provider,
            "phone_e164": n.phone_e164
        })
        
        return {"ok": True, "verified_cli": True}

    raise HTTPException(status_code=400, detail="Provider does not support CLI verification")


@app.get("/settings/telephony/agents")
async def settings_list_agents(
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """List available agents for telephony binding (stub)"""
    # TODO: Replace with actual agent lookup from your system
    # For now, return mock agents
    agents = [
        {"id": "agent_1", "name": "Sales Agent 1", "type": "sales"},
        {"id": "agent_2", "name": "Support Agent 1", "type": "support"},
        {"id": "agent_3", "name": "General Agent", "type": "general"}
    ]
    
    return {"agents": agents}

# ===================== Coverage & Requirements =====================

@app.get("/settings/telephony/countries")
async def countries(
    provider: str,
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """Get countries available for a specific provider"""
    if provider not in ["twilio", "telnyx"]:
        raise HTTPException(status_code=400, detail="Provider must be 'twilio' or 'telnyx'")
    
    wsid = get_workspace_id(request, fallback="ws_1")
    countries_data = await get_countries(provider, wsid, db)
    
    return {
        "provider": provider,
        "countries": [country.dict() for country in countries_data]
    }

@app.get("/settings/telephony/capabilities")
async def capabilities(
    provider: str,
    country: str,
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """Get capabilities for a specific provider/country combination"""
    if provider not in ["twilio", "telnyx"]:
        raise HTTPException(status_code=400, detail="Provider must be 'twilio' or 'telnyx'")
    
    wsid = get_workspace_id(request, fallback="ws_1")
    capabilities_data = await get_capabilities(provider, wsid, country, db)
    
    return {
        "provider": provider,
        "country": country,
        "capabilities": capabilities_data.dict()
    }

@app.get("/settings/telephony/pricing/twilio")
async def pricing(
    origin: str,
    destination: str,
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """Get Twilio pricing for a route (origin -> destination)"""
    wsid = get_workspace_id(request, fallback="ws_1")
    pricing_data = await get_pricing_twilio(wsid, origin, destination, db)
    
    return {
        "origin": origin,
        "destination": destination,
        "pricing": pricing_data.dict()
    }

# ===================== Telephony Provider Management =====================

@app.get("/settings/telephony/providers")
async def list_providers(
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """List telephony providers for the current workspace"""
    wsid = get_workspace_id(request, fallback="ws_1")
    rows = db.query(ProviderAccount).filter(ProviderAccount.workspace_id == wsid).all()
    return [{"id": r.id, "provider": r.provider.value, "label": r.label} for r in rows]

@app.post("/settings/telephony/providers")
async def upsert_provider(
    body: dict, 
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """Add or update a telephony provider account"""
    wsid = get_workspace_id(request, fallback="ws_1")
    provider = TelephonyProvider(body["provider"])
    
    acc = ProviderAccount(
        id=f"prov_{provider.value}_{wsid}",
        workspace_id=wsid,
        provider=provider,
        api_key_encrypted=enc(body["api_key"]),
        label=body.get("label")
    )
    
    db.merge(acc)
    db.commit()
    return {"ok": True}

@app.post("/settings/telephony/numbers/purchase")
async def purchase_number(
    body: dict, 
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """Purchase a new phone number from a provider"""
    # DEMO mode guard
    if os.getenv("DEMO_MODE") == "1":
        raise HTTPException(
            status_code=422, 
            detail={
                "error": "demo_mode",
                "message": "Number purchases are disabled in demo mode"
            }
        )
    
    # Rate limiting
    wsid = get_workspace_id(request, fallback="ws_1")
    telephony_rate_limiter.enforce_rate_limit(wsid, "purchase")
    
    # Idempotency check
    idempotency_key = request.headers.get("Idempotency-Key")
    if idempotency_key:
        existing_order = db.query(NumberOrder).filter_by(
            workspace_id=wsid,
            idempotency_key=idempotency_key
        ).first()
        if existing_order:
            return {"order_id": existing_order.id, "status": existing_order.status, "idempotent": True}
    
    # Estimate cost (fallback to 300 cents = $3.00)
    estimated_cost_cents = body.get("estimated_cost_cents", 300)
    
    # Atomic budget check with workspace lock
    try:
        workspace, budget_check = atomic_budget_check(
            db, wsid, estimated_cost_cents, idempotency_key, "number_purchase"
        )
        
        # If idempotent, return existing order info
        if budget_check.get("idempotent"):
            existing_order = db.query(NumberOrder).filter_by(
        workspace_id=wsid, 
                idempotency_key=idempotency_key
    ).first()
            if existing_order:
                return {
                    "order_id": existing_order.id, 
                    "status": existing_order.status,
                    "idempotent": True,
                    "cost_cents": existing_order.cost_cents if hasattr(existing_order, 'cost_cents') else estimated_cost_cents
                }
    except HTTPException as e:
        # Re-raise budget exceeded errors
        raise e
    
    # Compliance check
    try:
        ensure_compliance_or_raise(
            db, wsid, 
            body.get("provider", "twilio"), 
            body.get("country", "US"), 
            body.get("type", "local"), 
            body.get("entity_type", "business")
        )
    except HTTPException as e:
        if e.detail.get("error") == "compliance_required":
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "compliance_required",
                    "message": "Compliance requirements not met. Please complete KYC first.",
                    "requirements": e.detail.get("requirements", {})
                }
            )
        raise e
    
    # Provider account check
    acc = db.query(ProviderAccount).filter_by(
        workspace_id=wsid, 
        id=body["provider_account_id"]
    ).first()
    
    if not acc:
        raise HTTPException(400, "provider_account_not_found")
    
    # TODO: Implement actual purchase logic
    # For now, create a mock order
    order = NumberOrder(
        id=f"order_{int(datetime.utcnow().timestamp())}",
        workspace_id=wsid,
        provider=acc.provider,
        request=body,
        status="pending",
        idempotency_key=idempotency_key
    )
    
    db.add(order)
    db.commit()
    
    # Log the transaction in billing ledger (atomic)
    ledger_entry = atomic_ledger_write(
        db, wsid, estimated_cost_cents, 
        workspace.budget_currency or "USD",
        acc.provider, "number_purchase",
        metadata={
            "order_id": order.id,
            "number_type": body.get("type", "local"),
            "country": body.get("country"),
            "estimated": True
        },
        idempotency_key=idempotency_key
    )
    
    return {
        "order_id": order.id, 
        "status": order.status,
        "cost_cents": estimated_cost_cents,
        "threshold_hit": budget_check["threshold_hit"]
    }

@app.post("/settings/telephony/numbers/import")
async def import_number(
    body: dict, 
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """Import an existing phone number from a provider"""
    # DEMO mode guard
    if os.getenv("DEMO_MODE") == "1":
        raise HTTPException(
            status_code=422, 
            detail={
                "error": "demo_mode",
                "message": "Number imports are disabled in demo mode"
            }
        )
    
    # Rate limiting
    wsid = get_workspace_id(request, fallback="ws_1")
    telephony_rate_limiter.enforce_rate_limit(wsid, "import")
    
    # Idempotency check
    idempotency_key = request.headers.get("Idempotency-Key")
    if idempotency_key:
        existing_order = db.query(NumberOrder).filter_by(
            workspace_id=wsid,
            idempotency_key=idempotency_key
        ).first()
        if existing_order:
            return {"order_id": existing_order.id, "status": existing_order.status, "idempotent": True}
    
    # Estimate import cost (usually lower than purchase, fallback to 100 cents = $1.00)
    estimated_cost_cents = body.get("estimated_cost_cents", 100)
    
    # Atomic budget check with workspace lock
    try:
        workspace, budget_check = atomic_budget_check(
            db, wsid, estimated_cost_cents, idempotency_key, "number_import"
        )
        
        # If idempotent, return existing order info
        if budget_check.get("idempotent"):
            existing_order = db.query(NumberOrder).filter_by(
                workspace_id=wsid,
                idempotency_key=idempotency_key
            ).first()
            if existing_order:
                return {
                    "order_id": existing_order.id, 
                    "status": existing_order.status,
                    "idempotent": True,
                    "cost_cents": existing_order.cost_cents if hasattr(existing_order, 'cost_cents') else estimated_cost_cents
                }
    except HTTPException as e:
        # Re-raise budget exceeded errors
        raise e
    
    # Compliance check
    try:
        ensure_compliance_or_raise(
            db, wsid, 
            body.get("provider", "twilio"), 
            body.get("country", "US"), 
            body.get("type", "local"), 
            body.get("entity_type", "business")
        )
    except HTTPException as e:
        if e.detail.get("error") == "compliance_required":
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "compliance_required",
                    "message": "Compliance requirements not met. Please complete KYC first.",
                    "requirements": e.detail.get("requirements", {})
                }
            )
        raise e
    
    # Provider account check
    acc = db.query(ProviderAccount).filter_by(
        workspace_id=wsid, 
        id=body["provider_account_id"]
    ).first()
    
    if not acc:
        raise HTTPException(400, "provider_account_not_found")
    
    # TODO: Implement actual import logic
    # For now, create a mock order
    order = NumberOrder(
        id=f"import_{int(datetime.utcnow().timestamp())}",
        workspace_id=wsid,
        provider=acc.provider,
        request=body,
        status="pending",
        idempotency_key=idempotency_key
    )
    
    db.add(order)
    db.commit()
    
    # Log the transaction in billing ledger (atomic)
    ledger_entry = atomic_ledger_write(
        db, wsid, estimated_cost_cents, 
        workspace.budget_currency or "USD",
        acc.provider, "number_import_fee",
        metadata={
            "order_id": order.id,
            "e164": body.get("e164"),
            "estimated": True
        },
        idempotency_key=idempotency_key
    )
    
    return {
        "order_id": order.id, 
        "status": order.status,
        "cost_cents": estimated_cost_cents,
        "threshold_hit": budget_check["threshold_hit"]
    }

@app.get("/settings/telephony/orders")
async def list_orders(
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """List number orders for the current workspace"""
    wsid = get_workspace_id(request, fallback="ws_1")
    q = db.query(NumberOrder).filter_by(workspace_id=wsid).order_by(NumberOrder.created_at.desc())
    return [{
        "id": o.id,
        "status": o.status,
        "e164": o.result.get("e164") if o.result else None,
        "provider": o.provider.value
    } for o in q.all()]

# ===================== Telephony Coverage (Twilio) =====================
from fastapi import Header, HTTPException
from fastapi.responses import JSONResponse
from backend.services.coverage_cache import get as get_coverage_cache, set_mem as set_coverage_cache, save_disk, headers as cache_headers
from backend.services.twilio_coverage import build_twilio_snapshot
from backend.config.settings import settings

@app.get("/settings/telephony/coverage")
async def get_coverage(provider: str = Query(..., pattern="^(twilio|telnyx)$")):
    """Get coverage information for a specific provider with caching and age control"""
    # Prova cache prima
    cached_data = get_coverage_cache(provider)
    
    if cached_data:
        # Check if snapshot is too old
        if provider == "twilio" and not settings.ENABLE_TWILIO_LIVE_SEARCH:
            last_updated = cached_data.get("last_updated")
            if last_updated:
                from datetime import datetime, timedelta
                try:
                    snapshot_time = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
                    age_hours = (datetime.now(snapshot_time.tzinfo) - snapshot_time).total_seconds() / 3600
                    
                    if age_hours > settings.SNAPSHOT_MAX_AGE_HOURS:
                        return JSONResponse(
                            content={
                                "provider": provider,
                                "error": "snapshot_stale",
                                "message": f"Snapshot is {age_hours:.1f} hours old (max: {settings.SNAPSHOT_MAX_AGE_HOURS})",
                                "last_updated": last_updated,
                                "countries": cached_data.get("countries", [])
                            },
                            status_code=503
                        )
                except Exception:
                    pass  # Continue with cached data if parsing fails
        
        return JSONResponse(
            content=cached_data,
            headers=cache_headers(provider)
        )
    
    # Fallback per Twilio: prova a costruire soft solo se live search abilitato
    if provider == "twilio" and settings.ENABLE_TWILIO_LIVE_SEARCH:
        try:
            payload = build_twilio_snapshot()
            # Salva in cache e disco
            set_coverage_cache(provider, payload)
            save_disk(provider, payload)
            return JSONResponse(
                content=payload,
                headers=cache_headers(provider)
            )
        except Exception as e:
            import logging
            logging.error(f"Failed to build Twilio snapshot: {e}")
            # Ritorna fallback minimal
            fallback = {"provider": "twilio", "last_updated": None, "countries": [], "error": "degraded"}
            return JSONResponse(content=fallback)
    
    # Telnyx: carica da static/telephony
    from pathlib import Path
    p = Path(__file__).parent / "static" / "telephony" / "telnyx_coverage.json"
    if p.exists():
        try:
            import json
            data = json.loads(p.read_text("utf-8"))
            # Salva in cache
            set_coverage_cache(provider, data)
            return JSONResponse(
                content=data,
                headers=cache_headers(provider)
            )
        except Exception as e:
            import logging
            logging.error(f"Failed to load Telnyx coverage: {e}")
    
    # Fallback finale
    fallback = {"provider": provider, "countries": [], "error": "no_data"}
    return JSONResponse(content=fallback)

# ===================== Telephony Compliance (KYC) =====================
from backend.schemas_compliance import ComplianceRequirements, ComplianceCreate, ComplianceUploadAck, ComplianceSubmission
from backend.services.compliance_service import get_requirements, ensure_compliance_or_raise

from fastapi import UploadFile, File, Form
import os

@app.get("/settings/telephony/compliance/requirements", response_model=ComplianceRequirements)
def compliance_requirements(provider: str, country: str, number_type: str, entity_type: str):
    """Get compliance requirements for a specific provider/country/number_type/entity_type"""
    req = get_requirements(provider, country, number_type, entity_type) or {}
    return {
        "country": country, 
        "number_type": number_type, 
        "entity_type": entity_type, 
        "documents": req.get("documents", []),
        "notes": req.get("notes")
    }

@app.post("/settings/telephony/compliance/submissions", response_model=ComplianceSubmission)
def compliance_create(payload: ComplianceCreate, db: Session = Depends(get_db), user=Depends(auth_guard)):
    """Create a new compliance submission"""
    sub = RegulatorySubmission(
        workspace_id=user.workspace_id,
        provider=payload.provider.lower(),
        country=payload.country.upper(),
        number_type=payload.number_type.lower(),
        entity_type=payload.entity_type.lower(),
        required_fields=get_requirements(payload.provider, payload.country, payload.number_type, payload.entity_type),
        provided_fields=payload.provided_fields,
        status="draft",
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {
        "id": sub.id, 
        "status": sub.status,
        "provider": sub.provider,
        "country": sub.country,
        "number_type": sub.number_type,
        "entity_type": sub.entity_type,
        "required_fields": sub.required_fields,
        "provided_fields": sub.provided_fields,
        "files": sub.files or [],
        "notes": sub.notes,
        "created_at": sub.created_at.isoformat(),
        "updated_at": sub.updated_at.isoformat()
    }

@app.post("/settings/telephony/compliance/submissions/{sub_id}/files", response_model=ComplianceUploadAck)
def compliance_upload(
    sub_id: str, 
    kind: str = Form(...), 
    f: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    user=Depends(auth_guard)
):
    """Upload a compliance document file"""
    sub = db.query(RegulatorySubmission).filter_by(id=sub_id, workspace_id=user.workspace_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Create upload directory
    path = f"backend/static/uploads/regulatory/{user.workspace_id}/{sub_id}"
    os.makedirs(path, exist_ok=True)
    
    # Save file
    dst = os.path.join(path, f.filename)
    with open(dst, "wb") as out:
        out.write(f.file.read())
    
    # Update submission
    files = sub.files or []
    files.append({
        "name": f.filename, 
        "path": dst, 
        "mime": f.content_type, 
        "size": os.path.getsize(dst), 
        "kind": kind
    })
    sub.files = files
    sub.status = "submitted"
    db.commit()
    
    return {
        "file_name": f.filename, 
        "kind": kind, 
        "size": os.path.getsize(dst), 
        "mime": f.content_type
    }

# ===================== Telephony Portability =====================

@app.get("/settings/telephony/portability")
def portability(provider: str, country: str, number_type: str):
    """Check portability for a specific provider/country/number_type combination"""
    if provider.lower() == "telnyx":
        # Load from static Telnyx coverage
        from pathlib import Path
        p = Path(__file__).parent / "static" / "telephony" / "telnyx_coverage.json"
        if p.exists():
            try:
                import json
                data = json.loads(p.read_text("utf-8"))
                countries = data.get("countries", [])
                rec = next((c for c in countries if c.get("country", {}).get("alpha2") == country.upper()), None)
                if rec:
                    types = rec.get("types", {})
                    number_type_key = number_type.replace("_", " ").title()
                    portability = types.get(number_type_key, {}).get("Number Portability", False)
                    return {
                        "provider": provider,
                        "country": country,
                        "number_type": number_type,
                        "portability": bool(portability)
                    }
            except Exception as e:
                import logging
                logging.error(f"Failed to load Telnyx portability data: {e}")
    
    # Default: unknown portability
    return {
        "provider": provider,
        "country": country,
        "number_type": number_type,
        "portability": "unknown"
    }

# ===================== Inbound Webhooks & Routing Log =====================

@app.post("/webhooks/twilio/voice")
async def twilio_voice_webhook(payload: dict, request: Request, db: Session = Depends(get_db)):
    """Handle Twilio voice webhook events"""
    # Validate signature (implement proper validation)
    # For now, just log the event
    
    # Route the inbound call
    from backend.services.inbound_router import route_inbound
    route_result = route_inbound(db, 'twilio', payload)
    
    # Log the event (in production, save to database)
    import logging
    logging.info(f"Twilio voice webhook: {route_result}")
    
    return {"status": "received", "routing": route_result}

@app.post("/webhooks/telnyx/voice")
async def telnyx_voice_webhook(payload: dict, request: Request, db: Session = Depends(get_db)):
    """Handle Telnyx voice webhook events"""
    # Validate signature (implement proper validation)
    # For now, just log the event
    
    # Route the inbound call
    from backend.services.inbound_router import route_inbound
    route_result = route_inbound(db, 'telnyx', payload)
    
    # Log the event (in production, save to database)
    import logging
    logging.info(f"Telnyx voice webhook: {route_result}")
    
    return {"status": "received", "routing": route_result}

@app.post("/settings/telephony/coverage/rebuild")
async def rebuild_coverage(
    provider: str = Query(..., pattern="^twilio$"),
    x_cron_secret: str = Header(default="")
):
    """Rebuild coverage snapshot (admin only, cron protected)"""
    # Verifica secret per cron
    if settings.CRON_SECRET and x_cron_secret != settings.CRON_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")
    
    try:
        # Costruisci snapshot
        payload = build_twilio_snapshot()
        
        # Salva in cache e disco
        set_coverage_cache(provider, payload)
        save_disk(provider, payload)
        
        return {"ok": True, "updated": payload.get("last_updated")}
    except Exception as e:
        import logging
        logging.error(f"Failed to rebuild coverage: {e}")
        raise HTTPException(status_code=500, detail="rebuild_failed")

@app.get("/settings/telephony/inventory/search")
async def twilio_inventory_search(
    provider: str = Query(..., pattern="^twilio$"),
    country: str = Query(..., min_length=2, max_length=2),
    number_type: str = Query(..., pattern="^(local|mobile|toll_free)$"),
    area_code: str | None = Query(None),
    contains: str | None = Query(None),
    request: Request = None,
):
    """Ricerca live (Twilio) – l'inventario NON può essere staticizzato."""
    # Rate limiting
    if request:
        wsid = get_workspace_id(request, fallback="ws_1")
        telephony_rate_limiter.enforce_rate_limit(wsid, "inventory_search")
    """
    Ricerca live (Twilio) – l'inventario NON può essere staticizzato.
    """
    from backend.config.settings import settings
    from twilio.rest import Client as TwilioClient
    
    client = TwilioClient(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    # switch sui sub-resource
    fetcher = {
        "local": client.available_phone_numbers(country).local,
        "mobile": client.available_phone_numbers(country).mobile,
        "toll_free": client.available_phone_numbers(country).toll_free,
    }[number_type]
    
    params = {}
    if area_code: 
        params["area_code"] = area_code
    if contains:  
        params["contains"] = contains
    
    nums = fetcher.list(limit=25, **params)
    return [{
        "phone_number": n.phone_number,
        "friendly_name": getattr(n, "friendly_name", None),
        "region": getattr(n, "region", None),
        "iso_country": country,
        "capabilities": getattr(n, "capabilities", None)
    } for n in nums]

# ===================== Provider Webhooks =====================

@app.post("/webhooks/twilio")
async def twilio_webhook(
    payload: dict, 
    db: Session = Depends(get_db)
) -> dict:
    """Handle Twilio webhook events for number orders"""
    # TODO: Validate signature (X-Twilio-Signature) - omitted here
    ref = payload.get("orderSid") or payload.get("phoneNumberSid")
    order = db.query(NumberOrder).filter_by(provider_ref=ref).first()
    
    if not order:
        return {"ok": True}
    
    # If status is "active" or "completed"
    if payload.get("status") in ("active", "completed"):
        finalize_activate_number(db, order, hosted=True)  # CLI "hosted" by provider
    
    return {"ok": True}

@app.post("/webhooks/telnyx")
async def telnyx_webhook(
    payload: dict, 
    db: Session = Depends(get_db)
) -> dict:
    """Handle Telnyx webhook events for number orders"""
    # TODO: Validate signature (Telnyx-Signature) - omitted here
    ref = payload.get("record_type_id") or payload.get("order_id")
    order = db.query(NumberOrder).filter_by(provider_ref=ref).first()
    
    if order and payload.get("status") in ("active", "completed"):
        finalize_activate_number(db, order, hosted=True)
    
    return {"ok": True}

# ===================== Budget & Billing Management =====================

def get_current_workspace(request: Request, db: Session = Depends(get_db)):
    """Get current workspace from request or fallback to default"""
    workspace_id = get_workspace_id(request, fallback="ws_1")
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace

def require_workspace_admin(request: Request, db: Session = Depends(get_db)):
    """Require workspace admin permissions"""
    workspace = get_current_workspace(request, db)
    # TODO: Implement proper RBAC check
    # For now, allow all authenticated users
    return workspace

@app.get("/settings/billing/budget", response_model=BudgetState)
async def get_budget(
    current_ws: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """Get current budget state for workspace"""
    budget_state = get_workspace_budget_state(current_ws, db)
    return BudgetState(
        settings=BudgetSettings(
            monthly_budget_cents=budget_state["monthly_budget_cents"],
            budget_currency=budget_state["budget_currency"],
            budget_resets_day=budget_state["budget_resets_day"],
            budget_hard_stop=budget_state["budget_hard_stop"],
            budget_thresholds=budget_state["budget_thresholds"],
        ),
        spend_month_to_date_cents=budget_state["spend_month_to_date_cents"],
        blocked=budget_state["blocked"],
        threshold_hit=budget_state["threshold_hit"],
        billing_period=budget_state["billing_period"]
    )

@app.put("/settings/billing/budget", response_model=BudgetState)
async def update_budget(
    payload: BudgetUpdateRequest,
    current_ws: Workspace = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    # DEMO mode guard
    if os.getenv("DEMO_MODE") == "1":
        raise HTTPException(
            status_code=422, 
            detail={
                "error": "demo_mode",
                "message": "Budget updates are disabled in demo mode"
            }
        )
    """Update budget settings for workspace (admin only)"""
    # Update only provided fields
    if payload.monthly_budget_cents is not None:
        current_ws.monthly_budget_cents = payload.monthly_budget_cents
    if payload.budget_currency is not None:
        current_ws.budget_currency = payload.budget_currency
    if payload.budget_resets_day is not None:
        current_ws.budget_resets_day = payload.budget_resets_day
    if payload.budget_hard_stop is not None:
        current_ws.budget_hard_stop = payload.budget_hard_stop
    if payload.budget_thresholds is not None:
        current_ws.budget_thresholds = payload.budget_thresholds
    
    db.add(current_ws)
    db.commit()
    db.refresh(current_ws)
    
    # Return updated state
    budget_state = get_workspace_budget_state(current_ws, db)
    return BudgetState(
        settings=BudgetSettings(
            monthly_budget_cents=budget_state["monthly_budget_cents"],
            budget_currency=budget_state["budget_currency"],
            budget_resets_day=budget_state["budget_resets_day"],
            budget_hard_stop=budget_state["budget_hard_stop"],
            budget_thresholds=budget_state["budget_thresholds"],
        ),
        spend_month_to_date_cents=budget_state["spend_month_to_date_cents"],
        blocked=budget_state["blocked"],
        threshold_hit=budget_state["threshold_hit"],
        billing_period=budget_state["billing_period"]
    )

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

# Routers already included above after CORS configuration

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
            from backend.pdf_chromium import get_chromium_version
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
    workspace_id = get_workspace_id(request, required=True)
    
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
                    cast(KnowledgeBase.meta_json, String).ilike(f"%{q}%")
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
    payload: KnowledgeBaseCreate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Create a new knowledge base"""
    workspace_id = get_workspace_id(request, required=True)
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


# @app.get("/kb/{kb_id}")
# def get_knowledge_base(
#     request: Request,
#     kb_id: str,
#     _guard: None = Depends(require_role("viewer"))
# ) -> dict:
    """Get knowledge base details with sections and fields"""
    # Validate workspace ownership
    workspace_id = get_workspace_id(request, required=True)
    
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
        
        # Get sections
        sections = db.query(KbSection).filter(
            KbSection.kb_id == kb_id
        ).order_by(KbSection.order_index).all()
        
        # Get fields
        fields = db.query(KbField).filter(
            KbField.kb_id == kb_id
        ).all()
        
        # Get sources - FIXED: use proper join path through documents
        sources = (db.query(KbSource)
                  .join(KbDocument, KbDocument.source_id == KbSource.id)
                  .join(KbChunk, KbChunk.doc_id == KbDocument.id)
                  .filter(
                      KbSource.workspace_id == workspace_id,
                      KbChunk.kb_id == kb_id
                  )
                  .distinct()
                  .all())
        
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


# @app.patch("/kb/{kb_id}")
# def update_knowledge_base(
#     request: Request,
#     kb_id: str,
#             payload: dict,  # TODO: restore KnowledgeBaseUpdate when schema exists
#     if_match: str = Header(None, alias="If-Match"),
#     _guard: None = Depends(require_role("editor"))
# ) -> dict:
    """Update knowledge base metadata"""
    workspace_id = get_workspace_id(request, required=True)
    
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
            payload: ImportSourceRequest,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Start knowledge base import from source"""
    workspace_id = get_workspace_id(request, required=True)
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
    workspace_id = get_workspace_id(request, required=True)
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
    """Get import job status and progress with diff analysis"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        # Get diff analysis if job is in review state
        diff_analysis = None
        if job.status == "review" and job.progress_json:
            diff_analysis = _analyze_import_diff(db, job)
        
        return {
            "id": job.id,
            "status": job.status,
            "progress_pct": job.progress_pct,
            "estimated_cost_cents": job.estimated_cost_cents,
            "actual_cost_cents": job.actual_cost_cents,
            "error_message": job.error_message,
            "created_at": job.created_at,
            "completed_at": job.completed_at,
            "diff_analysis": diff_analysis
        }

def _analyze_import_diff(db, job):
    """Analyze differences between existing KB and imported data"""
    try:
        if not job.target_kb_id:
            return None
        
        # Get existing KB data
        existing_kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == job.target_kb_id).first()
        if not existing_kb:
            return None
        
        # Get existing fields
        existing_fields = db.query(KbField).filter(
            KbField.kb_id == job.target_kb_id,
            KbField.lang == "en-US"  # Default language
        ).all()
        
        # Get imported data from progress_json
        imported_data = job.progress_json.get("extracted_fields", {})
        
        # Analyze differences
        field_diffs = []
        for field_key, imported_value in imported_data.items():
            existing_field = next((f for f in existing_fields if f.key == field_key), None)
            
            if existing_field:
                if existing_field.value_text != imported_value:
                    field_diffs.append({
                        "field_key": field_key,
                        "field_id": existing_field.id,
                        "old_value": existing_field.value_text,
                        "new_value": imported_value,
                        "conflict_type": "update"
                    })
            else:
                field_diffs.append({
                    "field_key": field_key,
                    "field_id": None,
                    "old_value": None,
                    "new_value": imported_value,
                    "conflict_type": "new"
                })
        
        return {
            "kb_id": job.target_kb_id,
            "kb_name": existing_kb.name,
            "total_fields": len(existing_fields),
            "imported_fields": len(imported_data),
            "conflicts": len([d for d in field_diffs if d["conflict_type"] == "update"]),
            "new_fields": len([d for d in field_diffs if d["conflict_type"] == "new"]),
            "field_diffs": field_diffs
        }
        
    except Exception as e:
        logger.error(f"Failed to analyze import diff: {e}")
        return None


@app.post("/kb/assign")
def assign_knowledge_base(
    request: Request,
            payload: KbAssignmentCreate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Assign knowledge base to scope (number, campaign, agent, or workspace default)"""
    workspace_id = get_workspace_id(request, required=True)
    
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

@app.post("/kb/imports/{job_id}/merge")
def merge_import_changes(
    request: Request,
    job_id: str,
            merge_decisions: MergeDecisions,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Merge imported changes based on user decisions"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        if job.status != "review":
            raise HTTPException(status_code=400, detail="Import job not in review state")
        
        # Apply merge decisions
        applied_changes = _apply_merge_decisions(db, job, merge_decisions)
        
        # Update job status
        job.status = "completed"
        job.progress_json = {
            **job.progress_json,
            "merge_completed": True,
            "applied_changes": applied_changes,
            "merged_at": datetime.utcnow().isoformat()
        }
        
        db.commit()
        
        return {
            "success": True,
            "applied_changes": applied_changes,
            "message": "Import changes merged successfully"
        }

def _apply_merge_decisions(db, job, merge_decisions):
    """Apply user merge decisions to KB fields"""
    applied_changes = []
    
    try:
        for decision in merge_decisions.decisions:
            if decision.action == "keep_old":
                # Do nothing, keep existing value
                applied_changes.append({
                    "field_key": decision.field_key,
                    "action": "kept_old",
                    "value": "existing_value"
                })
                
            elif decision.action == "use_new":
                if decision.field_id:
                    # Update existing field
                    field = db.query(KbField).filter(KbField.id == decision.field_id).first()
                    if field:
                        old_value = field.value_text
                        field.value_text = decision.new_value
                        field.updated_at = datetime.utcnow()
                        
                        # Add to history
                        _add_field_history(db, field, "updated", old_value, decision.new_value, job.id)
                        
                        applied_changes.append({
                            "field_key": decision.field_key,
                            "action": "updated",
                            "old_value": old_value,
                            "new_value": decision.new_value
                        })
                else:
                    # Create new field
                    new_field = KbField(
                        id=f"field_{secrets.token_urlsafe(8)}",
                        kb_id=job.target_kb_id,
                        key=decision.field_key,
                        label=decision.field_key.replace("_", " ").title(),
                        value_text=decision.new_value,
                        lang="en-US",
                        source_id=job.source_id,
                        confidence=80
                    )
                    db.add(new_field)
                    
                    # Add to history
                    _add_field_history(db, new_field, "created", None, decision.new_value, job.id)
                    
                    applied_changes.append({
                        "field_key": decision.field_key,
                        "action": "created",
                        "new_value": decision.new_value
                    })
                    
            elif decision.action == "merge":
                # Merge old and new values
                if decision.field_id:
                    field = db.query(KbField).filter(KbField.id == decision.field_id).first()
                    if field:
                        old_value = field.value_text
                        merged_value = f"{old_value}\n\n--- Updated ---\n{decision.new_value}"
                        field.value_text = merged_value
                        field.updated_at = datetime.utcnow()
                        
                        # Add to history
                        _add_field_history(db, field, "merged", old_value, merged_value, job.id)
                        
                        applied_changes.append({
                            "field_key": decision.field_key,
                            "action": "merged",
                            "old_value": old_value,
                            "new_value": merged_value
                        })
        
        return applied_changes
        
    except Exception as e:
        logger.error(f"Failed to apply merge decisions: {e}")
        raise HTTPException(status_code=500, detail="Failed to apply merge decisions")

def _add_field_history(db, field, action, old_value, new_value, job_id):
    """Add field change to KB history"""
    try:
        history_entry = KbHistory(
            id=f"hist_{secrets.token_urlsafe(8)}",
            kb_id=field.kb_id,
            field_id=field.id,
            action=action,
            old_value=old_value,
            new_value=new_value,
            source="import_merge",
            metadata={"job_id": job_id}
        )
        db.add(history_entry)
    except Exception as e:
        logger.error(f"Failed to add field history: {e}")


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
    workspace_id = get_workspace_id(request, required=True)
    
    # Cache key for performance
    cache_key = f"kb_resolve:{workspace_id}:{campaign_id}:{number_id}:{agent_id}:{lang}"
    
    # TODO: Check Redis cache first
    # cached_result = redis_client.get(cache_key)
    # if cached_result:
    #     return json.loads(cached_result)
    
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
        
        # Get sections and fields with optimized queries
        sections = db.query(KbSection).filter(
            KbSection.kb_id == kb.id
        ).order_by(KbSection.order_index).all()
        
        fields = (db.query(KbField)
                 .filter(
                     KbField.kb_id == kb.id,
                     KbField.lang == lang
                 )
                 .limit(100)  # Limit fields for performance
                 .all())
        
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


@app.post("/kb/prompt-bricks")
def generate_prompt_bricks(
    request: Request,
            payload: PromptBricksRequest,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Generate prompt bricks (rules/style/voice/facts) from a resolved KB"""
    workspace_id = get_workspace_id(request, required=True)
    lang = payload.lang or "en-US"
    
    with next(get_db()) as db:
        # Resolve KB
        kb = None
        if payload.kb_id:
            kb = db.query(KnowledgeBase).filter(
                KnowledgeBase.id == payload.kb_id,
                KnowledgeBase.workspace_id == workspace_id,
                KnowledgeBase.status == "published"
            ).first()
        else:
            # Reuse the resolver logic with precedence
            assignment = None
            if payload.campaign_id:
                assignment = db.query(KbAssignment).filter(
                    KbAssignment.workspace_id == workspace_id,
                    KbAssignment.scope == "campaign",
                    KbAssignment.scope_id == payload.campaign_id
                ).first()
            if not assignment and payload.number_id:
                assignment = db.query(KbAssignment).filter(
                    KbAssignment.workspace_id == workspace_id,
                    KbAssignment.scope == "number",
                    KbAssignment.scope_id == payload.number_id
                ).first()
            if not assignment and payload.agent_id:
                assignment = db.query(KbAssignment).filter(
                    KbAssignment.workspace_id == workspace_id,
                    KbAssignment.scope == "agent",
                    KbAssignment.scope_id == payload.agent_id
                ).first()
            if not assignment:
                assignment = db.query(KbAssignment).filter(
                    KbAssignment.workspace_id == workspace_id,
                    KbAssignment.scope == "workspace_default"
                ).first()
            if not assignment:
                raise HTTPException(status_code=404, detail="No knowledge base assigned")
            kb = db.query(KnowledgeBase).filter(
                KnowledgeBase.id == assignment.kb_id,
                KnowledgeBase.status == "published"
            ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found or not published")
        
        # Collect fields relevant for prompt bricks
        fields = db.query(KbField).filter(
            KbField.kb_id == kb.id,
            KbField.lang == lang
        ).all()
        fields_map = {f.key: f for f in fields}
        
        # Build bricks using AI for better quality
        ai_client = get_ai_client()
        
        # Prepare context for AI
        context_text = _build_kb_context_for_ai(kb, fields_map, lang)
        
        # Generate prompt bricks using AI
        try:
            bricks_result = ai_client.run(
                task="prompt_generation",
                user=f"Generate prompt bricks for this company knowledge base: {context_text}",
                system="You are an expert at creating prompt bricks for sales and customer service. Generate concise, actionable rules and style guidelines.",
                mode="smart",
                budget=0.02
            )
            
            # Parse AI response
            ai_bricks = json.loads(bricks_result["content"])
            
            # Use AI-generated bricks if available
            rules = ai_bricks.get("rules", [])
            style = ai_bricks.get("style", [])
            system_prompt = ai_bricks.get("system", "")
            
        except Exception as e:
            print(f"AI prompt bricks generation failed: {e}, using fallback")
            # Fallback to rule-based generation
            rules, style, system_prompt = _generate_fallback_bricks(kb, fields_map, lang)
        
        # Build company facts and disclaimers
        company_facts = _extract_company_facts(fields_map)
        disclaimers = _extract_disclaimers(fields_map)
        
        # Get scripts
        opening = fields_map.get("script_opening").value_text if fields_map.get("script_opening") else None
        closing = fields_map.get("script_closing").value_text if fields_map.get("script_closing") else None
        
        # Track usage
        try:
            _track_prompt_bricks_usage(db, kb.id, "prompt_bricks", True, lang)
        except Exception as e:
            print(f"Failed to track usage: {e}")
        
        return {
            "kb_id": kb.id,
            "system": system_prompt,
            "rules": rules,
            "style": style,
            "company_facts": company_facts,
            "disclaimers": disclaimers,
            "opening_script": opening,
            "closing_script": closing,
            "generated_at": datetime.utcnow().isoformat()
        }

def _build_kb_context_for_ai(kb, fields_map: dict, lang: str) -> str:
    """Build context text for AI prompt bricks generation"""

    context_parts = []
    
    # Basic KB info
    context_parts.append(f"Company: {kb.name}")
    context_parts.append(f"Type: {kb.type or 'Not specified'}")
    context_parts.append(f"Language: {lang}")
    
    # Key fields
    key_fields = ["purpose", "vision", "icp", "brand_voice", "operating_areas"]
    for field_key in key_fields:
        if fields_map.get(field_key) and fields_map[field_key].value_text:
            context_parts.append(f"{field_key.title()}: {fields_map[field_key].value_text}")
    
    return "\n".join(context_parts)

def _generate_fallback_bricks(kb, fields_map: dict, lang: str) -> tuple:
    """Generate fallback prompt bricks without AI"""

    rules = []
    style = []
    
    # Basic rules
    rules.append("Always be professional and courteous")
    rules.append("Use the company's brand voice consistently")
    rules.append("Provide accurate information based on company knowledge")
    
    # Style guidelines
    if fields_map.get("brand_voice") and fields_map["brand_voice"].value_json:
        voice = fields_map["brand_voice"].value_json
        style.extend([f"Do: {v}" for v in (voice.get("dos") or [])])
        style.extend([f"Don't: {v}" for v in (voice.get("donts") or [])])
    
    # System prompt
    if kb.kind == "company":
        system_prompt = "You represent the company professionally. Follow brand guidelines and company policies."
    elif kb.kind == "offer_pack":
        system_prompt = "You promote the offer pack persuasively but accurately. Follow provided scripts and guidelines."
    else:
        system_prompt = "You provide information based on the knowledge base. Be helpful and accurate."
    
    return rules, style, system_prompt

def _extract_company_facts(fields_map: dict) -> list:
    """Extract company facts from fields"""
    facts = []
    
    # Purpose/vision
    if fields_map.get("purpose") and fields_map["purpose"].value_text:
        facts.append(f"Purpose: {fields_map['purpose'].value_text}")
    if fields_map.get("vision") and fields_map["vision"].value_text:
        facts.append(f"Vision: {fields_map['vision'].value_text}")
    
    # ICP
    if fields_map.get("icp") and fields_map["icp"].value_text:
        facts.append(f"ICP: {fields_map['icp'].value_text}")
    
    # Contacts
    for key in ["phone", "email", "website"]:
        if fields_map.get(key) and fields_map[key].value_text:
            facts.append(f"{key.title()}: {fields_map[key].value_text}")
    
    return facts

def _extract_disclaimers(fields_map: dict) -> list:
    """Extract disclaimers from fields"""
    disclaimers = []
    
    # Policies and legal
    for key in ["policies", "legal"]:
        if fields_map.get(key) and fields_map[key].value_text:
            disclaimers.append(fields_map[key].value_text)
    
    return disclaimers

def _track_prompt_bricks_usage(db: Session, kb_id: str, kind: str, success: bool, lang: str):
    """Track prompt bricks usage for analytics"""

    try:
        usage = KbUsage(
            id=f"usage_{secrets.token_urlsafe(8)}",
            workspace_id="ws_1",  # TODO: Get from context
            kb_id=kb_id,
            kind=kind,
            context={"lang": lang},
            success=success,
            tokens_used=0,  # TODO: Get from AI response
            cost_micros=0   # TODO: Get from AI response
        )
        db.add(usage)
        db.commit()
    except Exception as e:
        print(f"Failed to track usage: {e}")
        db.rollback()

@app.get("/kb/progress")
async def get_kb_progress(
    request: Request,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get progress overview for all KBs in workspace"""
    # 1) workspace_id tollerante
    workspace_id = get_workspace_id(request, fallback="ws_1")

    # 2) DEMO: risposte sintetiche ma consistenti
    if DEMO_MODE:
        demo_items = [
            {
                "kb_id": "kb_demo_company", 
                "name": "Company Profile", 
                "kind": "company",
                "completeness_pct": 0.82, 
                "freshness_score": 0.74,
                "sections_count": 5,
                "fields_count": 12,
                "last_updated": datetime.now(timezone.utc)
            },
            {
                "kb_id": "kb_demo_offers", 
                "name": "Offer Packs", 
                "kind": "offers",
                "completeness_pct": 0.67, 
                "freshness_score": 0.59,
                "sections_count": 3,
                "fields_count": 8,
                "last_updated": datetime.now(timezone.utc)
            },
            {
                "kb_id": "kb_demo_docs", 
                "name": "Documents", 
                "kind": "documents",
                "completeness_pct": 0.41, 
                "freshness_score": 0.36,
                "sections_count": 2,
                "fields_count": 6,
                "last_updated": datetime.now(timezone.utc)
            },
        ]
        return {"items": demo_items}

    # 3) PRODUZIONE: se manca workspace_id ma non vogliamo bloccare, ritorna empty, non 422
    if not workspace_id:
        return {"items": []}

    # 4) logica reale (mantieni la tua esistente)
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
        
        return {"items": progress}


# ===================== Knowledge Base Sections & Fields =====================

@app.post("/kb/{kb_id}/sections")
def create_kb_section(
    request: Request,
    kb_id: str,
            payload: KbSectionCreate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Create a new section in knowledge base"""
    workspace_id = get_workspace_id(request, required=True)
    
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
            payload: KbSectionUpdate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Update a knowledge base section"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Verify section exists and belongs to workspace
        section = db.query(KbSection).join(KnowledgeBase).filter(
            KbSection.id == section_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not section:
            raise HTTPException(
                status_code=404, 
                detail=_create_error_response(
                    "SECTION_NOT_FOUND",
                    "Section not found",
                    {"section_id": section_id, "workspace_id": workspace_id},
                    "Verify the section ID and ensure it belongs to your workspace"
                )
            )
        
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
        _recalculate_kb_metrics(db, section.kb_id)
        
        # Audit trail
        _audit_kb_change(db, section.kb_id, "u_1", "update_section", {
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
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Verify section exists and belongs to workspace
        section = db.query(KbSection).join(KnowledgeBase).filter(
            KbSection.id == section_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not section:
            raise HTTPException(
                status_code=404, 
                detail=_create_error_response(
                    "SECTION_NOT_FOUND",
                    "Section not found",
                    {"section_id": section_id, "workspace_id": workspace_id},
                    "Verify the section ID and ensure it belongs to your workspace"
                )
            )
        
        # Delete associated fields first
        db.query(KbField).filter(KbField.section_id == section_id).delete()
        
        # Delete section
        db.delete(section)
        db.commit()
        
        # Recalculate KB metrics
        _recalculate_kb_metrics(db, section.kb_id)
        
        # Audit trail
        _audit_kb_change(db, section.kb_id, "u_1", "delete_section", {
            "section_id": section_id,
            "section_key": section.key
        })
        
        return {"id": section_id, "status": "deleted"}


@app.post("/kb/{kb_id}/fields")
def create_kb_field(
    request: Request,
    kb_id: str,
            payload: KbFieldCreate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Create a new field in knowledge base"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Verify KB exists and belongs to workspace
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
        
        # Verify section exists if specified
        if payload.section_id:
            section = db.query(KbSection).filter(
                KbSection.id == payload.section_id,
                KbSection.kb_id == kb_id
            ).first()
            if not section:
                raise HTTPException(
                    status_code=404, 
                    detail=_create_error_response(
                        "SECTION_NOT_FOUND",
                        "Section not found",
                        {"section_id": payload.section_id, "kb_id": kb_id},
                        "Verify the section ID and ensure it belongs to the specified KB"
                    )
                )
        
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
            payload: KbFieldUpdate,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Update a knowledge base field"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Verify field exists and belongs to workspace
        field = db.query(KbField).join(KnowledgeBase).filter(
            KbField.id == field_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not field:
            raise HTTPException(
                status_code=404, 
                detail=_create_error_response(
                    "FIELD_NOT_FOUND",
                    "Field not found",
                    {"field_id": field_id, "workspace_id": workspace_id},
                    "Verify the field ID and ensure it belongs to your workspace"
                )
            )
        
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
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Verify field exists and belongs to workspace
        field = db.query(KbField).join(KnowledgeBase).filter(
            KbField.id == field_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not field:
            raise HTTPException(
                status_code=404, 
                detail=_create_error_response(
                    "FIELD_NOT_FOUND",
                    "Field not found",
                    {"field_id": field_id, "workspace_id": workspace_id},
                    "Verify the field ID and ensure it belongs to your workspace"
                )
            )
        
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
    from backend.ai_client import KB_TEMPLATES
    
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
            payload: ImportMappingRequest,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Update field mappings for import job"""
    workspace_id = get_workspace_id(request, required=True)
    
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




def commit_csv_import(db, job, payload):
    """Commit CSV import with field mappings"""
    try:
        # Get the mapping and data from job progress
        mapping = job.progress_json.get("mapping", {})
        headers = job.progress_json.get("headers", [])
        preview = job.progress_json.get("preview", [])
        total_rows = job.progress_json.get("total_rows", 0)
        
        # Create KB fields based on mapping
        fields_created = 0
        
        for row_data in preview:
            # Create a field for each mapped column
            for kb_field, csv_header in mapping.items():
                if csv_header and csv_header in headers:
                    # Find the value for this header in the row
                    header_index = headers.index(csv_header)
                    if header_index < len(row_data):
                        value = row_data[header_index]
                        
                        # Create KB field
                        field = KbField(
                            id=f"field_{job.id}_{kb_field}_{fields_created}",
                            kb_id=job.target_kb_id,
                            key=kb_field,
                            label=kb_field.replace("_", " ").title(),
                            value_text=value,
                            lang="en-US",  # Default language
                            source_id=job.source_id,
                            confidence=90  # High confidence for CSV
                        )
                        db.add(field)
                        fields_created += 1
        
        # Update source status
        source = db.query(KbSource).filter(KbSource.id == job.source_id).first()
        if source:
            source.status = "completed"
        
        db.commit()
        
        return {
            "type": "csv",
            "rows_processed": total_rows,
            "fields_created": fields_created,
            "mapping_applied": mapping
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

def commit_extracted_import(db, job, payload):
    """Commit extracted import (file/URL)"""
    # Get all chunks for this job
    chunks = db.query(KbChunk).filter(
        KbChunk.source_id == job.source_id
    ).all()
    
    # Get all extracted fields
    fields = db.query(KbField).filter(
        KbField.source_id == job.source_id
    ).all()
    
    return {
        "type": "extracted",
        "chunks_processed": len(chunks),
        "fields_extracted": len(fields),
        "total_tokens": sum(chunk.tokens or 0 for chunk in chunks)
    }


@app.get("/kb/assignments")
def list_kb_assignments(
    request: Request,
    scope: str = Query(None, description="Filter by scope"),
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """List knowledge base assignments for workspace"""
    workspace_id = get_workspace_id(request, required=True)
    
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
    workspace_id = get_workspace_id(request, required=True)
    
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





@app.post("/kb/imports/{job_id}/retry")
def retry_import_job(
    request: Request,
    job_id: str,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Retry a failed import job"""
    workspace_id = get_workspace_id(request, required=True)
    
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
    payload: ImportReviewRequest,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Commit and apply import job changes"""
    workspace_id = get_workspace_id(request, required=True)
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
                raise HTTPException(
                    status_code=404, 
                    detail=_create_error_response(
                        "TARGET_KB_NOT_FOUND",
                        "Target KB not found",
                        {"target_kb_id": job.target_kb_id, "workspace_id": workspace_id},
                        "Verify the target KB ID and ensure it belongs to your workspace"
                    )
                )
            
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
        
        # If no target KB, just mark job as committed
        job.status = "committed"
        job.completed_at = datetime.utcnow()
        db.commit()
        
        return {
            "job_id": job_id, 
            "status": "committed",
            "message": "No target KB specified"
        }


@app.get("/kb/jobs/{job_id}/status")
def get_kb_job_status(
    request: Request,
    job_id: str,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get KB job processing status and progress"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Verify job exists and belongs to workspace
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id,
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(
                status_code=404, 
                detail=_create_error_response(
                    "JOB_NOT_FOUND",
                    "KB job not found",
                    {"job_id": job_id, "workspace_id": workspace_id},
                    "Verify the job ID and ensure it belongs to your workspace"
                )
            )
        
        # Get related chunks processing status
        chunks = db.query(KbChunk).filter(
            KbChunk.job_id == job_id
        ).all()
        
        # Calculate processing statistics
        total_chunks = len(chunks)
        pending_chunks = len([c for c in chunks if c.processing_status == "pending"])
        processing_chunks = len([c for c in chunks if c.processing_status == "processing"])
        completed_chunks = len([c for c in chunks if c.processing_status == "completed"])
        failed_chunks = len([c for c in chunks if c.processing_status == "failed"])
        
        # Overall progress
        if total_chunks > 0:
            progress_pct = int((completed_chunks / total_chunks) * 100)
        else:
            progress_pct = 0
        
        return {
            "job_id": job_id,
            "status": job.status,
            "progress_pct": progress_pct,
            "chunks": {
                "total": total_chunks,
                "pending": pending_chunks,
                "processing": processing_chunks,
                "completed": completed_chunks,
                "failed": failed_chunks
            },
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            "completed_at": job.completed_at
        }


@app.get("/kb/structured-cards")
def list_structured_cards(
    kb_id: Optional[str] = Query(None, description="Filter by Knowledge Base ID"),
    card_type: Optional[str] = Query(None, description="Filter by card type"),
    lang: Optional[str] = Query(None, description="Filter by language"),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum confidence score"),
    request: Request = None,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """List structured cards with filtering"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Build query with workspace filtering
        query_builder = db.query(KbStructuredCard).join(
            KnowledgeBase, KbStructuredCard.kb_id == KnowledgeBase.id
        ).filter(KnowledgeBase.workspace_id == workspace_id)
        
        # Apply filters
        if kb_id:
            query_builder = query_builder.filter(KbStructuredCard.kb_id == kb_id)
        if card_type:
            query_builder = query_builder.filter(KbStructuredCard.card_type == card_type)
        if lang:
            query_builder = query_builder.filter(KbStructuredCard.lang == lang)
        if min_confidence is not None:
            query_builder = query_builder.filter(KbStructuredCard.confidence >= min_confidence)
        
        # Order by confidence and recency
        cards = query_builder.order_by(
            KbStructuredCard.confidence.desc(),
            KbStructuredCard.updated_at.desc()
        ).all()
        
        return {
            "items": [
                {
                    "id": card.id,
                    "kb_id": card.kb_id,
                    "card_type": card.card_type,
                    "title": card.title,
                    "content_json": card.content_json,
                    "confidence": card.confidence,
                    "source_chunks": card.source_chunks,
                    "lang": card.lang,
                    "meta_json": card.meta_json,
                    "created_at": card.created_at,
                    "updated_at": card.updated_at
                }
                for card in cards
            ],
            "total": len(cards)
        }


@app.get("/kb/structured-cards/{card_id}")
def get_structured_card(
    card_id: str,
    request: Request = None,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get a specific structured card"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Get card with workspace verification
        card = db.query(KbStructuredCard).join(
            KnowledgeBase, KbStructuredCard.kb_id == KnowledgeBase.id
        ).filter(
            KbStructuredCard.id == card_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not card:
            raise HTTPException(
                status_code=404,
                detail=_create_error_response(
                    "CARD_NOT_FOUND",
                    "Structured card not found",
                    {"card_id": card_id},
                    "Verify the card ID and ensure it belongs to your workspace"
                )
            )
        
        return {
            "id": card.id,
            "kb_id": card.kb_id,
            "card_type": card.card_type,
            "title": card.title,
            "content_json": card.content_json,
            "confidence": card.confidence,
            "source_chunks": card.source_chunks,
            "lang": card.lang,
            "meta_json": card.meta_json,
            "created_at": card.created_at,
            "updated_at": card.updated_at
        }


@app.get("/kb/{kb_id}/completeness")
def get_kb_completeness(
    kb_id: str,
    request: Request = None,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get KB completeness metrics with intelligent breakdown"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Verify KB exists and belongs to workspace
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if not kb:
            raise HTTPException(
                status_code=404,
                detail=_create_error_response(
                    "KB_NOT_FOUND",
                    "Knowledge Base not found",
                    {"kb_id": kb_id},
                    "Verify the KB ID and ensure it belongs to your workspace"
                )
            )
        
        # Get structured cards for this KB
        cards = db.query(KbStructuredCard).filter(
            KbStructuredCard.kb_id == kb_id
        ).all()
        
        # Get chunks for this KB
        chunks = db.query(KbChunk).filter(
            KbChunk.kb_id == kb_id
        ).all()
        
        # Get sections and fields for this KB
        sections = db.query(KbSection).filter(
            KbSection.kb_id == kb_id
        ).all()
        
        fields = db.query(KbField).filter(
            KbField.kb_id == kb_id
        ).all()
        
        # Calculate completeness by category with weights
        weights = {
            "company": 0.20,      # 20% - Company profile
            "contacts": 0.10,     # 10% - Contact information
            "products": 0.25,     # 25% - Product catalog
            "pricing": 0.15,      # 15% - Pricing information
            "policies": 0.20,     # 20% - Company policies
            "faq": 0.10           # 10% - FAQ section
        }
        
        # Count cards by type
        card_counts = {}
        for card in cards:
            card_type = card.card_type
            if card_type not in card_counts:
                card_counts[card_type] = 0
            card_counts[card_type] += 1
        
        # Calculate scores for each category
        category_scores = {}
        for category, weight in weights.items():
            count = card_counts.get(category, 0)
            # Score based on presence and quality
            if count == 0:
                score = 0.0
            elif count == 1:
                score = 60.0  # Basic coverage
            elif count <= 3:
                score = 80.0  # Good coverage
            else:
                score = 100.0  # Excellent coverage
            
            # Apply confidence boost if cards exist
            if count > 0:
                avg_confidence = sum(
                    c.confidence for c in cards if c.card_type == category
                ) / count
                score = min(100.0, score + (avg_confidence * 20))
            
            category_scores[category] = score
        
        # Calculate overall completeness
        overall_score = sum(
            score * weights[category] 
            for category, score in category_scores.items()
        )
        
        # Calculate freshness score from ALL sources
        timestamps = []
        timestamps += [chunk.updated_at for chunk in chunks if chunk.updated_at]
        timestamps += [card.updated_at for card in cards if card.updated_at]
        timestamps += [section.updated_at for section in sections if section.updated_at]
        timestamps += [field.updated_at for field in fields if field.updated_at]
        
        if timestamps:
            latest_update = max(timestamps)
            days_old = (datetime.utcnow() - latest_update).days
            if days_old <= 7:
                freshness_score = 100.0
            elif days_old <= 30:
                freshness_score = 75.0
            elif days_old <= 90:
                freshness_score = 50.0
            else:
                freshness_score = 25.0
        else:
            freshness_score = 0.0  # No content = 0 freshness
        
        # Generate improvement suggestions
        suggestions = []
        for category, score in category_scores.items():
            if score < 50:
                suggestions.append(f"Add {category} information to improve coverage")
            elif score < 80:
                suggestions.append(f"Enhance {category} details for better completeness")
        
        if freshness_score < 50:
            suggestions.append("Update content to improve freshness")
        
        if not chunks and not cards and not sections and not fields:
            suggestions.append("Upload documents to start building your knowledge base")
        
        # Update KB cache field (best-effort)
        try:
            kb.completeness_pct = int(overall_score)
            kb.freshness_score = int(freshness_score)
            kb.updated_at = datetime.utcnow()
            db.commit()
        except Exception as e:
            # Log but don't fail the API
            logger.warning(f"Failed to update KB cache fields: {e}")
        
        return {
            "kb_id": kb_id,
            "overall_score": round(overall_score, 1),
            "breakdown": {
                "company_score": round(category_scores.get("company", 0.0), 1),
                "contacts_score": round(category_scores.get("contacts", 0.0), 1),
                "products_score": round(category_scores.get("products", 0.0), 1),
                "pricing_score": round(category_scores.get("pricing", 0.0), 1),
                "policies_score": round(category_scores.get("policies", 0.0), 1),
                "faq_score": round(category_scores.get("faq", 0.0), 1),
                "freshness_score": round(freshness_score, 1),
                "accuracy_score": round(overall_score * 0.9, 1)  # Estimate based on completeness
            },
            "last_calculated": datetime.utcnow(),
            "suggestions": suggestions,
            "stats": {
                "total_cards": len(cards),
                "total_chunks": len(chunks),
                "total_sections": len(sections),
                "total_fields": len(fields),
                "card_types_present": list(card_counts.keys())
            }
        }


@app.get("/kb/completeness")
def get_workspace_completeness(
    request: Request = None,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get workspace-level KB completeness overview"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Get all KBs for this workspace
        kbs = db.query(KnowledgeBase).filter(
            KnowledgeBase.workspace_id == workspace_id
        ).all()
        
        workspace_stats = {
            "total_kbs": len(kbs),
            "total_score": 0.0,
            "avg_score": 0.0,
            "kbs": []
        }
        
        if kbs:
            for kb in kbs:
                # Get basic stats for each KB
                cards_count = db.query(KbStructuredCard).filter(
                    KbStructuredCard.kb_id == kb.id
                ).count()
                
                chunks_count = db.query(KbChunk).filter(
                    KbChunk.kb_id == kb.id
                ).count()
                
                kb_summary = {
                    "id": kb.id,
                    "name": kb.name,
                    "kind": kb.kind,
                    "completeness_pct": kb.completeness_pct or 0,
                    "freshness_score": kb.freshness_score or 0,
                    "total_cards": cards_count,
                    "total_chunks": chunks_count,
                    "created_at": kb.created_at,
                    "updated_at": kb.updated_at
                }
                
                workspace_stats["kbs"].append(kb_summary)
                workspace_stats["total_score"] += kb.completeness_pct or 0
            
            workspace_stats["avg_score"] = round(
                workspace_stats["total_score"] / len(kbs), 1
            )
        
        return workspace_stats


# ===================== Crawl & Web Scraping Endpoints =====================

@app.post("/kb/crawl/start", response_model=KbCrawlStartResponse)
def kb_crawl_start(
    request: Request,
    payload: KbCrawlStart,
    _guard: None = Depends(require_role("editor"))
):
    """Start a new crawl job for a website"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Create KbSource(type='url') and KbImportJob(kind='crawl')
        source_id = f"source_{secrets.token_urlsafe(8)}"
        source = KbSource(
            id=source_id,
            workspace_id=workspace_id,
            kind="url",
            url=str(payload.seed_url),
            filename=None,
            sha256=None,
            status="processing",
            meta_json={
                "depth": payload.depth,
                "max_pages": payload.max_pages,
                "include": payload.include or [],
                "exclude": payload.exclude or [],
                "same_domain_only": payload.same_domain_only,
                "user_agent": payload.user_agent,
                "target_kb_id": payload.target_kb_id,
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(source)

        job_id = f"job_{secrets.token_urlsafe(8)}"
        job = KbImportJob(
            id=job_id,
            workspace_id=workspace_id,
            user_id="u_1",
            source_id=source_id,
            target_kb_id=payload.target_kb_id,
            template="generic",
            status="pending",
            progress_pct=0,
            progress_json={
                "phase": "crawl", 
                "pages_enqueued": 0, 
                "pages_processed": 0, 
                "pages_failed": 0
            }
        )
        db.add(job)
        db.commit()

        # Start worker
        try:
            from backend.workers.crawl_job import crawl_site_job
            crawl_site_job.send(
                job_id=job_id,
                source_id=source_id,
                seed_url=str(payload.seed_url),
                depth=payload.depth,
                max_pages=payload.max_pages,
                include=payload.include or [],
                exclude=payload.exclude or [],
                same_domain_only=payload.same_domain_only,
                user_agent=payload.user_agent or "ColdAI-KB-Crawler/1.0",
                workspace_id=workspace_id,
            )
        except ImportError:
            # Fallback if workers not available
            logger.warning("Crawl workers not available, job queued but not started")
        
        return {"job_id": job_id, "source_id": source_id, "status": "queued"}


@app.get("/kb/crawl/{job_id}", response_model=KbCrawlStatus)
def kb_crawl_status(
    request: Request,
    job_id: str,
    _guard: None = Depends(require_role("viewer"))
):
    """Get crawl job status and progress"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        job = db.query(KbImportJob).filter(
            KbImportJob.id == job_id, 
            KbImportJob.workspace_id == workspace_id
        ).first()
        
        if not job:
            raise HTTPException(
                status_code=404, 
                detail=_create_error_response(
                    "CRAWL_JOB_NOT_FOUND",
                    "Crawl job not found",
                    {"job_id": job_id},
                    "Verify the job ID and ensure it belongs to your workspace"
                )
            )

        progress = job.progress_json or {}
        return {
            "job_id": job.id,
            "source_id": job.source_id,
            "status": job.status,
            "pages_enqueued": int(progress.get("pages_enqueued", 0)),
            "pages_processed": int(progress.get("pages_processed", 0)),
            "pages_failed": int(progress.get("pages_failed", 0)),
            "last_error": progress.get("last_error"),
            "started_at": job.created_at,
            "updated_at": job.updated_at,
        }


@app.post("/kb/sources/{source_id}/refresh")
def kb_source_refresh(
    request: Request,
    source_id: str,
    _guard: None = Depends(require_role("editor"))
):
    """Refresh/restart crawl for an existing URL source"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        src = db.query(KbSource).filter(
            KbSource.id == source_id, 
            KbSource.workspace_id == workspace_id
        ).first()
        
        if not src or src.kind != "url":
            raise HTTPException(
                status_code=404,
                detail=_create_error_response(
                    "URL_SOURCE_NOT_FOUND",
                    "URL source not found",
                    {"source_id": source_id},
                    "Verify the source ID and ensure it's a URL source"
                )
            )

        job_id = f"job_{secrets.token_urlsafe(8)}"
        job = KbImportJob(
            id=job_id,
            workspace_id=workspace_id,
            user_id="u_1",
            source_id=source_id,
            target_kb_id=src.meta_json.get("target_kb_id"),
            template="generic",
            status="pending",
            progress_pct=0,
            progress_json={
                "phase": "crawl", 
                "pages_enqueued": 0, 
                "pages_processed": 0, 
                "pages_failed": 0
            }
        )
        src.status = "processing"
        src.updated_at = datetime.utcnow()
        db.add(job)
        db.commit()

        # Start worker
        try:
            from backend.workers.crawl_job import crawl_site_job
            crawl_site_job.send(
                job_id=job_id,
                source_id=source_id,
                seed_url=src.url,
                depth=int(src.meta_json.get("depth", 1)),
                max_pages=int(src.meta_json.get("max_pages", 15)),
                include=src.meta_json.get("include", []),
                exclude=src.meta_json.get("exclude", []),
                same_domain_only=bool(src.meta_json.get("same_domain_only", True)),
                user_agent=src.meta_json.get("user_agent") or "ColdAI-KB-Crawler/1.0",
                workspace_id=workspace_id,
            )
        except ImportError:
            logger.warning("Crawl workers not available, refresh job queued but not started")
        
        return {"job_id": job_id, "source_id": source_id, "status": "queued"}


# ===================== Crawl & Web Scraping Schemas =====================
# Models are now imported from backend.schemas


# ===================== Crawl Helper Functions =====================

def _host(url: str) -> str:
    """Extract normalized host from URL"""
    try:
        return urlparse(url).netloc.lower()
    except:
        return ""


@app.post("/kb/imports/{job_id}/cancel")
def cancel_import_job(
    request: Request,
    job_id: str,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Cancel an import job"""
    workspace_id = get_workspace_id(request, required=True)
    
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


def get_workspace_id(request: Request, *, required: bool = True, fallback: str | None = None) -> str | None:
    """
    Unified workspace ID helper - extracts from (in order):
    - header 'X-Workspace-Id'
    - request.state.workspace_id (if middleware populates it)
    - fallback (default None)
    
    Args:
        required: if True, raises HTTPException when no workspace found
        fallback: default value when no workspace in request
    """
    ws = request.headers.get("X-Workspace-Id")
    if ws:
        return ws.strip()
    
    ws = getattr(request.state, "workspace_id", None)
    if ws:
        return ws
    
    if fallback:
        return fallback
    
    if required:
        raise HTTPException(status_code=400, detail="X-Workspace-Id header required")
    
    return None


def _recalculate_kb_metrics(db: Session, kb_id: str) -> None:
    """Recalculate KB completeness and freshness metrics - ROBUST VERSION"""
    sections = db.query(KbSection).filter(KbSection.kb_id == kb_id).all()
    fields = db.query(KbField).filter(KbField.kb_id == kb_id).all()

    # Completeness
    if not sections and not fields:
        completeness_pct = 0
    else:
        sec_w = 0.5
        fld_w = 0.5
        section_compl = (sum(s.completeness_pct or 0 for s in sections) / max(len(sections), 1)) if sections else 0
        field_compl = (sum(1 for f in fields if (f.value_text or f.value_json)) / max(len(fields), 1)) if fields else 0
        completeness_pct = int((section_compl * sec_w + field_compl * fld_w) * 100)

    # Freshness
    timestamps = []
    timestamps += [s.updated_at for s in sections if s.updated_at]
    timestamps += [f.updated_at for f in fields if f.updated_at]

    if not timestamps:
        freshness_score = 0
    else:
        days = (datetime.utcnow() - max(timestamps)).days
        freshness_score = 100 if days <= 7 else 75 if days <= 30 else 50 if days <= 90 else 25

    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if kb:
        kb.completeness_pct = completeness_pct
        kb.freshness_score = freshness_score
        kb.updated_at = datetime.utcnow()
        db.commit()

@app.get("/metrics/funnel")
async def get_funnel_metrics(days: int = 30):
	"""Get conversion funnel metrics for the specified period"""
	try:
		# Calculate date range
		end_date = datetime.utcnow()
		start_date = end_date - timedelta(days=days)
		
		# Demo mode: deterministic seed for consistent data
		import random
		seed = f"funnel:{days}"
		random.seed(seed)
		
		# Mock data for now - replace with real queries
		funnel_data = {
			"reached": 1250 + random.randint(-50, 50),
			"connected": 890 + random.randint(-30, 30),
			"qualified": 445 + random.randint(-20, 20),
			"booked": 178 + random.randint(-10, 10)
		}
		
		# Reset random seed
		random.seed()
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
		
		# Demo mode: deterministic seed for consistent data
		import random
		seed = f"cost_series:{days}"
		random.seed(seed)
		
		# Mock data for now - replace with real queries
		cost_series = []
		for i in range(days):
			date = start_date + timedelta(days=i)
			cost_series.append({
				"date": date.strftime("%Y-%m-%d"),
				"spend_cents": random.randint(5000, 25000),  # €50-250 per day
				"cost_per_min": random.uniform(0.15, 0.35)  # €0.15-0.35 per minute
			})
		
		# Reset random seed
		random.seed()
		return cost_series
	except Exception as e:
		logger.error(f"Error getting cost series: {e}")
		raise HTTPException(status_code=500, detail="Failed to get cost series")

async def get_timeseries_data(days: int = 30, campaign_id: str = None, agent_id: str = None, lang: str = None, country: str = None):
	"""Get timeseries data for charts with real-time aggregation"""
	try:
		# Calculate date range
		end_date = datetime.utcnow()
		start_date = end_date - timedelta(days=days)
		
		# TODO: Replace with real Retell data aggregation
		# For now, use demo mode with deterministic seed
		import random
		seed = f"timeseries:{days}:{campaign_id}:{agent_id}:{lang}:{country}"
		random.seed(seed)
		
		# Generate daily series with slight upward trend
		series = []
		base_reached = 40
		base_connected = 28
		base_qualified = 14
		base_booked = 6
		
		for i in range(days):
			date = start_date + timedelta(days=i)
			# Add slight upward trend + random variation
			trend_factor = 1 + (i / days) * 0.1  # 10% increase over period
			
			series.append({
				"date": date.strftime("%Y-%m-%d"),
				"reached": int((base_reached + random.randint(-5, 5)) * trend_factor),
				"connected": int((base_connected + random.randint(-3, 3)) * trend_factor),
				"qualified": int((base_qualified + random.randint(-2, 2)) * trend_factor),
				"booked": int((base_booked + random.randint(-1, 1)) * trend_factor),
				"avg_duration_sec": int((132 + random.randint(-10, 10)) * trend_factor)
			})
		
		# Reset random seed
		random.seed()
		
		return {
			"granularity": "day",
			"series": series,
			"moving_avg": {"window": 7},
			"filters": {
				"campaign_id": campaign_id,
				"agent_id": agent_id,
				"lang": lang,
				"country": country
			}
		}
	except Exception as e:
		logger.error(f"Error getting timeseries data: {e}")
		raise HTTPException(status_code=500, detail="Failed to get timeseries data")

async def get_heatmap_data(days: int = 30):
	"""Get heatmap data for day-of-week x hour analysis"""
	try:
		# Demo mode: deterministic seed for consistent data
		import random
		seed = f"heatmap:{days}"
		random.seed(seed)
		
		# Generate 7x24 matrix (dow x hour)
		matrix = []
		
		for dow in range(7):  # 0=Sun, 1=Mon, ..., 6=Sat
			for hour in range(24):
				# Working hours (Mon-Fri, 9-18) are hotter
				is_working_hours = dow >= 1 and dow <= 5 and hour >= 9 and hour <= 18
				base_calls = 15 if is_working_hours else 3
				
				# Add some randomness
				calls = max(0, base_calls + random.randint(-3, 3))
				connected_rate = random.uniform(0.2, 0.6) if calls > 0 else 0
				
				matrix.append({
					"dow": dow,
					"hour": hour,
					"calls": calls,
					"connected_rate": round(connected_rate, 2)
				})
		
		# Reset random seed
		random.seed()
		
		return {
			"bucket": "hour_x_dow",
			"matrix": matrix
		}
	except Exception as e:
		logger.error(f"Error getting heatmap data: {e}")
		raise HTTPException(status_code=500, detail="Failed to get heatmap data")

async def get_outcomes_data(days: int = 30, campaign_id: str = None, agent_id: str = None, lang: str = None, country: str = None):
	"""Get outcomes breakdown data with real-time aggregation"""
	try:
		# TODO: Replace with real Retell data aggregation
		# For now, use demo mode with deterministic seed
		import random
		seed = f"outcomes:{days}:{campaign_id}:{agent_id}:{lang}:{country}"
		random.seed(seed)
		
		# Generate outcomes with realistic distribution
		outcomes = [
			{"label": "Qualified", "count": 445 + random.randint(-20, 20), "rate": 0.356, "avg_handle_sec": 132 + random.randint(-10, 10)},
			{"label": "No-answer", "count": 310 + random.randint(-15, 15), "rate": 0.248, "avg_handle_sec": 0},
			{"label": "Wrong number", "count": 156 + random.randint(-10, 10), "rate": 0.125, "avg_handle_sec": 45 + random.randint(-5, 5)},
			{"label": "Not interested", "count": 89 + random.randint(-8, 8), "rate": 0.071, "avg_handle_sec": 78 + random.randint(-5, 5)},
			{"label": "Callback requested", "count": 67 + random.randint(-5, 5), "rate": 0.054, "avg_handle_sec": 95 + random.randint(-5, 5)},
			{"label": "Other", "count": 183 + random.randint(-10, 10), "rate": 0.146, "avg_handle_sec": 65 + random.randint(-5, 5)}
		]
		
		# Reset random seed
		random.seed()
		
		# Enhanced response structure for real data
		return {
			"totals": {
				"booked": sum(o["count"] for o in outcomes if "booked" in o["label"].lower()),
				"qualified": sum(o["count"] for o in outcomes if "qualified" in o["label"].lower()),
				"failed": sum(o["count"] for o in outcomes if o["label"] not in ["Qualified", "Booked"])
			},
			"by_reason": outcomes,
			"by_channel": [
				{"channel": "mobile", "count": int(sum(o["count"] for o in outcomes) * 0.68)},
				{"channel": "landline", "count": int(sum(o["count"] for o in outcomes) * 0.32)}
			],
			"filters": {
				"campaign_id": campaign_id,
				"agent_id": agent_id,
				"lang": lang,
				"country": country
			}
		}
	except Exception as e:
		logger.error(f"Error getting outcomes data: {e}")
		raise HTTPException(status_code=500, detail="Failed to get outcomes data")

async def get_qa_language_data(days: int = 30, campaign_id: str = None, agent_id: str = None):
	"""Get conversational quality metrics (optional endpoint for Gamma)"""
	try:
		# TODO: Replace with real Retell transcript analysis
		# For now, use demo mode with deterministic seed
		import random
		seed = f"qa_language:{days}:{campaign_id}:{agent_id}"
		random.seed(seed)
		
		# Generate realistic QA metrics
		data = {
			"distributions": {
				"talk_ratio": {
					"p50": round(0.58 + random.uniform(-0.05, 0.05), 2),
					"p90": round(0.71 + random.uniform(-0.03, 0.03), 2)
				},
				"dead_air_sec": {
					"p50": max(1, int(6 + random.randint(-2, 2))),
					"p90": max(3, int(13 + random.randint(-3, 3)))
				},
				"sentiment_agent": {
					"avg": round(0.14 + random.uniform(-0.05, 0.05), 2)
				},
				"sentiment_prospect": {
					"avg": round(-0.02 + random.uniform(-0.08, 0.08), 2)
				},
				"interruptions": {
					"avg": round(1.6 + random.uniform(-0.3, 0.3), 1)
				}
			},
			"top_objections": [
				{"label": "price", "count": 53 + random.randint(-5, 5)},
				{"label": "timing", "count": 41 + random.randint(-3, 3)},
				{"label": "need", "count": 28 + random.randint(-2, 2)},
				{"label": "authority", "count": 19 + random.randint(-1, 1)}
			],
			"filters": {
				"campaign_id": campaign_id,
				"agent_id": agent_id
			}
		}
		
		# Reset random seed
		random.seed()
		
		return data
	except Exception as e:
		logger.error(f"Error getting QA language data: {e}")
		raise HTTPException(status_code=500, detail="Failed to get QA language data")

# --- NEW: unified overview endpoint ---
@app.get("/metrics/timeseries")
async def get_metrics_timeseries(
    days: int = 30,
    campaign_id: str | None = None,
    agent_id: str | None = None,
    lang: str | None = None,
    country: str | None = None,
):
    """Get timeseries data for charts with drill-down support"""
    try:
        data = await get_timeseries_data(
            days=days,
            campaign_id=campaign_id,
            agent_id=agent_id,
            lang=lang,
            country=country
        )
        
        # Generate ETag for caching
        import hashlib
        payload_str = str(data)
        etag = hashlib.md5(f"{days}{campaign_id}{agent_id}{lang}{country}{payload_str}".encode()).hexdigest()
        
        return {
            **data,
            "etag": etag
        }
    except Exception as e:
        logger.error(f"Error getting timeseries: {e}")
        raise HTTPException(status_code=500, detail="Failed to get timeseries data")

@app.get("/metrics/outcomes")
async def get_metrics_outcomes(
    days: int = 30,
    campaign_id: str | None = None,
    agent_id: str | None = None,
    lang: str | None = None,
    country: str | None = None,
):
    """Get outcomes breakdown data with drill-down support"""
    try:
        data = await get_outcomes_data(
            days=days,
            campaign_id=campaign_id,
            agent_id=agent_id,
            lang=lang,
            country=country
        )
        
        # Generate ETag for caching
        import hashlib
        payload_str = str(data)
        etag = hashlib.md5(f"{days}{campaign_id}{agent_id}{lang}{country}{payload_str}".encode()).hexdigest()
        
        return {
            **data,
            "etag": etag
        }
    except Exception as e:
        logger.error(f"Error getting outcomes: {e}")
        raise HTTPException(status_code=500, detail="Failed to get outcomes data")

@app.get("/metrics/overview")
async def get_metrics_overview(
    days: int = 30,
    campaign_id: str | None = None,
    agent_id: str | None = None,
    lang: str | None = "en-US",
    country: str | None = None,
):
    """
    Overview unificata per la pagina /analytics.
    Per ora usa i generatori mock già presenti in /metrics/*.
    Accetta parametri standard che potremo usare quando colleghiamo Retell.
    """
    # Use helper function for consistency
    overview_data = await _build_metrics_overview(days, campaign_id, agent_id, lang, country)
    
    # Normalize params to snake_case and add currency
    params = {
        "days": days,
        "campaign_id": campaign_id,
        "agent_id": agent_id,
        "lang": lang,
        "country": country,
        "currency": "EUR"  # Default currency
    }
    
    # Generate ETag for caching (hash of params + payload)
    import hashlib
    payload_str = str(overview_data)
    etag = hashlib.md5(f"{str(params)}{payload_str}".encode()).hexdigest()
    
    return {
        **overview_data,
        "params": params,
        "etag": etag
    }

@app.post("/webhook/retell")
def retell_webhook(
    request: Request,
    body: dict = Body(...)
) -> dict:
    """Handle Retell webhook events"""
    try:
        # Verify webhook signature (if configured)
        if Retell:
            # Verify webhook signature
            signature = request.headers.get("X-Retell-Signature")
            if signature:
                try:
                    Retell.verify_webhook_signature(
                        request.body(),
                        signature,
                        os.getenv("RETELL_WEBHOOK_SECRET", "")
                    )
                except Exception as e:
                    print(f"Webhook signature verification failed: {e}")
                    raise HTTPException(status_code=401, detail="Invalid signature")
        
        event_type = body.get("event")
        call_data = body.get("data", {})
        
        if event_type == "call_started":
            return _handle_call_started(call_data)
        elif event_type == "call_ended":
            return _handle_call_ended(call_data)
        elif event_type == "call_updated":
            return _handle_call_updated(call_data)
        else:
            print(f"Unknown webhook event: {event_type}")
            return {"status": "ignored", "event": event_type}
            
    except Exception as e:
        print(f"Webhook processing failed: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

def _handle_call_started(call_data: dict) -> dict:
    """Handle call started event with KB resolution"""
    try:
        call_id = call_data.get("call_id")
        campaign_id = call_data.get("campaign_id")
        number_id = call_data.get("number_id")
        agent_id = call_data.get("agent_id")
        
        print(f"Call started: {call_id}, campaign: {campaign_id}, number: {number_id}, agent: {agent_id}")
        
        # Resolve KB for this call context
        kb_context = _resolve_kb_for_call(campaign_id, number_id, agent_id)
        
        # Store KB context for the call
        if kb_context:
            _store_call_kb_context(call_id, kb_context)
            print(f"KB resolved for call {call_id}: {kb_context['kb_id']}")
        
        return {"status": "processed", "kb_resolved": bool(kb_context)}
        
    except Exception as e:
        print(f"Failed to handle call started: {e}")
        return {"status": "error", "error": str(e)}

def _resolve_kb_for_call(campaign_id: str = None, number_id: str = None, agent_id: str = None) -> dict:
    """Resolve KB for call context using precedence rules"""
    try:
        # This would use the same logic as /kb/resolve endpoint
        # For now, return mock data
        if campaign_id:
            return {
                "kb_id": f"kb_campaign_{campaign_id}",
                "kind": "company",
                "name": "Campaign KB",
                "precedence": "campaign"
            }
        elif number_id:
            return {
                "kb_id": f"kb_number_{number_id}",
                "kind": "company", 
                "name": "Number KB",
                "precedence": "number"
            }
        elif agent_id:
            return {
                "kb_id": f"kb_agent_{agent_id}",
                "kind": "company",
                "name": "Agent KB", 
                "precedence": "agent"
            }
        else:
            return {
                "kb_id": "kb_workspace_default",
                "kind": "company",
                "name": "Workspace Default KB",
                "precedence": "workspace_default"
            }
    except Exception as e:
        print(f"KB resolution failed: {e}")
        return None

def _store_call_kb_context(call_id: str, kb_context: dict):
    """Store KB context for a call (in Redis or database)"""
    try:
        # In production, store in Redis for fast access
        # For now, just log
        print(f"Storing KB context for call {call_id}: {kb_context}")
        
        # TODO: Store in Redis with TTL
        # redis_client.setex(f"call_kb:{call_id}", 3600, json.dumps(kb_context))
        
    except Exception as e:
        print(f"Failed to store call KB context: {e}")

@app.post("/kb/track-usage")
def track_kb_usage(
    request: Request,
            payload: KbUsageTrackRequest,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Track KB usage for hit-rate analytics"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Create usage record
        usage_id = f"usage_{secrets.token_urlsafe(8)}"
        usage = KbUsage(
            id=usage_id,
            workspace_id=workspace_id,
            kb_id=payload.kb_id,
            kind=payload.kind,
            context=payload.context,
            success=payload.success,
            tokens_used=payload.tokens_used or 0,
            cost_micros=payload.cost_micros or 0,
            metadata=payload.metadata
        )
        db.add(usage)
        db.commit()
        
        # Update KB freshness score
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == payload.kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        
        if kb:
            # Increase freshness score on usage
            kb.freshness_score = min(100, kb.freshness_score + 2)
            db.commit()
        
        return {
            "id": usage_id,
            "status": "tracked",
            "kb_id": payload.kb_id,
            "kind": payload.kind
        }

@app.get("/kb/analytics")
def get_kb_analytics(
    request: Request,
    kb_id: Optional[str] = Query(None),
    period: str = Query("7d", description="Period: 1d, 7d, 30d, 90d"),
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Get KB usage analytics and hit-rate"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Calculate period
        now = datetime.utcnow()
        if period == "1d":
            start_date = now - timedelta(days=1)
        elif period == "7d":
            start_date = now - timedelta(days=7)
        elif period == "30d":
            start_date = now - timedelta(days=30)
        elif period == "90d":
            start_date = now - timedelta(days=90)
        else:
            start_date = now - timedelta(days=7)
        
        # Build query
        query = db.query(KbUsage).filter(
            KbUsage.workspace_id == workspace_id,
            KbUsage.created_at >= start_date
        )
        
        if kb_id:
            query = query.filter(KbUsage.kb_id == kb_id)
        
        usages = query.all()
        
        # Calculate metrics
        total_usage = len(usages)
        successful_usage = len([u for u in usages if u.success])
        hit_rate = (successful_usage / total_usage * 100) if total_usage > 0 else 0
        
        # Group by KB
        kb_stats = {}
        for usage in usages:
            if usage.kb_id not in kb_stats:
                kb_stats[usage.kb_id] = {
                    "total": 0,
                    "successful": 0,
                    "tokens": 0,
                    "cost": 0
                }
            
            kb_stats[usage.kb_id]["total"] += 1
            if usage.success:
                kb_stats[usage.kb_id]["successful"] += 1
            kb_stats[usage.kb_id]["tokens"] += usage.tokens_used
            kb_stats[usage.kb_id]["cost"] += usage.cost_micros
        
        # Calculate hit-rates per KB
        for kb_id, stats in kb_stats.items():
            stats["hit_rate"] = (stats["successful"] / stats["total"] * 100) if stats["total"] > 0 else 0
        
        return {
            "period": period,
            "total_usage": total_usage,
            "overall_hit_rate": hit_rate,
            "kb_stats": kb_stats,
            "period_start": start_date.isoformat(),
            "period_end": now.isoformat()
        }

# ===================== KB Documents & Chunks =====================

@app.post("/kb/documents/upload")
async def kb_upload_document(
    file: UploadFile = File(...),
    source_id: str = Form(...),
    request: Request = None,
    _guard: None = Depends(require_role("editor"))
) -> dict:
    """Upload a document for KB processing"""
    workspace_id = get_workspace_id(request, required=True)
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Check file size (max 25MB)
    if file.size and file.size > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 25MB")
    
    # Validate MIME type
    allowed_mimes = {
        'application/pdf': '.pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'text/plain': '.txt',
        'text/markdown': '.md'
    }
    
    if file.content_type not in allowed_mimes:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_mimes.values())}"
        )
    
    with next(get_db()) as db:
        # Verify source exists and belongs to workspace
        source = db.query(KbSource).filter(
            KbSource.id == source_id,
            KbSource.workspace_id == workspace_id
        ).first()
        
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        
        # Read file content and calculate checksum
        content = await file.read()
        checksum = hashlib.sha256(content).hexdigest()
        
        # Check for duplicate
        existing_doc = db.query(KbDocument).filter(
            KbDocument.checksum == checksum,
            KbDocument.source_id == source_id
        ).first()
        
        if existing_doc:
            return {
                "doc_id": existing_doc.id,
                "status": "duplicate",
                "message": "Document already exists"
            }
        
        # Create document record
        doc_id = f"doc_{secrets.token_urlsafe(8)}"
        document = KbDocument(
            id=doc_id,
            source_id=source_id,
            title=file.filename,
            mime_type=file.content_type,
            bytes=len(content),
            checksum=checksum,
            lang="en-US"  # TODO: auto-detect
        )
        db.add(document)
        
        # Save file to storage (TODO: implement proper file storage)
        # For now, just store in memory/db
        
        db.commit()
        
        # Start KB processing pipeline
        try:
            from backend.workers.kb_jobs import start_kb_processing_pipeline
            start_kb_processing_pipeline(doc_id)
            processing_status = "pipeline_started"
        except ImportError:
            # Fallback if workers not available
            processing_status = "queued_no_workers"
        
        return {
            "doc_id": doc_id,
            "status": "queued",
            "message": "Document uploaded and queued for processing",
            "processing_status": processing_status
        }


@app.get("/kb/documents")
def kb_list_documents(
    source_id: Optional[str] = Query(None, description="Filter by source ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    request: Request = None,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """List KB documents for current workspace"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Join with sources to filter by workspace
        query = db.query(KbDocument).join(
            KbSource, KbDocument.source_id == KbSource.id
        ).filter(KbSource.workspace_id == workspace_id)
        
        if source_id:
            query = query.filter(KbDocument.source_id == source_id)
        if status:
            query = query.filter(KbDocument.status == status)
        
        total = query.count()
        offset = (page - 1) * per_page
        documents = query.offset(offset).limit(per_page).all()
        
        return {
            "items": [
                {
                    "id": doc.id,
                    "source_id": doc.source_id,
                    "title": doc.title,
                    "mime_type": doc.mime_type,
                    "bytes": doc.bytes,
                    "status": doc.status,
                    "lang": doc.lang,
                    "created_at": doc.created_at,
                    "updated_at": doc.updated_at
                }
                for doc in documents
            ],
            "total": total,
            "page": page,
            "per_page": per_page
        }


@app.get("/kb/chunks")
def kb_search_chunks(
    query: Optional[str] = Query(None, description="Search query"),
    doc_id: Optional[str] = Query(None, description="Filter by document ID"),
    type: Optional[str] = Query(None, description="Filter by chunk type"),
    lang: Optional[str] = Query(None, description="Filter by language"),
    semantic_type: Optional[str] = Query(None, description="Filter by semantic type"),
    min_quality: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum quality score"),
    max_pii: Optional[float] = Query(None, ge=0.0, le=1.0, description="Maximum PII score"),
    top_k: int = Query(20, ge=1, le=100, description="Maximum results"),
    use_semantic: bool = Query(True, description="Use semantic search if available"),
    request: Request = None,
    _guard: None = Depends(require_role("viewer"))
) -> dict:
    """Search KB chunks with hybrid text + semantic search"""
    workspace_id = get_workspace_id(request, required=True)
    
    with next(get_db()) as db:
        # Join with documents and sources to filter by workspace
        query_builder = db.query(KbChunk).join(
            KbDocument, KbChunk.doc_id == KbDocument.id
        ).join(
            KbSource, KbDocument.source_id == KbSource.id
        ).filter(KbSource.workspace_id == workspace_id)
        
        # Apply filters
        if doc_id:
            query_builder = query_builder.filter(KbChunk.doc_id == doc_id)
        if type:
            query_builder = query_builder.filter(
                KbChunk.meta_json['type'].astext == type
            )
        if lang:
            query_builder = query_builder.filter(KbChunk.lang == lang)
        if semantic_type:
            query_builder = query_builder.filter(KbChunk.semantic_type == semantic_type)
        if min_quality is not None:
            query_builder = query_builder.filter(KbChunk.quality_score >= min_quality)
        if max_pii is not None:
            query_builder = query_builder.filter(KbChunk.pii_score <= max_pii)
        
        # Apply search query with hybrid approach
        if query:
            if use_semantic and hasattr(KbChunk, 'embedding_vector'):
                # TODO: Implement semantic search with pgvector
                # For now, use text search + quality boost
                query_builder = query_builder.filter(
                    KbChunk.text.ilike(f"%{query}%")
                ).order_by(
                    KbChunk.quality_score.desc(),
                    KbChunk.text.ilike(f"%{query}%").desc()
                )
            else:
                # Full-text search with quality boost
                query_builder = query_builder.filter(
                    KbChunk.text.ilike(f"%{query}%")
                ).order_by(
                    KbChunk.quality_score.desc(),
                    KbChunk.text.ilike(f"%{query}%").desc()
                )
        else:
            # No query: order by quality and recency
            query_builder = query_builder.order_by(
                KbChunk.quality_score.desc(),
                KbChunk.updated_at.desc()
            )
        
        # Get results
        chunks = query_builder.limit(top_k).all()
        
        return {
            "items": [
                {
                    "id": chunk.id,
                    "doc_id": chunk.doc_id,
                    "text": chunk.text,
                    "lang": chunk.lang,
                    "tokens": chunk.tokens,
                    "semantic_type": chunk.semantic_type,
                    "quality_score": chunk.quality_score,
                    "pii_score": chunk.pii_score,
                    "duplicate_score": chunk.duplicate_score,
                    "semantic_tags": chunk.semantic_tags,
                    "meta_json": chunk.meta_json,
                    "created_at": chunk.created_at,
                    "updated_at": chunk.updated_at
                }
                for chunk in chunks
            ],
            "total": len(chunks),
            "query": query,
            "search_type": "hybrid" if use_semantic else "text_only"
    }


# ===================== GAMMA: Retell Webhook Integration =====================

@app.post("/webhooks/retell")
async def retell_webhook(
    request: Request,
    body: Dict[str, Any] = Body(...)
):
    """Process Retell webhook events for call analytics"""
    try:
        # Extract workspace ID from webhook signature or header
        workspace_id = get_workspace_id(request, fallback="ws_1")
        
        # TODO: Verify webhook signature for security
        # if Retell:
        #     signature = request.headers.get("X-Retell-Signature")
        #     if not Retell.verify_webhook_signature(body, signature):
        #         raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Process webhook with CallService
        with next(get_db()) as db:
            # Initialize services
            openai_client = OpenAIClient() if os.getenv("OPENAI_API_KEY") else None
            ai_service = AIService(db, openai_client) if openai_client else None
            call_service = CallService(db, ai_service)
            
            # Process the webhook
            success = call_service.process_retell_webhook(workspace_id, body)
            
            if success:
                return {"status": "processed", "workspace_id": workspace_id}
            else:
                raise HTTPException(status_code=500, detail="Failed to process webhook")
                
    except Exception as e:
        logger.error(f"Error processing Retell webhook: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/analytics/ai-cache-stats")
async def get_ai_cache_stats(
    request: Request,
    _guard: None = Depends(require_role("viewer"))
):
    """Get AI objection classification cache statistics"""
    try:
        workspace_id = get_workspace_id(request, required=True)
        
        with next(get_db()) as db:
            openai_client = OpenAIClient() if os.getenv("OPENAI_API_KEY") else None
            ai_service = AIService(db, openai_client) if openai_client else None
            
            if ai_service:
                stats = ai_service.get_cache_stats(workspace_id)
                return {
                    "workspace_id": workspace_id,
                    "cache_stats": stats,
                    "ai_enabled": True
                }
            else:
                return {
                    "workspace_id": workspace_id,
                    "cache_stats": {},
                    "ai_enabled": False,
                    "message": "OpenAI API key not configured"
                }
                
    except Exception as e:
        logger.error(f"Error getting AI cache stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/metrics/shadow")
async def get_shadow_mode_status(
    request: Request,
    days: int = Query(30, ge=1, le=90),
    campaign_id: Optional[str] = Query(None),
    agent_id: Optional[str] = Query(None),
    lang: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    _guard: None = Depends(require_role("admin"))
):
    """Get shadow mode comparison between real and mock data"""
    try:
        workspace_id = get_workspace_id(request, required=True)
        
        # Check if Gamma is enabled
        if not settings.ANALYTICS_GAMMA:
            return {
                "ok": False,
                "mode": "off",
                "message": "Gamma analytics not enabled"
            }
        
        with next(get_db()) as db:
            shadow_service = ShadowAnalyticsService(db)
            
            # Run comparison with timeout protection
            comparison = await shadow_service.compare_mock_vs_real_async(
                workspace_id, days, campaign_id, agent_id, lang, country
            )
            
            # Log the result
            if comparison.get("ok"):
                shadow_service.log_stability_check(workspace_id, comparison)
            
            return comparison
                
    except Exception as e:
        logger.error(f"Error in shadow mode comparison: {e}")
        # Return graceful error, don't fail the endpoint
        return {
            "ok": False,
            "mode": "error",
            "error": "Internal error",
            "timestamp": datetime.utcnow().isoformat()
        }


# ===================== Delta Endpoints =====================

@app.post("/metrics/compare")
async def metrics_compare(req: CompareRequest, request: Request):
    """Compare two segments of data"""
    try:
        workspace_id = get_workspace_id(request, required=True)
        
        # Build metrics for both segments using existing generators
        left = await _build_metrics_overview(
            days=req.left.days,
            campaign_id=req.left.campaign_id,
            agent_id=req.left.agent_id,
            lang=req.left.lang,
            country=req.left.country
        )
        
        right = await _build_metrics_overview(
            days=req.right.days,
            campaign_id=req.right.campaign_id,
            agent_id=req.right.agent_id,
            lang=req.right.lang,
            country=req.right.country
        )

        def pick_kpi(x):
            f = x["funnel"]
            cost = x.get("cost_series", {}).get("avg_cost_per_min")
            return {
                "booked_rate": f.get("booked_rate"),
                "qualified_rate": f.get("qualified_rate"),
                "connect_rate": f.get("connect_rate"),
                "cost_per_min": cost
            }

        left_kpi = pick_kpi(left)
        right_kpi = pick_kpi(right)
        delta = {k: _delta(left_kpi.get(k), right_kpi.get(k)) for k in left_kpi.keys()}

        # Heuristic "significance" (demo): change to "likely" if difference > 3pp on 200+ calls
        significance = {}
        for k in left_kpi.keys():
            # Use reached/connected as volume base
            vol = max(left["funnel"].get("reached", 0), right["funnel"].get("reached", 0))
            significance[k] = "likely" if abs(delta.get(k) or 0) >= 0.03 and vol >= 200 else "unclear"

        return {
            "left": {"label": "Left", "kpi": left_kpi},
            "right": {"label": "Right", "kpi": right_kpi},
            "delta": delta,
            "significance": significance
        }
        
    except Exception as e:
        logger.error(f"Error in metrics comparison: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/metrics/alerts", response_model=AlertCheckResponse)
async def metrics_alerts(
    metric: str,
    op: str,
    threshold: float,
    window_days: int = 7,
    campaign_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    lang: Optional[str] = None,
    country: Optional[str] = None,
):
    """Check if a metric meets alert conditions"""
    try:
        rule = GoalRule(
            metric=metric, op=op, threshold=threshold, window_days=window_days,
            filters=SegmentFilters(days=window_days, campaign_id=campaign_id, agent_id=agent_id, lang=lang, country=country)
        )
        
        overview = await _build_metrics_overview(
            days=rule.window_days,
            campaign_id=rule.filters.campaign_id,
            agent_id=rule.filters.agent_id,
            lang=rule.filters.lang,
            country=rule.filters.country
        )
        
        f = overview["funnel"]
        current = {
            "booked_rate": f.get("booked_rate"),
            "qualified_rate": f.get("qualified_rate"),
            "connect_rate": f.get("connect_rate"),
            "cost_per_min": overview.get("cost_series", {}).get("avg_cost_per_min"),
            "dead_air": overview.get("qa", {}).get("dead_air_rate")
        }.get(rule.metric)

        op_fn = _safe_op(rule.op)
        status = "ALERT" if (op_fn and current is not None and op_fn(current, rule.threshold)) else "OK"

        return {
            "checks": [{
                "metric": rule.metric,
                "value": current,
                "op": rule.op,
                "threshold": rule.threshold,
                "status": status,
                "window_days": rule.window_days
            }],
            "filters": rule.filters.model_dump()
        }
        
    except Exception as e:
        logger.error(f"Error in metrics alerts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/analytics/insights")
async def analytics_insights(
    request: Request,
    days: int = 7,
    campaign_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    lang: Optional[str] = None,
    country: Optional[str] = None
):
    """Get AI-generated insights for coaching"""
    try:
        workspace_id = get_workspace_id(request, required=True)
        filters = SegmentFilters(days=days, campaign_id=campaign_id, agent_id=agent_id, lang=lang, country=country)
        overview = await _build_metrics_overview(
            days=filters.days,
            campaign_id=filters.campaign_id,
            agent_id=filters.agent_id,
            lang=filters.lang,
            country=filters.country
        )

        if DEMO_MODE:
            return {
                "period": f"{days}d",
                "highlights": ["+12% connect nella prima ora", "IT script: accorcia l'intro di ~8s"],
                "risks": ["Dead air >7s nel 22% delle call"],
                "actions": ["A/B opener breve", "Coaching su obiezione prezzo", "Filtro mobile-only 10–12"],
                "top_objections": [{"key":"price","share":0.28},{"key":"timing","share":0.22},{"key":"need","share":0.17}]
            }

        # Production: use gpt-4o-mini with few-shot prompt and cache
        # (pseudocode, reuse your centralized OpenAI client)
        text = {
            "booked_rate": overview["funnel"].get("booked_rate"),
            "qualified_rate": overview["funnel"].get("qualified_rate"),
            "connect_rate": overview["funnel"].get("connect_rate"),
            "dead_air": overview.get("qa", {}).get("dead_air_rate"),
            "cost_per_min": overview.get("cost_series", {}).get("avg_cost_per_min"),
        }
        insights = _ai_generate_insights(text, filters)  # implement with economic model and 24h cache
        return insights
        
    except Exception as e:
        logger.error(f"Error in analytics insights: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/metrics/export")
async def metrics_export(
    scope: str = "overview",
    format: str = "csv",
    days: int = 30,
    campaign_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    lang: Optional[str] = None,
    country: Optional[str] = None
):
    """Export metrics data in CSV or JSON format"""
    try:
        filters = SegmentFilters(days=days, campaign_id=campaign_id, agent_id=agent_id, lang=lang, country=country)
        
        if scope == "overview":
            data = await _build_metrics_overview(
                days=filters.days,
                campaign_id=filters.campaign_id,
                agent_id=filters.agent_id,
                lang=filters.lang,
                country=filters.country
            )
        elif scope == "timeseries":
            data = await get_timeseries_data(
                days=filters.days,
                campaign_id=filters.campaign_id,
                agent_id=filters.agent_id,
                lang=filters.lang,
                country=filters.country
            )
        elif scope == "outcomes":
            data = await get_outcomes_data(
                days=filters.days,
                campaign_id=filters.campaign_id,
                agent_id=filters.agent_id,
                lang=filters.lang,
                country=filters.country
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid scope")

        if format == "json":
            return data

        # CSV minimal (flatten top-level keys)
        import csv
        import io
        
        buf = io.StringIO()
        writer = csv.writer(buf)
        
        if scope == "overview":
            f = data["funnel"]
            writer.writerow(["reached","connected","qualified","booked","connect_rate","qualified_rate","booked_rate","avg_cost_per_min"])
            writer.writerow([
                f.get("reached"), f.get("connected"), f.get("qualified"), f.get("booked"),
                f.get("connect_rate"), f.get("qualified_rate"), f.get("booked_rate"),
                data.get("cost_series",{}).get("avg_cost_per_min")
            ])
        elif scope == "timeseries":
            writer.writerow(["date","reached","connected","qualified","booked","cost_per_min","spend_cents"])
            for p in data.get("series", []):
                writer.writerow([p.get("date"), p.get("reached"), p.get("connected"), p.get("qualified"), p.get("booked"), p.get("cost_per_min"), p.get("spend_cents")])
        elif scope == "outcomes":
            writer.writerow(["reason","count"])
            for r in data.get("by_reason", []):
                writer.writerow([r.get("key"), r.get("count")])

        buf.seek(0)
        return StreamingResponse(iter([buf.read()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{scope}.csv"'})
        
    except Exception as e:
        logger.error(f"Error in metrics export: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ===================== BACKEND API-ONLY (produzione) =====================
# NO SPA mount - servito separatamente da Vercel (app.agoralia.app)
# NO fallback custom - solo rotte API esplicite
logger.info("Backend configurato come API-only per Railway")

