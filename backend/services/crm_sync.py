"""
CRM Sync Service - Orchestrates CRM synchronization operations
"""
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import secrets
import json
import logging
import time

from backend.db import get_db
from backend.models import (
    CrmConnection, CrmEntityLink, CrmSyncCursor, CrmSyncLog,
    CrmProvider, CrmConnectionStatus, CrmObjectType, CrmSyncDirection, CrmLogLevel,
    CrmWebhookEvent
)
from backend.integrations import HubSpotClient, ZohoClient, OdooClient
from backend.metrics import track_crm_operation, track_entities_synced, crm_requests_total, crm_errors_total, crm_sync_duration

logger = logging.getLogger(__name__)


class CrmSyncService:
    """Service for orchestrating CRM synchronization"""
    
    def __init__(self):
        self.clients = {
            CrmProvider.HUBSPOT.value: HubSpotClient,
            CrmProvider.ZOHO.value: ZohoClient,
            CrmProvider.ODOO.value: OdooClient
        }
    
    @track_crm_operation("crm_sync", "get_client")
    async def get_client(self, workspace_id: str, provider: str) -> Optional[Any]:
        """Get CRM client for workspace and provider"""
        try:
            db = next(get_db())
            connection = db.query(CrmConnection).filter(
                CrmConnection.workspace_id == workspace_id,
                CrmConnection.provider == provider,
                CrmConnection.status == CrmConnectionStatus.CONNECTED.value
            ).first()
            
            if not connection:
                logger.warning(f"No active connection found for {provider} in workspace {workspace_id}")
                return None
            
            # In production, decrypt tokens
            credentials = {
                "access_token": connection.access_token_enc,  # Decrypt in production
                "refresh_token": connection.refresh_token_enc,
                "expires_at": connection.expires_at,
                "base_url": connection.base_url,
                "account_id": connection.account_id,
                "dc_region": connection.dc_region
            }
            
            client_class = self.clients.get(provider)
            if not client_class:
                logger.error(f"Unknown CRM provider: {provider}")
                return None
            
            return client_class(workspace_id, credentials)
            
        except Exception as e:
            logger.error(f"Failed to get CRM client: {e}")
            # Track error metric
            crm_errors_total.labels(
                provider=provider,
                error_type=type(e).__name__,
                operation="get_client",
                code="client_error"
            ).inc()
            return None
        finally:
            db.close()
    
    @track_crm_operation("crm_sync", "pull_delta")
    async def pull_delta(self, workspace_id: str, provider: str, object_type: str, 
                         since: Optional[datetime] = None, cursor: Optional[str] = None) -> Dict[str, Any]:
        """Pull delta changes from CRM"""
        
        start_time = time.time()
        try:
            client = await self.get_client(workspace_id, provider)
            if not client:
                return {"success": False, "error": "No active connection"}
            
            # Track request metric
            crm_requests_total.labels(
                provider=provider,
                object=object_type,
                verb="GET",
                status="success"
            ).inc()
            
            # Get sync cursor
            db = next(get_db())
            sync_cursor = db.query(CrmSyncCursor).filter(
                CrmSyncCursor.workspace_id == workspace_id,
                CrmSyncCursor.provider == provider,
                CrmSyncCursor.object == object_type
            ).first()
            
            if not sync_cursor:
                # Create new cursor
                sync_cursor = CrmSyncCursor(
                    id=f"cursor_{secrets.token_urlsafe(8)}",
                    workspace_id=workspace_id,
                    provider=provider,
                    object=object_type,
                    since_ts=since or datetime.utcnow() - timedelta(days=1)
                )
                db.add(sync_cursor)
            
            # Pull data from CRM
            if object_type == CrmObjectType.CONTACT.value:
                entities = await client.pull_contacts({"since": sync_cursor.since_ts})
            elif object_type == CrmObjectType.COMPANY.value:
                entities = await client.pull_companies({"since": sync_cursor.since_ts})
            elif object_type == CrmObjectType.DEAL.value:
                entities = await client.pull_deals({"since": sync_cursor.since_ts})
            else:
                return {"success": False, "error": f"Unknown object type: {object_type}"}
            
            # Track entities synced
            if entities and "data" in entities:
                track_entities_synced(provider, object_type, "pull", len(entities["data"]))
            
            # Update cursor
            sync_cursor.since_ts = datetime.utcnow()
            sync_cursor.cursor_token = entities.get("next_cursor") if entities else None
            db.commit()
            
            return {
                "success": True,
                "provider": provider,
                "object_type": object_type,
                "entities_count": len(entities.get("data", [])),
                "next_cursor": entities.get("next_cursor"),
                "sync_cursor_id": sync_cursor.id
            }
            
        except Exception as e:
            logger.error(f"Failed to pull delta from {provider}: {e}")
            # Track error metric
            crm_errors_total.labels(
                provider=provider,
                error_type=type(e).__name__,
                operation="pull_delta",
                code="sync_error"
            ).inc()
            return {"success": False, "error": str(e)}
        finally:
            db.close()
            # Track duration metric
            duration = time.time() - start_time
            crm_sync_duration.labels(
                provider=provider,
                entity_type=object_type
            ).observe(duration)
    
    @track_crm_operation("crm_sync", "push_outcomes")
    async def push_outcomes(self, workspace_id: str, provider: str, call_id: str, 
                           call_data: Dict[str, Any]) -> Dict[str, Any]:
        """Push call outcomes to CRM"""
        
        start_time = time.time()
        try:
            client = await self.get_client(workspace_id, provider)
            if not client:
                return {"success": False, "error": "No active connection"}
            
            # Track request metric
            crm_requests_total.labels(
                provider=provider,
                object="call_outcome",
                verb="POST",
                status="success"
            ).inc()
            
            # Upsert contact
            contact_data = {
                "email": call_data.get("email"),
                "firstname": call_data.get("first_name"),
                "lastname": call_data.get("last_name"),
                "phone": call_data.get("phone")
            }
            contact_result = await client.upsert_contact(contact_data)
            
            # If company name exists, upsert company
            company_result = None
            if call_data.get("company_name"):
                company_data = {
                    "name": call_data.get("company_name"),
                    "phone": call_data.get("company_phone"),
                    "country": call_data.get("country")
                }
                company_result = await client.upsert_company(company_data)
                
                # Associate contact with company
                if contact_result.get("id") and company_result.get("id"):
                    await client.associate_contact_company(
                        contact_result["id"], company_result["id"]
                    )
            
            # Create deal if qualified
            deal_result = None
            if call_data.get("outcome") == "qualified" and call_data.get("budget"):
                deal_data = {
                    "dealname": f"Call Follow-up - {call_data.get('lead_name', 'Lead')}",
                    "amount": call_data.get("budget"),
                    "dealstage": "appointmentscheduled",
                    "closedate": (datetime.utcnow() + timedelta(days=30)).isoformat()
                }
                deal_result = await client.upsert_deal(deal_data)
            
            # Track entities synced
            entities_created = sum([
                bool(contact_result),
                bool(company_result),
                bool(deal_result)
            ])
            track_entities_synced(provider, "call_outcome", "push", entities_created)
            
            # Log sync operation
            self._log_sync(workspace_id, provider, CrmSyncDirection.PUSH.value, CrmObjectType.ACTIVITY.value, 
                          f"Pushed call outcome for {call_id}", {
                              "call_id": call_id,
                              "contact_created": bool(contact_result),
                              "company_created": bool(company_result),
                              "deal_created": bool(deal_result)
                          })
            
            return {
                "success": True,
                "call_id": call_id,
                "contact_created": bool(contact_result),
                "company_created": bool(company_result),
                "deal_created": bool(deal_result)
            }
            
        except Exception as e:
            logger.error(f"Push outcomes failed for {provider} call {call_id}: {e}")
            # Track error metric
            crm_errors_total.labels(
                provider=provider,
                error_type=type(e).__name__,
                operation="push_outcomes",
                code="push_error"
            ).inc()
            
            self._log_sync(workspace_id, provider, CrmSyncDirection.PUSH.value, CrmObjectType.ACTIVITY.value, 
                          f"Push failed: {str(e)}", {"error": str(e), "call_id": call_id}, level=CrmLogLevel.ERROR.value)
            return {"success": False, "error": str(e)}
        finally:
            # Track duration metric
            duration = time.time() - start_time
            crm_sync_duration.labels(
                provider=provider,
                entity_type="call_outcome"
            ).observe(duration)
    
    @track_crm_operation("crm_sync", "backfill")
    async def backfill(self, workspace_id: str, provider: str, object_type: str, 
                       limit: int = 1000) -> Dict[str, Any]:
        """Backfill data from CRM (first-time sync)"""
        
        start_time = time.time()
        try:
            client = await self.get_client(workspace_id, provider)
            if not client:
                return {"success": False, "error": "No active connection"}
            
            # Track request metric
            crm_requests_total.labels(
                provider=provider,
                object=object_type,
                verb="GET",
                status="success"
            ).inc()
            
            # Pull all data (with pagination if needed)
            if object_type == CrmObjectType.CONTACT.value:
                entities = await client.pull_contacts({"limit": limit})
            elif object_type == CrmObjectType.COMPANY.value:
                entities = await client.pull_companies({"limit": limit})
            elif object_type == CrmObjectType.DEAL.value:
                entities = await client.pull_deals({"limit": limit})
            else:
                return {"success": False, "error": f"Unknown object type: {object_type}"}
            
            # Track entities synced
            if entities and "data" in entities:
                track_entities_synced(provider, object_type, "pull", len(entities["data"]))
            
            # Log backfill operation
            self._log_sync(workspace_id, provider, CrmSyncDirection.PULL.value, object_type, 
                          f"Backfilled {len(entities.get('data', []))} {object_type}s", {"count": len(entities.get('data', [])), "backfill": True})
            
            return {
                "success": True,
                "count": len(entities.get("data", [])),
                "object_type": object_type,
                "provider": provider,
                "backfill": True
            }
            
        except Exception as e:
            logger.error(f"Backfill failed for {provider} {object_type}: {e}")
            # Track error metric
            crm_errors_total.labels(
                provider=provider,
                error_type=type(e).__name__,
                operation="backfill",
                code="backfill_error"
            ).inc()
            
            self._log_sync(workspace_id, provider, CrmSyncDirection.PULL.value, object_type, 
                          f"Backfill failed: {str(e)}", {"error": str(e), "backfill": True}, level=CrmLogLevel.ERROR.value)
            return {"success": False, "error": str(e)}
        finally:
            # Track duration metric
            duration = time.time() - start_time
            crm_sync_duration.labels(
                provider=provider,
                entity_type=object_type
            ).observe(duration)
    
    @track_crm_operation("crm_sync", "process_webhook")
    async def process_webhook(self, provider: str, event_id: str, payload: Dict[str, Any], timestamp: str) -> Dict[str, Any]:
        """Process CRM webhook events"""
        
        start_time = time.time()
        try:
            # Check if we've already processed this event (idempotency)
            existing_event = await self._check_webhook_idempotency(provider, event_id)
            if existing_event:
                return {
                    "success": True,
                    "message": "Event already processed",
                    "event_id": event_id,
                    "provider": provider,
                    "idempotent": True
                }
            
            # Track request metric
            crm_requests_total.labels(
                provider=provider,
                object="webhook",
                verb="POST",
                status="success"
            ).inc()
            
            # Parse webhook payload based on provider
            if provider == "hubspot":
                event_info = await self._parse_hubspot_webhook(payload)
            elif provider == "zoho":
                event_info = await self._parse_zoho_webhook(payload)
            else:
                return {"success": False, "error": f"Unsupported provider: {provider}"}
            
            # Process the webhook event
            result = await self._process_webhook_event(provider, event_info, timestamp)
            
            # Log webhook event
            await self._log_webhook_event(provider, event_id, payload, "processed")
            
            return {
                "success": True,
                "event_id": event_id,
                "provider": provider,
                "event_info": event_info,
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Webhook processing failed for {provider} event {event_id}: {e}")
            # Track error metric
            crm_errors_total.labels(
                provider=provider,
                error_type=type(e).__name__,
                operation="process_webhook",
                code="webhook_error"
            ).inc()
            
            # Log webhook event as failed
            await self._log_webhook_event(provider, event_id, payload, "failed")
            
            return {"success": False, "error": str(e)}
        finally:
            # Track duration metric
            duration = time.time() - start_time
            crm_sync_duration.labels(
                provider=provider,
                entity_type="webhook"
            ).observe(duration)
    
    async def _check_webhook_idempotency(self, provider: str, event_id: str) -> Optional[Dict[str, Any]]:
        """Check if webhook event has already been processed"""
        # In production, this would query the database
        # For now, return None (not processed)
        return None
    
    async def _parse_hubspot_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Parse HubSpot webhook payload"""
        return {
            "object_type": payload.get("objectType"),
            "object_id": payload.get("objectId"),
            "subscription_type": payload.get("subscriptionType"),
            "change_source": payload.get("changeSource"),
            "event_type": payload.get("eventType"),
            "occurred_at": payload.get("occurredAt")
        }
    
    async def _parse_zoho_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Zoho webhook payload"""
        return {
            "module": payload.get("module"),
            "operation": payload.get("operation"),
            "record_id": payload.get("record_id"),
            "old_values": payload.get("old_values", {}),
            "new_values": payload.get("new_values", {}),
            "timestamp": payload.get("timestamp")
        }
    
    async def _process_webhook_event(self, provider: str, event_info: Dict[str, Any], timestamp: str) -> Dict[str, Any]:
        """Process webhook event and update local data"""
        # In production, this would:
        # 1. Map CRM object to internal entity
        # 2. Update local database
        # 3. Create sync logs
        # 4. Trigger notifications if needed
        
        return {
            "provider": provider,
            "event_info": event_info,
            "processed_at": timestamp,
            "status": "processed"
        }
    
    async def _log_webhook_event(self, provider: str, event_id: str, payload: Dict[str, Any], status: str):
        """Log webhook event for monitoring"""
        try:
            db = next(get_db())
            webhook_event = CrmWebhookEvent(
                id=f"webhook_{secrets.token_urlsafe(8)}",
                workspace_id="ws_1",  # Default for now
                provider=provider,
                event_id=event_id,
                payload=payload,
                status=status,
                received_at=datetime.utcnow()
            )
            db.add(webhook_event)
            db.commit()
            logger.info(f"Webhook event logged: {provider} {event_id} - {status}")
        except Exception as e:
            logger.error(f"Failed to log webhook event: {e}")
        finally:
            db.close()

    # ===================== Idempotenza e Gestione Conflitti =====================
    
    def _generate_idempotency_key(self, provider: str, object_type: str, operation: str, data: Dict[str, Any]) -> str:
        """Generate stable idempotency key for CRM operations"""
        # Create a stable hash of the operation data
        import hashlib
        
        # Sort keys to ensure consistent hashing
        sorted_data = json.dumps(data, sort_keys=True, default=str)
        
        # Create hash from provider + object + operation + data
        hash_input = f"{provider}:{object_type}:{operation}:{sorted_data}"
        return hashlib.sha256(hash_input.encode()).hexdigest()
    
    async def _check_idempotency(self, workspace_id: str, provider: str, idempotency_key: str) -> Optional[Dict[str, Any]]:
        """Check if operation was already performed using idempotency key"""
        try:
            db = next(get_db())
            
            # Check recent sync logs for this idempotency key
            recent_log = db.query(CrmSyncLog).filter(
                CrmSyncLog.workspace_id == workspace_id,
                CrmSyncLog.provider == provider,
                CrmSyncLog.idempotency_key == idempotency_key,
                CrmSyncLog.created_at >= datetime.utcnow() - timedelta(hours=24)  # 24h window
            ).first()
            
            if recent_log:
                logger.info(f"Idempotency hit: {idempotency_key} already processed")
                return {
                    "idempotent": True,
                    "previous_result": recent_log.result,
                    "previous_timestamp": recent_log.created_at
                }
            
            return {"idempotent": False}
            
        except Exception as e:
            logger.error(f"Failed to check idempotency: {e}")
            return {"idempotent": False, "error": str(e)}
        finally:
            db.close()
    
    async def _resolve_conflicts(self, provider: str, object_type: str, local_data: Dict[str, Any], 
                                remote_data: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve conflicts between local and remote data using conflict resolution rules"""
        
        # Conflict resolution rules based on object type and provider
        if object_type == CrmObjectType.CONTACT.value:
            return self._resolve_contact_conflicts(provider, local_data, remote_data)
        elif object_type == CrmObjectType.COMPANY.value:
            return self._resolve_company_conflicts(provider, local_data, remote_data)
        elif object_type == CrmObjectType.DEAL.value:
            return self._resolve_deal_conflicts(provider, local_data, remote_data)
        else:
            # Default: prefer remote data
            return remote_data
    
    def _resolve_contact_conflicts(self, provider: str, local_data: Dict[str, Any], 
                                  remote_data: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve contact conflicts - CRM is source of truth for anagrafiche"""
        
        # For contacts, CRM is the authoritative source
        # Merge local data only for fields we control
        resolved = remote_data.copy()
        
        # Preserve our internal fields
        if "internal_notes" in local_data:
            resolved["internal_notes"] = local_data["internal_notes"]
        if "tags" in local_data:
            resolved["tags"] = local_data["tags"]
        
        # For critical fields, prefer CRM but log conflicts
        critical_fields = ["email", "phone", "first_name", "last_name"]
        for field in critical_fields:
            if field in local_data and field in remote_data:
                if local_data[field] != remote_data[field]:
                    logger.warning(f"Contact conflict on {field}: local={local_data[field]}, remote={remote_data[field]}")
                    # Prefer CRM data for critical fields
                    resolved[field] = remote_data[field]
        
        return resolved
    
    def _resolve_company_conflicts(self, provider: str, local_data: Dict[str, Any], 
                                  remote_data: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve company conflicts - CRM is source of truth for company data"""
        
        # Similar to contacts, CRM is authoritative for company data
        resolved = remote_data.copy()
        
        # Preserve our internal fields
        if "internal_notes" in local_data:
            resolved["internal_notes"] = local_data["internal_notes"]
        if "industry_tags" in local_data:
            resolved["industry_tags"] = local_data["industry_tags"]
        
        # For company fields, prefer CRM
        company_fields = ["name", "website", "industry", "size"]
        for field in company_fields:
            if field in local_data and field in remote_data:
                if local_data[field] != remote_data[field]:
                    logger.warning(f"Company conflict on {field}: local={local_data[field]}, remote={remote_data[field]}")
                    resolved[field] = remote_data[field]
        
        return resolved
    
    def _resolve_deal_conflicts(self, provider: str, local_data: Dict[str, Any], 
                               remote_data: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve deal conflicts - conservative merge approach"""
        
        # For deals, use conservative merge to avoid data loss
        resolved = remote_data.copy()
        
        # Preserve our internal fields
        if "internal_notes" in local_data:
            resolved["internal_notes"] = local_data["internal_notes"]
        if "qualification_score" in local_data:
            resolved["qualification_score"] = local_data["qualification_score"]
        
        # For deal fields, prefer non-empty values
        deal_fields = ["amount", "stage", "close_date", "probability"]
        for field in deal_fields:
            if field in local_data and field in remote_data:
                local_val = local_data[field]
                remote_val = remote_data[field]
                
                if local_val and not remote_val:
                    # Local has value, remote doesn't - use local
                    resolved[field] = local_val
                elif remote_val and not local_val:
                    # Remote has value, local doesn't - use remote
                    resolved[field] = remote_val
                elif local_val != remote_val:
                    # Both have values but different - log conflict and prefer remote
                    logger.warning(f"Deal conflict on {field}: local={local_val}, remote={remote_val}")
                    resolved[field] = remote_val
        
        return resolved
    
    async def _log_conflict_resolution(self, workspace_id: str, provider: str, object_type: str, 
                                     local_data: Dict[str, Any], remote_data: Dict[str, Any], 
                                     resolved_data: Dict[str, Any]):
        """Log conflict resolution for audit trail"""
        try:
            db = next(get_db())
            
            conflict_log = CrmSyncLog(
                id=f"conflict_{secrets.token_urlsafe(8)}",
                workspace_id=workspace_id,
                provider=provider,
                object=object_type,
                direction=CrmSyncDirection.BIDIRECTIONAL.value,
                level=CrmLogLevel.WARNING.value,
                message=f"Conflict resolved for {object_type}",
                details={
                    "local_data": local_data,
                    "remote_data": remote_data,
                    "resolved_data": resolved_data,
                    "resolution_rules": "CRM authoritative for anagrafiche, conservative merge for deals"
                },
                created_at=datetime.utcnow()
            )
            
            db.add(conflict_log)
            db.commit()
            logger.info(f"Conflict resolution logged for {provider} {object_type}")
            
        except Exception as e:
            logger.error(f"Failed to log conflict resolution: {e}")
        finally:
            db.close()

    # ===================== Polling Support (Odoo) =====================
    
    async def poll_odoo_changes(self, workspace_id: str, object_type: str, 
                                since: Optional[datetime] = None) -> Dict[str, Any]:
        """Poll Odoo for changes using write_date timestamp"""
        
        start_time = time.time()
        try:
            client = await self.get_client(workspace_id, "odoo")
            if not client:
                return {"success": False, "error": "No active Odoo connection"}
            
            # Track request metric
            crm_requests_total.labels(
                provider="odoo",
                object=object_type,
                verb="GET",
                status="success"
            ).inc()
            
            # Get last sync timestamp
            db = next(get_db())
            sync_cursor = db.query(CrmSyncCursor).filter(
                CrmSyncCursor.workspace_id == workspace_id,
                CrmSyncCursor.provider == "odoo",
                CrmSyncCursor.object == object_type
            ).first()
            
            if not sync_cursor:
                # Create new cursor
                sync_cursor = CrmSyncCursor(
                    id=f"cursor_{secrets.token_urlsafe(8)}",
                    workspace_id=workspace_id,
                    provider="odoo",
                    object=object_type,
                    since_ts=since or datetime.utcnow() - timedelta(days=1)
                )
                db.add(sync_cursor)
            
            # Poll for changes since last sync
            if object_type == CrmObjectType.CONTACT.value:
                entities = await client.pull_contacts({"since": sync_cursor.since_ts})
            elif object_type == CrmObjectType.COMPANY.value:
                entities = await client.pull_companies({"since": sync_cursor.since_ts})
            elif object_type == CrmObjectType.DEAL.value:
                entities = await client.pull_deals({"since": sync_cursor.since_ts})
            else:
                return {"success": False, "error": f"Unknown object type: {object_type}"}
            
            # Track entities synced
            if entities and "data" in entities:
                track_entities_synced("odoo", object_type, "pull", len(entities["data"]))
            
            # Update cursor with current timestamp
            sync_cursor.since_ts = datetime.utcnow()
            db.commit()
            
            return {
                "success": True,
                "provider": "odoo",
                "object_type": object_type,
                "entities_count": len(entities.get("data", [])),
                "since": sync_cursor.since_ts.isoformat(),
                "sync_cursor_id": sync_cursor.id
            }
            
        except Exception as e:
            logger.error(f"Odoo polling failed for {object_type}: {e}")
            # Track error metric
            crm_errors_total.labels(
                provider="odoo",
                error_type=type(e).__name__,
                operation="poll_odoo",
                code="polling_error"
            ).inc()
            return {"success": False, "error": str(e)}
        finally:
            db.close()
            # Track duration metric
            duration = time.time() - start_time
            crm_sync_duration.labels(
                provider="odoo",
                entity_type=object_type
            ).observe(duration)
    
    async def start_polling_scheduler(self, workspace_id: str, provider: str = "odoo"):
        """Start polling scheduler for providers that don't support webhooks"""
        
        if provider != "odoo":
            return {"success": False, "error": f"Polling not supported for {provider}"}
        
        try:
            # Schedule polling jobs for each object type
            from workers.crm_jobs import crm_polling_job
            
            object_types = [
                CrmObjectType.CONTACT.value,
                CrmObjectType.COMPANY.value,
                CrmObjectType.DEAL.value
            ]
            
            for object_type in object_types:
                # Schedule polling job every 5 minutes
                crm_polling_job.send(
                    workspace_id,
                    provider,
                    object_type,
                    datetime.utcnow().isoformat()
                )
            
            logger.info(f"Started polling scheduler for {provider} in workspace {workspace_id}")
            return {
                "success": True,
                "provider": provider,
                "workspace_id": workspace_id,
                "polling_interval": "5 minutes",
                "object_types": object_types
            }
            
        except Exception as e:
            logger.error(f"Failed to start polling scheduler: {e}")
            return {"success": False, "error": str(e)}

    def _log_sync(self, workspace_id: str, provider: str, direction: str, 
                  object_type: str, message: str, payload: Dict[str, Any] = None, 
                  level: str = 'info'):
        """Log CRM sync operation"""
        try:
            db = next(get_db())
            
            log_entry = CrmSyncLog(
                id=f"log_{secrets.token_urlsafe(8)}",
                workspace_id=workspace_id,
                provider=provider,
                level=level,
                object=object_type,
                direction=direction,
                correlation_id=secrets.token_urlsafe(8),
                message=message,
                payload_json=payload or {},
                created_at=datetime.utcnow()
            )
            
            db.add(log_entry)
            db.commit()
            
        except Exception as e:
            logger.error(f"Failed to log sync operation: {e}")
        finally:
            db.close()


# Global instance
crm_sync_service = CrmSyncService()
