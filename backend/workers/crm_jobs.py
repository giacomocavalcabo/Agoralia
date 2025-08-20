"""
CRM Jobs - Dramatiq actors for CRM operations
"""
import dramatiq
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime
import logging

from services.crm_sync import crm_sync_service
from ..models import CrmProvider, CrmObjectType, CrmSyncDirection, CrmLogLevel
from config.crm import crm_config
import os

# Job configuration
MAX_RETRIES = int(os.getenv("CRM_JOB_MAX_RETRIES", "3"))
RETRY_DELAY_BASE = int(os.getenv("CRM_JOB_RETRY_DELAY", "300000"))  # 5 minutes in ms

logger = logging.getLogger(__name__)


@dramatiq.actor(queue_name='crm_pull')
def crm_pull_delta_job(workspace_id: str, provider: str, object_type: str, 
                        since: Optional[str] = None, cursor: Optional[str] = None):
    """Pull delta changes from CRM"""
    try:
        logger.info(f"Starting delta pull for {provider} {object_type} in workspace {workspace_id}")
        
        # Parse since timestamp if provided
        since_dt = None
        if since:
            since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
        
        # Run async operation
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                crm_sync_service.pull_delta(workspace_id, provider, object_type, since_dt, cursor)
            )
            
            if result["success"]:
                logger.info(f"Delta pull completed: {result['count']} {object_type}s from {provider}")
            else:
                logger.error(f"Delta pull failed: {result['error']}")
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Delta pull job failed: {e}")
        raise dramatiq.Retry(delay=RETRY_DELAY_BASE)


@dramatiq.actor(queue_name='crm_push')
def crm_push_outcomes_job(workspace_id: str, provider: str, call_id: str, call_data: Dict[str, Any]):
    """Push call outcomes to CRM"""
    try:
        logger.info(f"Starting push outcomes for call {call_id} to {provider}")
        
        # Run async operation
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                crm_sync_service.push_outcomes(workspace_id, provider, call_id, call_data)
            )
            
            if result["success"]:
                logger.info(f"Push outcomes completed for call {call_id} to {provider}")
            else:
                logger.error(f"Push outcomes failed: {result['error']}")
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Push outcomes job failed: {e}")
        raise dramatiq.Retry(delay=RETRY_DELAY_BASE)


@dramatiq.actor(queue_name='crm_backfill')
def crm_backfill_job(workspace_id: str, provider: str, object_type: str, limit: int = 1000):
    """Backfill data from CRM (first-time sync)"""
    try:
        logger.info(f"Starting backfill for {provider} {object_type} in workspace {workspace_id}")
        
        # Run async operation
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                crm_sync_service.backfill(workspace_id, provider, object_type, limit)
            )
            
            if result["success"]:
                logger.info(f"Backfill completed: {result['count']} {object_type}s from {provider}")
            else:
                logger.error(f"Backfill failed: {result['error']}")
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Backfill job failed: {e}")
        raise dramatiq.Retry(delay=RETRY_DELAY_BASE * 2)  # Longer delay for backfill


@dramatiq.actor(queue_name='crm_webhook')
def crm_webhook_dispatcher_job(provider: str, event_id: str, payload: Dict[str, Any], timestamp: str):
    """Process incoming webhook events from CRM providers"""
    try:
        from services.crm_sync import CrmSyncService
        
        crm_sync_service = CrmSyncService()
        result = asyncio.run(crm_sync_service.process_webhook(provider, event_id, payload, timestamp))
        
        print(f"Webhook processed: {provider} {event_id} - {result}")
        return result
        
    except Exception as e:
        print(f"Webhook processing failed: {e}")
        raise


@dramatiq.actor(queue_name='crm-polling')
def crm_polling_job(workspace_id: str, provider: str, object_type: str, since: str):
    """Poll CRM for changes (for providers without webhooks like Odoo)"""
    try:
        from services.crm_sync import CrmSyncService
        
        crm_sync_service = CrmSyncService()
        
        if provider == "odoo":
            result = asyncio.run(crm_sync_service.poll_odoo_changes(workspace_id, object_type))
        else:
            result = {"success": False, "error": f"Polling not supported for {provider}"}
        
        print(f"Polling completed: {provider} {object_type} - {result}")
        return result
        
    except Exception as e:
        print(f"Polling failed: {e}")
        raise


@dramatiq.actor(queue_name='crm-scheduler')
def crm_scheduler_job(workspace_id: str, provider: str):
    """Start/stop CRM synchronization scheduler"""
    try:
        from services.crm_sync import CrmSyncService
        
        crm_sync_service = CrmSyncService()
        
        if provider == "odoo":
            result = asyncio.run(crm_sync_service.start_polling_scheduler(workspace_id, provider))
        else:
            result = {"success": False, "error": f"Scheduler not supported for {provider}"}
        
        print(f"Scheduler started: {provider} - {result}")
        return result
        
    except Exception as e:
        print(f"Scheduler failed: {e}")
        raise


@dramatiq.actor(queue_name='crm_sync')
def crm_sync_job(workspace_id: str, provider: str, mode: str, 
                  objects: Optional[list] = None, backfill: bool = False):
    """General CRM sync job (legacy compatibility)"""
    try:
        logger.info(f"Starting {mode} sync for {provider} in workspace {workspace_id}")
        
        if not objects:
            objects = ['contact', 'company', 'deal']
        
        results = {}
        
        for obj in objects:
            try:
                if mode == 'pull' or mode == 'both':
                    if backfill:
                        # Queue backfill job
                        crm_backfill_job.send(workspace_id, provider, obj)
                        results[obj] = "backfill_queued"
                    else:
                        # Queue delta pull job
                        crm_pull_delta_job.send(workspace_id, provider, obj)
                        results[obj] = "pull_queued"
                
                if mode == 'push' or mode == 'both':
                    # Note: Push requires specific data, so we don't auto-queue it
                    results[obj] = "push_manual_only"
                    
            except Exception as e:
                logger.error(f"Failed to queue sync for {obj}: {e}")
                results[obj] = f"error: {str(e)}"
        
        logger.info(f"Sync jobs queued: {results}")
        return results
        
    except Exception as e:
        logger.error(f"CRM sync job failed: {e}")
        raise dramatiq.Retry(delay=RETRY_DELAY_BASE)
