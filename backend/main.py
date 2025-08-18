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
                {"id": "sch_100", "kind": "scheduled", "title": "Call A", "at": e1.isoformat()},
                {"id": "sch_200", "kind": "scheduled", "title": "Call B", "at": e2.isoformat()},
                {"id": "blk_1", "kind": "blocked", "title": "Quiet hours", "at": day.replace(hour=7).isoformat(), "end": day.replace(hour=8).isoformat()},
                {"id": "wrn_1", "kind": "warn", "title": "Budget nearing 80%", "at": day.replace(hour=12).isoformat()},
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
            raise HTTPException(status_code=409, detail={"code": "CONCURRENCY", "message": "No free slots"})
        return {"id": schedule_id, "at": at_dt.isoformat(), "updated": True}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")


# ===================== Sprint 4 stubs =====================

@app.get("/analytics/overview")
def analytics_overview() -> dict:
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
def analytics_export_json() -> dict:
    return analytics_overview()


@app.get("/analytics/export.csv")
def analytics_export_csv() -> Response:
    csv_content = "metric,value\ncalls,1240\nconnected_rate,0.62\n"
    return Response(content=csv_content, media_type="text/csv")


@app.get("/history")
def history_list(limit: int = 25, offset: int = 0) -> dict:
    return {
        "total": 2,
        "items": [
            {"id": "call_9001", "ts": "2025-08-17T09:22:00Z", "direction": "outbound", "to": "+390212345678", "from": "+390298765432", "company": "Rossi Srl", "lang": "it-IT", "agent": "it-outbound-a", "outcome": "qualified", "duration_sec": 210, "cost_eur": 0.42},
            {"id": "call_9002", "ts": "2025-08-17T09:25:00Z", "direction": "outbound", "to": "+33123456789", "from": "+33987654321", "company": "Dubois SA", "lang": "fr-FR", "agent": "fr-outbound-a", "outcome": "no_answer", "duration_sec": 0, "cost_eur": 0.0},
        ],
    }


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
def history_export_csv() -> Response:
    csv_content = "id,ts,direction,to,from,cost_eur\ncall_9001,2025-08-17T09:22:00Z,outbound,+390212345678,+390298765432,0.42\n"
    return Response(content=csv_content, media_type="text/csv")


@app.get("/campaigns/{campaign_id}/leads")
def campaign_leads(campaign_id: str, limit: int = 25, offset: int = 0) -> dict:
    items = [
        {"id":"l_101","name":"Mario Rossi","phone_e164":"+390212345678","status":"pending"},
        {"id":"l_102","name":"Claire Dubois","phone_e164":"+33123456789","status":"scheduled"},
    ]
    return {"total": len(items), "items": items}

