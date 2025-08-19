"""
CRM Jobs - Dramatiq actors for CRM operations
"""
import dramatiq
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime
import logging

from services.crm_sync import crm_sync_service
from models import CrmProvider, CrmObjectType, CrmSyncDirection, CrmLogLevel

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
        raise dramatiq.Retry(delay=300000)  # Retry in 5 minutes


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
        raise dramatiq.Retry(delay=300000)  # Retry in 5 minutes


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
        raise dramatiq.Retry(delay=600000)  # Retry in 10 minutes


@dramatiq.actor(queue_name='crm_webhook')
def crm_webhook_dispatcher_job(event_id: str, provider: str, workspace_id: str, 
                               payload: Dict[str, Any]):
    """Process CRM webhook events"""
    try:
        logger.info(f"Processing webhook event {event_id} from {provider}")
        
        # In production, this would:
        # 1. Parse webhook payload
        # 2. Map to internal entities
        # 3. Update local data
        # 4. Create sync logs
        
        # For now, just log the event
        logger.info(f"Webhook processed: {event_id} from {provider} for workspace {workspace_id}")
        
    except Exception as e:
        logger.error(f"Webhook dispatcher job failed: {e}")
        raise dramatiq.Retry(delay=300000)  # Retry in 5 minutes


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
        raise dramatiq.Retry(delay=300000)  # Retry in 5 minutes
