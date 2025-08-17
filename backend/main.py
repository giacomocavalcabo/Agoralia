import os
from fastapi import FastAPI, Request, Header, HTTPException, Response
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


