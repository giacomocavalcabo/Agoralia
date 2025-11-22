"""
Dramatiq worker for processing background jobs.
This module is imported by dramatiq CLI to run workers.
"""
import os
import asyncio
import time
import urllib.parse
from datetime import datetime, timezone, timedelta
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
    
    
    @dramatiq.actor(max_retries=3, time_limit=300000)  # 5 minutes timeout
    def process_phone_number_renewals() -> None:
        """Process monthly phone number renewals
        
        This actor runs daily to:
        1. Check phone numbers due for renewal (30 days from purchased_at)
        2. Send alerts at -5, -4, -3, -2, -1 days before renewal
        3. On day 30, check budget and either renew or delete number
        
        Should be scheduled to run once per day via cron or scheduler.
        """
        from datetime import datetime, timezone, timedelta
        from models.agents import PhoneNumber
        from models.compliance import CostEvent
        from services.enforcement import _tenant_monthly_spend_cents
        from services.workspace_settings import get_workspace_settings
        from utils.retell import get_retell_api_key, retell_delete_json
        import logging
        
        logger = logging.getLogger(__name__)
        logger.info("[process_phone_number_renewals] Starting daily phone number renewal check")
        
        now = datetime.now(timezone.utc)
        today = now.date()
        
        async def _delete_from_retell(e164: str, tenant_id: Optional[int]) -> bool:
            """Delete phone number from RetellAI (async helper)"""
            try:
                await retell_delete_json(f"/delete-phone-number/{urllib.parse.quote(e164)}", tenant_id=tenant_id)
                logger.info(f"[process_phone_number_renewals] Deleted number {e164} from RetellAI")
                return True
            except Exception as e:
                logger.error(f"[process_phone_number_renewals] Error deleting number from RetellAI: {e}")
                return False
        
        with Session(engine) as session:
            # Get all active phone numbers (type='retell' means purchased from RetellAI)
            phone_numbers = session.query(PhoneNumber).filter(
                PhoneNumber.type == "retell",
                PhoneNumber.verified == 1,
                PhoneNumber.purchased_at.isnot(None),  # Only numbers with purchase date
            ).all()
            
            logger.info(f"[process_phone_number_renewals] Found {len(phone_numbers)} phone numbers to check")
            
            for phone_number in phone_numbers:
                try:
                    if not phone_number.purchased_at:
                        continue
                    
                    # Calculate days until renewal
                    renewal_date = phone_number.purchased_at + timedelta(days=30)
                    days_until_renewal = (renewal_date.date() - today).days
                    
                    if days_until_renewal < 0:
                        days_until_renewal = 0
                    
                    logger.info(f"[process_phone_number_renewals] Number {phone_number.e164}: {days_until_renewal} days until renewal (renewal_date: {renewal_date.date()})")
                    
                    # Get tenant_id and monthly cost
                    tenant_id = phone_number.tenant_id
                    monthly_cost_cents = phone_number.monthly_cost_cents or 200  # Default $2/month
                    
                    if days_until_renewal == 0:
                        # Day 30 - process renewal or deletion
                        logger.info(f"[process_phone_number_renewals] Processing renewal for number {phone_number.e164}")
                        
                        if tenant_id is None:
                            logger.warning(f"[process_phone_number_renewals] Number {phone_number.e164} has no tenant_id, skipping")
                            continue
                        
                        # Check budget (use same session)
                        workspace_settings = get_workspace_settings(tenant_id, session)
                        budget_cents = workspace_settings.budget_monthly_cents
                        
                        if budget_cents and budget_cents > 0:
                            spent_cents = _tenant_monthly_spend_cents(session, tenant_id)
                            remaining_budget = budget_cents - spent_cents
                            
                            if remaining_budget >= monthly_cost_cents:
                                # Sufficient budget - renew number
                                logger.info(f"[process_phone_number_renewals] Renewing number {phone_number.e164} (cost: ${monthly_cost_cents/100:.2f}, remaining budget: ${remaining_budget/100:.2f})")
                                
                                # Record renewal cost
                                renewal_cost_event = CostEvent(
                                    call_id=None,
                                    component="telephony",
                                    amount=monthly_cost_cents,
                                    currency="USD",
                                    ts=now,
                                )
                                session.add(renewal_cost_event)
                                
                                # Update purchased_at to now (reset 30-day cycle)
                                phone_number.purchased_at = now
                                phone_number.next_renewal_at = now + timedelta(days=30)
                                phone_number.updated_at = now
                                
                                session.commit()
                                logger.info(f"[process_phone_number_renewals] Successfully renewed number {phone_number.e164}")
                                
                                # Broadcast renewal event (optional, may not exist)
                                try:
                                    from utils.websocket import manager as ws_manager
                                    ws_manager.broadcast({
                                        "type": "phone_number.renewed",
                                        "data": {
                                            "phone_number": phone_number.e164,
                                            "tenant_id": tenant_id,
                                            "monthly_cost_cents": monthly_cost_cents,
                                            "next_renewal_at": phone_number.next_renewal_at.isoformat(),
                                        }
                                    })
                                except Exception:
                                    pass
                            else:
                                # Insufficient budget - delete number
                                logger.warning(f"[process_phone_number_renewals] Insufficient budget for renewal. Deleting number {phone_number.e164} (cost: ${monthly_cost_cents/100:.2f}, remaining budget: ${remaining_budget/100:.2f})")
                                
                                e164_to_delete = phone_number.e164
                                
                                # Delete from RetellAI first (async)
                                asyncio.run(_delete_from_retell(e164_to_delete, tenant_id))
                                
                                # Delete from local database
                                session.delete(phone_number)
                                session.commit()
                                logger.info(f"[process_phone_number_renewals] Deleted number {e164_to_delete} from local database")
                                
                                # Broadcast deletion event (optional)
                                try:
                                    from utils.websocket import manager as ws_manager
                                    ws_manager.broadcast({
                                        "type": "phone_number.deleted",
                                        "data": {
                                            "phone_number": e164_to_delete,
                                            "tenant_id": tenant_id,
                                            "reason": "insufficient_budget",
                                            "monthly_cost_cents": monthly_cost_cents,
                                            "remaining_budget_cents": remaining_budget,
                                        }
                                    })
                                except Exception:
                                    pass
                        else:
                            # No budget configured - delete number
                            logger.warning(f"[process_phone_number_renewals] No budget configured for tenant {tenant_id}. Deleting number {phone_number.e164}")
                            
                            e164_to_delete = phone_number.e164
                            
                            # Delete from RetellAI first (async)
                            asyncio.run(_delete_from_retell(e164_to_delete, tenant_id))
                            
                            # Delete from local database
                            session.delete(phone_number)
                            session.commit()
                            
                            # Broadcast deletion event (optional)
                            try:
                                from utils.websocket import manager as ws_manager
                                ws_manager.broadcast({
                                    "type": "phone_number.deleted",
                                    "data": {
                                        "phone_number": e164_to_delete,
                                        "tenant_id": tenant_id,
                                        "reason": "no_budget_configured",
                                    }
                                })
                            except Exception:
                                pass
                    
                    elif days_until_renewal in [1, 2, 3, 4, 5]:
                        # Send renewal alert (-5, -4, -3, -2, -1 days)
                        logger.info(f"[process_phone_number_renewals] Sending renewal alert for number {phone_number.e164} ({days_until_renewal} days until renewal)")
                        
                        # Broadcast alert event (optional)
                        try:
                            from utils.websocket import manager as ws_manager
                            ws_manager.broadcast({
                                "type": "phone_number.renewal_alert",
                                "data": {
                                    "phone_number": phone_number.e164,
                                    "tenant_id": tenant_id,
                                    "days_until_renewal": days_until_renewal,
                                    "renewal_date": renewal_date.date().isoformat(),
                                    "monthly_cost_cents": monthly_cost_cents,
                                    "monthly_cost_usd": monthly_cost_cents / 100.0,
                                }
                            })
                        except Exception:
                            pass
                    
                except Exception as e:
                    import traceback
                    logger.error(f"[process_phone_number_renewals] Error processing number {phone_number.e164}: {e}\n{traceback.format_exc()}")
                    continue
            
            logger.info("[process_phone_number_renewals] Daily renewal check completed")


