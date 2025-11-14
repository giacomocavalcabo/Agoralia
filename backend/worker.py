import os
import asyncio
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any

import httpx
from config.database import engine
from sqlalchemy.orm import Session
from utils.helpers import _resolve_from_number

try:
    import dramatiq  # type: ignore
    from dramatiq.brokers.redis import RedisBroker  # type: ignore
except Exception:  # pragma: no cover
    dramatiq = None  # type: ignore


def _missing_queue() -> bool:
    return dramatiq is None


if not _missing_queue():
    # Configure Redis broker
    _redis_url = os.getenv("REDIS_URL")
    if not _redis_url:
        _redis = None  # type: ignore
    else:
        try:
            dramatiq.set_broker(RedisBroker(url=_redis_url))
        except Exception:
            pass

        try:
            import redis  # type: ignore
            _redis = redis.Redis.from_url(_redis_url, decode_responses=True)
        except Exception:
            _redis = None  # type: ignore

    @dramatiq.actor(max_retries=8)  # exponential backoff handled by broker config
    def start_phone_call(
        to_number: str,
        tenant_id: Optional[int],
        from_number: Optional[str],
        agent_id: Optional[str],
        metadata: Optional[Dict[str, Any]],
        spacing_ms: Optional[int] = None,
        kb: Optional[Dict[str, Any]] = None,
    ) -> None:
        api_key = os.getenv("RETELL_API_KEY")
        if not api_key:
            return
        base_url = os.getenv("RETELL_BASE_URL", "https://api.retellai.com")
        endpoint = f"{base_url}/v2/create-phone-call"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        
        # Resolve from_number with priority: explicit -> campaign -> settings -> env
        campaign_id = None
        lead_id = None
        if metadata:
            campaign_id = metadata.get("campaign_id")
            lead_id = metadata.get("lead_id")
        
        with Session(engine) as session:
            effective_from = _resolve_from_number(
                session,
                from_number=from_number,
                campaign_id=campaign_id,
                lead_id=lead_id,
                tenant_id=tenant_id,
            )
        
        if not effective_from:
            return
        
        body: Dict[str, Any] = {"to_number": to_number, "from_number": effective_from}
        if agent_id:
            body["agent_id"] = agent_id
        if metadata is not None:
            body["metadata"] = metadata
        if kb is not None:
            body.setdefault("metadata", {})
            body["metadata"]["kb"] = kb

        # pacing per-tenant via Redis key last ts
        try:
            if _redis is not None and tenant_id is not None:
                key = f"pace:last:{tenant_id}"
                last = _redis.get(key)
                gap = int(spacing_ms or int(os.getenv("DEFAULT_SPACING_MS", "0")))
                if last is not None and gap > 0:
                    now_ms = int(time.time() * 1000)
                    wait_ms = (int(last) + gap) - now_ms
                    if wait_ms > 0:
                        time.sleep(wait_ms / 1000.0)
                _redis.set(key, int(time.time() * 1000))
        except Exception:
            pass

        async def _run() -> None:
            async with httpx.AsyncClient(timeout=30) as client:
                try:
                    if _redis is not None:
                        _redis.incr("metrics:jobs:started")
                        if tenant_id is not None:
                            _redis.incr(f"metrics:jobs:started:{tenant_id}")
                    resp = await client.post(endpoint, headers=headers, json=body)
                    if _redis is not None:
                        _redis.incr("metrics:jobs:succeeded")
                except Exception:
                    if _redis is not None:
                        _redis.incr("metrics:jobs:failed")
                    raise

        asyncio.run(_run())


