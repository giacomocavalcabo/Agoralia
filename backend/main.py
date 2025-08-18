import os
from fastapi import FastAPI, Request, Header, HTTPException, Response
from fastapi import Query
from fastapi.middleware.cors import CORSMiddleware

try:
    # retell-sdk is optional during local dev, but required in prod for webhook verification
    from retell import Retell  # type: ignore
except Exception:  # pragma: no cover
    Retell = None  # type: ignore


app = FastAPI(title="Agoralia API", version="0.1.0")


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return {"scheduled": True, "payload": payload}


@app.post("/schedule/bulk")
async def schedule_bulk(payload: dict) -> dict:
    return {"scheduled": len(payload.get("lead_ids", []))}


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
    return {"id": "c_new"}


@app.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str) -> dict:
    return {"id": campaign_id, "name": "Sample", "status": "active"}


@app.patch("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, payload: dict) -> dict:
    return {"id": campaign_id, "updated": True}


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
                {"id": "sch_100", "kind": "scheduled", "title": "Call A", "at": e1.isoformat()},
                {"id": "sch_200", "kind": "scheduled", "title": "Call B", "at": e2.isoformat()},
                {"id": "blk_1", "kind": "blocked", "title": "Quiet hours", "at": day.replace(hour=7).isoformat(), "end": day.replace(hour=8).isoformat()},
            ]
        }
    except Exception:
        return {"events": []}


@app.patch("/schedule/{schedule_id}")
async def update_schedule(schedule_id: str, payload: dict) -> dict:
    # Demo validation: block hours outside 8-18 with QUIET_HOURS
    try:
        from datetime import datetime, timezone, timedelta
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
        return {"id": schedule_id, "at": at_dt.isoformat(), "updated": True}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")

