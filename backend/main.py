import os
import json
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, Request, Header, HTTPException, Response
from fastapi import Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Callable, Any

try:
    # retell-sdk is optional during local dev, but required in prod for webhook verification
    from retell import Retell  # type: ignore
except Exception:  # pragma: no cover
    Retell = None  # type: ignore


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

