"""Metrics endpoints"""
from typing import Dict, Any
from fastapi import APIRouter

from utils.redis_client import get_redis

router = APIRouter()


@router.get("/metrics/jobstats")
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

