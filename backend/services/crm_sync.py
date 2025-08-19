"""
CRM Sync Service - Orchestrates CRM synchronization operations
"""
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import secrets
import json
import logging

from db import get_db
from models import CrmConnection, CrmEntityLink, CrmSyncCursor, CrmSyncLog
from integrations import HubSpotClient, ZohoClient, OdooClient
from metrics import track_crm_operation, track_entities_synced

logger = logging.getLogger(__name__)


class CrmSyncService:
    """Service for orchestrating CRM synchronization"""
    
    def __init__(self):
        self.clients = {
            'hubspot': HubSpotClient,
            'zoho': ZohoClient,
            'odoo': OdooClient
        }
    
    async def get_client(self, workspace_id: str, provider: str) -> Optional[Any]:
        """Get CRM client for workspace and provider"""
        try:
            db = next(get_db())
            connection = db.query(CrmConnection).filter(
                CrmConnection.workspace_id == workspace_id,
                CrmConnection.provider == provider,
                CrmConnection.status == 'connected'
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
            return None
        finally:
            db.close()
    
    async def pull_delta(self, workspace_id: str, provider: str, object_type: str, 
                         since: Optional[datetime] = None, cursor: Optional[str] = None) -> Dict[str, Any]:
        """Pull delta changes from CRM"""
        
        client = await self.get_client(workspace_id, provider)
        if not client:
            return {"success": False, "error": "No active connection"}
        
        try:
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
            if object_type == 'contact':
                entities = await client.pull_contacts({"since": sync_cursor.since_ts})
            elif object_type == 'company':
                entities = await client.pull_companies({"since": sync_cursor.since_ts})
            elif object_type == 'deal':
                entities = await client.pull_deals({"since": sync_cursor.since_ts})
            else:
                return {"success": False, "error": f"Unknown object type: {object_type}"}
            
            # Update cursor
            sync_cursor.since_ts = datetime.utcnow()
            sync_cursor.updated_at = datetime.utcnow()
            
            # Log sync operation
            self._log_sync(workspace_id, provider, 'pull', object_type, 
                          f"Pulled {len(entities)} {object_type}s", {"count": len(entities)})
            
            # Track metrics
            track_entities_synced(provider, object_type, 'pull', len(entities))
            
            db.commit()
            
            return {
                "success": True,
                "count": len(entities),
                "object_type": object_type,
                "provider": provider,
                "since": sync_cursor.since_ts.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Delta pull failed for {provider} {object_type}: {e}")
            self._log_sync(workspace_id, provider, 'pull', object_type, 
                          f"Pull failed: {str(e)}", {"error": str(e)}, level='error')
            return {"success": False, "error": str(e)}
        finally:
            db.close()
    
    async def push_outcomes(self, workspace_id: str, provider: str, call_id: str, 
                           call_data: Dict[str, Any]) -> Dict[str, Any]:
        """Push call outcomes to CRM"""
        
        client = await self.get_client(workspace_id, provider)
        if not client:
            return {"success": False, "error": "No active connection"}
        
        try:
            # Create activity from call data
            activity_data = {
                "kind": "call",
                "when": call_data.get("ended_at", datetime.utcnow().isoformat()),
                "text": call_data.get("summary", "Call completed"),
                "recording_url": call_data.get("recording_url"),
                "transcript_url": call_data.get("transcript_url"),
                "outcome": call_data.get("outcome", "completed"),
                "next_action": call_data.get("next_action"),
                "owner_email": call_data.get("agent_email")
            }
            
            # Push activity to CRM
            # Note: This would require extending the client interfaces to support activities
            # For now, we'll create a contact/company if they don't exist
            
            # Extract contact info
            contact_data = {
                "email": call_data.get("lead_email"),
                "phone": call_data.get("lead_phone"),
                "firstname": call_data.get("lead_name", "").split()[0] if call_data.get("lead_name") else "",
                "lastname": " ".join(call_data.get("lead_name", "").split()[1:]) if call_data.get("lead_name") else "",
                "company": call_data.get("company_name")
            }
            
            # Upsert contact
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
            
            # Log sync operation
            self._log_sync(workspace_id, provider, 'push', 'activity', 
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
            self._log_sync(workspace_id, provider, 'push', 'activity', 
                          f"Push failed: {str(e)}", {"error": str(e), "call_id": call_id}, level='error')
            return {"success": False, "error": str(e)}
    
    async def backfill(self, workspace_id: str, provider: str, object_type: str, 
                       limit: int = 1000) -> Dict[str, Any]:
        """Backfill data from CRM (first-time sync)"""
        
        client = await self.get_client(workspace_id, provider)
        if not client:
            return {"success": False, "error": "No active connection"}
        
        try:
            # Pull all data (with pagination if needed)
            if object_type == 'contact':
                entities = await client.pull_contacts({"limit": limit})
            elif object_type == 'company':
                entities = await client.pull_companies({"limit": limit})
            elif object_type == 'deal':
                entities = await client.pull_deals({"limit": limit})
            else:
                return {"success": False, "error": f"Unknown object type: {object_type}"}
            
            # Log backfill operation
            self._log_sync(workspace_id, provider, 'pull', object_type, 
                          f"Backfilled {len(entities)} {object_type}s", {"count": len(entities), "backfill": True})
            
            # Track metrics
            track_entities_synced(provider, object_type, 'pull', len(entities))
            
            return {
                "success": True,
                "count": len(entities),
                "object_type": object_type,
                "provider": provider,
                "backfill": True
            }
            
        except Exception as e:
            logger.error(f"Backfill failed for {provider} {object_type}: {e}")
            self._log_sync(workspace_id, provider, 'pull', object_type, 
                          f"Backfill failed: {str(e)}", {"error": str(e), "backfill": True}, level='error')
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
