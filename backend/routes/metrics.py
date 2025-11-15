"""Metrics endpoints"""
import os
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request
from sqlalchemy.orm import Session

from utils.redis_client import get_redis
from utils.auth import extract_tenant_id
from config.database import engine
from models.calls import CallRecord
from models.compliance import CostEvent

router = APIRouter()


def _iso_to_date_str(iso_ts: str) -> str:
    """Convert ISO timestamp to date string"""
    try:
        dt = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
        return dt.date().isoformat()
    except Exception:
        return datetime.now(timezone.utc).date().isoformat()


def _live_calls_count(tenant_id: Optional[int] = None) -> int:
    """Count live calls"""
    with Session(engine) as session:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
        q = session.query(CallRecord).filter(
            CallRecord.created_at >= cutoff,
            CallRecord.status != "ended"
        )
        if tenant_id is not None:
            q = q.filter(CallRecord.tenant_id == tenant_id)
        return q.count()


# Import EVENTS from misc module (shared with webhooks)
try:
    from .misc import EVENTS
except ImportError:
    EVENTS: List[Dict[str, Any]] = []


@router.get("/jobstats")
async def metrics_jobstats() -> Dict[str, Any]:
    """Get job statistics from Redis"""
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


@router.get("/daily")
async def metrics_daily(days: int = 7) -> Dict[str, Any]:
    """Get daily call metrics"""
    days = max(1, min(days, 60))
    now = datetime.now(timezone.utc).date()
    start = now - timedelta(days=days - 1)
    labels: List[str] = [
        (start + timedelta(days=i)).isoformat() for i in range(days)
    ]
    counts_created = {d: 0 for d in labels}
    counts_finished = {d: 0 for d in labels}

    # Use in-memory events for quick stats (fallback to DB if empty)
    created_types = {"call.created", "webcall.created"}
    finished_types = {"call.finished", "webcall.finished"}

    if EVENTS:
        for ev in EVENTS:
            d = _iso_to_date_str(ev.get("ts") or datetime.now(timezone.utc).isoformat())
            if d not in counts_created:
                continue
            if ev.get("type") in created_types:
                counts_created[d] += 1
            if ev.get("type") in finished_types:
                counts_finished[d] += 1
    else:
        # Fallback to DB if events list is empty
        with Session(engine) as session:
            cutoff = datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc)
            rows = session.query(CallRecord).filter(CallRecord.created_at >= cutoff).all()
            for r in rows:
                d = r.created_at.date().isoformat()
                if d in counts_created:
                    counts_created[d] += 1
                if r.status == "ended" and d in counts_finished:
                    counts_finished[d] += 1

    created = [counts_created[d] for d in labels]
    finished = [counts_finished[d] for d in labels]
    rate = [
        (finished[i] / created[i] * 100.0) if created[i] > 0 else 0.0 for i in range(days)
    ]
    return {"labels": labels, "created": created, "finished": finished, "rate": rate}


@router.get("/outcomes")
async def metrics_outcomes(request: Request, days: int = 7) -> Dict[str, Any]:
    """Get call outcomes metrics"""
    days = max(1, min(days, 60))
    tenant_id = extract_tenant_id(request)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    with Session(engine) as session:
        q = session.query(CallRecord).filter(CallRecord.created_at >= cutoff)
        if tenant_id is not None:
            q = q.filter(CallRecord.tenant_id == tenant_id)
        rows = q.all()
        
        outcomes_map: Dict[str, int] = {}
        for r in rows:
            outcome = r.disposition_outcome or "unknown"
            outcomes_map[outcome] = outcomes_map.get(outcome, 0) + 1
        
        labels = list(outcomes_map.keys())
        counts = [outcomes_map[k] for k in labels]
        
        return {"labels": labels, "counts": counts}


@router.get("/account/concurrency")
async def metrics_account_concurrency(request: Request) -> Dict[str, Any]:
    """Get account concurrency metrics"""
    plan_limit = int(os.getenv("PLAN_CONCURRENCY_LIMIT", "5"))
    tenant_id = extract_tenant_id(request)
    in_use = _live_calls_count(tenant_id=tenant_id)
    return {"limit": plan_limit, "in_use": in_use, "available": max(0, plan_limit - in_use)}


@router.get("/errors/24h")
async def metrics_errors_24h() -> Dict[str, Any]:
    """Get errors count in last 24 hours"""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    count = 0
    
    # Count from events list
    if EVENTS:
        for ev in EVENTS:
            ts_str = ev.get("ts")
            if not ts_str:
                continue
            try:
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if ts >= cutoff and ev.get("type") in {"error", "call.failed", "webhook.failed"}:
                    count += 1
            except Exception:
                pass
    
    # Also check webhook DLQ
    r = get_redis()
    if r is not None:
        try:
            vals = r.lrange("dlq:webhooks:retell", 0, 199)
            for v in vals:
                try:
                    obj = json.loads(v)
                    ts_str = obj.get("ts")
                    if ts_str:
                        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                        if ts >= cutoff:
                            count += 1
                except Exception:
                    pass
        except Exception:
            pass
    
    return {"errors_24h": count}


@router.get("/cost/today")
async def metrics_cost_today(request: Request) -> Dict[str, Any]:
    """Get cost for today"""
    tenant_id = extract_tenant_id(request)
    today = datetime.now(timezone.utc).date()
    total_cents = 0
    
    with Session(engine) as session:
        q = session.query(CostEvent)
        if tenant_id is not None:
            # Note: CostEvent might not have tenant_id, so we filter by date only for now
            pass
        rows = q.all()
        for r in rows:
            dt = (r.ts or datetime.now(timezone.utc)).date()
            if dt == today:
                total_cents += int(r.amount or 0)
    
    return {"amount": round(total_cents / 100.0, 4), "currency": "EUR"}


@router.get("/latency/p95")
async def metrics_latency_p95() -> Dict[str, Any]:
    """Get P95 latency for calls (placeholder - requires real latency tracking)"""
    # Placeholder: return 0 for now
    # TODO: Implement real latency tracking from call records or events
    return {"p95_ms": 0}

