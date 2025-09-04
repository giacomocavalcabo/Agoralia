"""
CRM Router - Consolidated routes for all CRM providers
"""
from fastapi import APIRouter, Depends, Query, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import secrets
import json
import os
import hmac
import hashlib

from backend.db import get_db
from backend.models import (
    CrmConnection, CrmFieldMapping, CrmSyncCursor, CrmSyncLog,
    CrmProvider, CrmConnectionStatus, CrmObjectType, CrmSyncDirection, CrmLogLevel, CrmWebhookStatus,
    Call, CallOutcome, CrmWebhookEvent
)
from backend.integrations import HubSpotClient, ZohoClient, OdooClient
from backend.deps.auth import get_tenant_id, require_workspace_access, require_admin, get_current_user

router = APIRouter(prefix="/crm", tags=["CRM"])


# ===================== Provider Management =====================

@router.get("/providers")
async def get_crm_providers(workspace_id: str = Query(default="ws_1")) -> dict:
    """Get available CRM providers and their status for workspace"""
    return {
        "workspace_id": workspace_id,
        "providers": [
            {
                "id": "hubspot",
                "name": "HubSpot",
                "description": "Cloud-based CRM with marketing automation",
                "features": ["contacts", "companies", "deals", "activities", "webhooks"],
                "auth_type": "oauth"
            },
            {
                "id": "zoho",
                "name": "Zoho CRM",
                "description": "Multi-datacenter CRM solution",
                "features": ["contacts", "accounts", "deals", "activities", "polling"],
                "auth_type": "oauth"
            },
            {
                "id": "odoo",
                "description": "Open-source CRM and ERP",
                "features": ["partners", "leads", "activities", "polling"],
                "auth_type": "api_key"
            }
        ]
    }


# ===================== HubSpot Routes =====================

@router.get("/hubspot/start")
async def hubspot_start(
    request: Request,
    workspace_id: str = Query(default="ws_1"),
    user=Depends(get_current_user)
) -> dict:
    """Start HubSpot OAuth flow"""
    
    # Get HubSpot client ID from environment
    client_id = os.getenv("CRM_HUBSPOT_CLIENT_ID")
    redirect_uri = os.getenv("CRM_HUBSPOT_REDIRECT_URI", "https://app.agoralia.app/api/crm/hubspot/callback")
    scopes = os.getenv("CRM_HUBSPOT_SCOPES", "crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.companies.write")
    
    if not client_id:
        raise HTTPException(status_code=500, detail="HubSpot client ID not configured")
    
    # Generate CSRF state token
    state = secrets.token_urlsafe(32)
    
    # Store state in session for validation
    request.session["hubspot_oauth_state"] = state
    request.session["hubspot_workspace_id"] = workspace_id
    
    # Build OAuth URL
    auth_url = (
        f"https://app.hubspot.com/oauth/authorize?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"scope={scopes.replace(' ', '%20')}&"
        f"state={state}"
    )
    
    return {
        "auth_url": auth_url,
        "workspace_id": workspace_id,
        "provider": "hubspot"
    }


@router.get("/hubspot/callback")
async def hubspot_callback(
    code: str, 
    state: str, 
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
) -> RedirectResponse:
    """Handle HubSpot OAuth callback"""
    
    # Validate state parameter
    stored_state = request.session.get("hubspot_oauth_state")
    if not stored_state or stored_state != state:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    workspace_id = request.session.get("hubspot_workspace_id", "ws_1")
    
    # Get HubSpot credentials
    client_id = os.getenv("CRM_HUBSPOT_CLIENT_ID")
    client_secret = os.getenv("CRM_HUBSPOT_CLIENT_SECRET")
    redirect_uri = os.getenv("CRM_HUBSPOT_REDIRECT_URI", "https://app.agoralia.app/api/crm/hubspot/callback")
    
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="HubSpot credentials not configured")
    
    # Exchange code for tokens
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://api.hubapi.com/oauth/v1/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": client_id,
                    "client_secret": client_secret
                }
            )
            token_response.raise_for_status()
            token_data = token_response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to exchange code for tokens: {str(e)}")
    
    # Save tokens to database
    from backend.models import ProviderAccount
    from backend.utils.encryption import encrypt_str
    
    # Check if account already exists
    account = db.query(ProviderAccount).filter(
        ProviderAccount.workspace_id == workspace_id,
        ProviderAccount.provider == "hubspot",
        ProviderAccount.category == "crm"
    ).first()
    
    if not account:
        account = ProviderAccount(
            workspace_id=workspace_id,
            provider="hubspot",
            category="crm",
            auth_type="oauth2",
            status="connected",
            label="HubSpot"
        )
        db.add(account)
    
    # Save encrypted tokens
    account.access_token_encrypted = encrypt_str(token_data["access_token"])
    if "refresh_token" in token_data:
        account.refresh_token_encrypted = encrypt_str(token_data["refresh_token"])
    
    # Calculate expiration time
    expires_in = token_data.get("expires_in", 3600)
    account.expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    
    # Save additional data
    account.scopes = token_data.get("scope", "")
    account.external_id = token_data.get("hub_id", "")
    
    db.commit()
    
    # Clear session state
    request.session.pop("hubspot_oauth_state", None)
    request.session.pop("hubspot_workspace_id", None)
    
    # Redirect back to frontend
    return RedirectResponse(
        url=f"https://app.agoralia.app/settings/integrations?hubspot=connected",
        status_code=303
    )


@router.post("/hubspot/disconnect")
async def hubspot_disconnect(
    workspace_id: str = Query(default="ws_1"),
    db: Session = Depends(get_db)
) -> dict:
    """Disconnect HubSpot CRM"""
    # In production, revoke tokens and update status
    return {
        "message": "HubSpot disconnected successfully",
        "workspace_id": workspace_id
    }


# ===================== Zoho Routes =====================

@router.get("/zoho/start")
async def zoho_start(workspace_id: str = Query(default="ws_1")) -> dict:
    """Start Zoho OAuth flow"""
    
    # Get Zoho credentials from environment
    client_id = os.getenv("CRM_ZOHO_CLIENT_ID")
    redirect_uri = os.getenv("CRM_ZOHO_REDIRECT_URI", "https://api.agoralia.app/crm/zoho/callback")
    dc_region = os.getenv("CRM_ZOHO_DC", "eu")
    
    if not client_id:
        raise HTTPException(status_code=500, detail="Zoho client ID not configured")
    
    # Build OAuth URL based on data center
    base_url = f"https://accounts.zoho.{dc_region}"
    auth_url = (
        f"{base_url}/oauth/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"scope=ZohoCRM.modules.ALL&"
        f"response_type=code&"
        f"state={workspace_id}"
    )
    
    return {
        "auth_url": auth_url,
        "workspace_id": workspace_id,
        "provider": "zoho",
        "dc_region": dc_region
    }


@router.get("/zoho/callback")
async def zoho_callback(
    code: str, 
    state: str,
    dc: str = Query(default="com"),
    workspace_id: str = Query(default="ws_1")
) -> dict:
    """Handle Zoho OAuth callback"""
    return {
        "message": "Zoho CRM connected successfully",
        "dc": dc,
        "workspace_id": workspace_id
    }


@router.post("/zoho/disconnect")
async def zoho_disconnect(workspace_id: str = Query(default="ws_1")) -> dict:
    """Disconnect Zoho CRM"""
    return {
        "message": "Zoho CRM disconnected successfully",
        "workspace_id": workspace_id
    }


# ===================== Odoo Routes =====================

@router.get("/odoo/start")
async def odoo_start(workspace_id: str = Query(default="ws_1")) -> dict:
    """Start Odoo connection setup"""
    
    # Get Odoo configuration from environment
    base_url = os.getenv("ODOO_BASE_URL")
    database = os.getenv("ODOO_DB")
    
    if not base_url or not database:
        raise HTTPException(status_code=500, detail="Odoo configuration not complete")
    
    return {
        "base_url": base_url,
        "database": database,
        "workspace_id": workspace_id,
        "provider": "odoo",
        "auth_type": "api_key",
        "setup_required": True
    }


@router.post("/odoo/connect")
async def odoo_connect(
    payload: dict,
    workspace_id: str = Query(default="ws_1")
) -> dict:
    """Connect to Odoo CRM"""
    required_fields = ["base_url", "database", "username", "password"]
    
    for field in required_fields:
        if field not in payload:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # In production, test connection and save credentials
    return {
        "message": "Odoo CRM connected successfully",
        "url": payload["base_url"],
        "database": payload["database"],
        "workspace_id": workspace_id
    }


@router.post("/odoo/disconnect")
async def odoo_disconnect(workspace_id: str = Query(default="ws_1")) -> dict:
    """Disconnect Odoo CRM"""
    return {
        "message": "Odoo CRM disconnected successfully",
        "workspace_id": workspace_id
    }


# ===================== Field Mapping =====================

@router.get("/mapping")
async def get_crm_mapping(
    provider: str = Query(..., description="CRM provider: hubspot, zoho, odoo"),
    object: str = Query(..., description="Object type: contact, company, deal, activity"),
    workspace_id: str = Query(default="ws_1")
) -> dict:
    """Get CRM field mapping for specific provider and object"""
    
    # Default mappings per provider
    default_mappings = {
        "hubspot": {
            "contact": {
                "email": "email",
                "phone_e164": "phone",
                "first_name": "firstname",
                "last_name": "lastname",
                "title": "jobtitle",
                "country_iso": "country",
                "company_id": "company"
            },
            "company": {
                "name": "name",
                "domain": "domain",
                "phone": "phone",
                "country_iso": "country",
                "vat": "vat_number",
                "address": "address"
            },
            "deal": {
                "title": "dealname",
                "amount_cents": "amount",
                "currency": "currency",
                "stage": "dealstage",
                "pipeline": "pipeline"
            }
        },
        "zoho": {
            "contact": {
                "email": "Email",
                "phone_e164": "Phone",
                "first_name": "First_Name",
                "last_name": "Last_Name",
                "title": "Title",
                "country_iso": "Mailing_Country",
                "company_id": "Account_Name"
            },
            "company": {
                "name": "Account_Name",
                "domain": "Website",
                "phone": "Phone",
                "country_iso": "Billing_Country",
                "vat": "VAT",
                "address": "Billing_Street"
            },
            "deal": {
                "title": "Deal_Name",
                "amount_cents": "Amount",
                "currency": "Currency",
                "stage": "Stage",
                "pipeline": "Pipeline"
            }
        },
        "odoo": {
            "contact": {
                "email": "email",
                "phone_e164": "phone",
                "first_name": "name (first part)",
                "last_name": "name (last part)",
                "title": "function",
                "country_iso": "country_id",
                "company_id": "parent_id"
            },
            "company": {
                "name": "name",
                "domain": "website",
                "phone": "phone",
                "country_iso": "country_id",
                "vat": "vat",
                "address": "street"
            },
            "deal": {
                "title": "name",
                "amount_cents": "expected_revenue",
                "currency": "currency_id",
                "stage": "stage_id",
                "pipeline": "pipeline_id"
            }
        }
    }
    
    mapping = default_mappings.get(provider, {}).get(object, {})
    
    return {
        "workspace_id": workspace_id,
        "provider": provider,
        "object": object,
        "mapping": mapping,
        "picklists": {}  # Will be populated from CRM
    }


@router.patch("/mapping")
async def update_crm_mapping(
    payload: dict,
    db: Session = Depends(get_db)
) -> dict:
    """Update CRM field mapping"""
    
    required_fields = ["workspace_id", "provider", "object", "mapping_json"]
    for field in required_fields:
        if field not in payload:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Validate mapping structure
    if not isinstance(payload["mapping_json"], dict):
        raise HTTPException(status_code=400, detail="mapping_json must be a dictionary")
    
    # Save or update mapping
    existing = db.query(CrmFieldMapping).filter(
        CrmFieldMapping.workspace_id == payload["workspace_id"],
        CrmFieldMapping.provider == payload["provider"],
        CrmFieldMapping.object == payload["object"]
    ).first()
    
    if existing:
        existing.mapping_json = payload["mapping_json"]
        existing.updated_at = datetime.utcnow()
        if "picklists_json" in payload:
            existing.picklists_json = payload["picklists_json"]
    else:
        mapping_record = CrmFieldMapping(
            id=f"mapping_{secrets.token_urlsafe(16)}",
            workspace_id=payload["workspace_id"],
            provider=payload["provider"],
            object=payload["object"],
            mapping_json=payload["mapping_json"],
            picklists_json=payload.get("picklists_json")
        )
        db.add(mapping_record)
    
    db.commit()
    
    return {
        "message": "CRM mapping updated successfully",
        "workspace_id": payload["workspace_id"],
        "provider": payload["provider"],
        "object": payload["object"]
    }


# ===================== Health & Status =====================

@router.get("/health")
async def get_crm_health(
    provider: str = Query(..., description="CRM provider"),
    workspace_id: str = Query(default="ws_1")
) -> dict:
    """Get CRM connection health and status"""
    
    # Mock health check - in production, test actual connection
    health_status = {
        "status": "connected",
        "provider": provider,
        "workspace_id": workspace_id,
        "rate_limit": {
            "remaining": 9500,
            "reset_at": "2025-01-20T12:00:00Z"
        },
        "scopes": ["contacts", "deals", "companies"],
        "account_info": {
            "name": f"Demo {provider.title()} Account",
            "id": "12345"
        },
        "last_sync": "2025-01-20T10:30:00Z"
    }
    
    return health_status


# ===================== Health Check =====================

@router.get("/health")
async def crm_health_check(
    provider: str = Query(..., description="CRM provider (hubspot, zoho, odoo)"),
    workspace_id: str = Query(default="ws_1"),
    db: Session = Depends(get_db)
) -> dict:
    """Check CRM connection health and get account information"""
    
    try:
        from services.crm_sync import CrmSyncService
        
        crm_sync_service = CrmSyncService()
        client = await crm_sync_service.get_client(workspace_id, provider)
        
        if not client:
            return {
                "status": "unhealthy",
                "provider": provider,
                "workspace_id": workspace_id,
                "error": "No active connection",
                "timestamp": datetime.utcnow().isoformat()
            }
        
        # Test connection with a light API call
        try:
            health_result = await client.healthcheck()
            
            # Get connection details
            connection = db.query(CrmConnection).filter(
                CrmConnection.workspace_id == workspace_id,
                CrmConnection.provider == provider
            ).first()
            
            return {
                "status": "healthy",
                "provider": provider,
                "workspace_id": workspace_id,
                "connection_status": connection.status if connection else "unknown",
                "account_info": health_result,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": provider,
                "workspace_id": workspace_id,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
            
    except Exception as e:
        return {
            "status": "error",
            "provider": provider,
            "workspace_id": workspace_id,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# ===================== Admin Operations =====================

@router.post("/admin/replay-webhook")
async def replay_webhook(
    provider: str = Query(..., description="CRM provider"),
    event_id: str = Query(..., description="Webhook event ID to replay"),
    workspace_id: str = Query(default="ws_1"),
    db: Session = Depends(get_db),
    admin_user: bool = Depends(require_admin)
) -> dict:
    """Admin endpoint to replay a webhook event (safe replay)"""
    
    try:
        # Check if webhook event exists
        webhook_event = db.query(CrmWebhookEvent).filter(
            CrmWebhookEvent.provider == provider,
            CrmWebhookEvent.event_id == event_id
        ).first()
        
        if not webhook_event:
            raise HTTPException(status_code=404, detail="Webhook event not found")
        
        # Check if event was already processed successfully
        if webhook_event.status == "processed":
            return {
                "success": True,
                "message": "Event already processed successfully",
                "event_id": event_id,
                "provider": provider,
                "status": "already_processed"
            }
        
        # Replay the webhook event
        from services.crm_sync import CrmSyncService
        
        crm_sync_service = CrmSyncService()
        result = await crm_sync_service.process_webhook(
            provider, 
            event_id, 
            webhook_event.payload, 
            webhook_event.received_at.isoformat()
        )
        
        # Update webhook event status
        webhook_event.status = "replayed"
        webhook_event.updated_at = datetime.utcnow()
        db.commit()
        
        return {
            "success": True,
            "message": "Webhook event replayed successfully",
            "event_id": event_id,
            "provider": provider,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Replay failed: {str(e)}")


@router.post("/admin/pause-sync")
async def pause_crm_sync(
    provider: str = Query(..., description="CRM provider"),
    workspace_id: str = Query(default="ws_1"),
    pause: bool = Query(True, description="True to pause, False to resume"),
    db: Session = Depends(get_db),
    admin_user: bool = Depends(require_admin)
) -> dict:
    """Admin endpoint to pause/resume CRM synchronization"""
    
    try:
        # Find CRM connection
        connection = db.query(CrmConnection).filter(
            CrmConnection.workspace_id == workspace_id,
            CrmConnection.provider == provider
        ).first()
        
        if not connection:
            raise HTTPException(status_code=404, detail="CRM connection not found")
        
        # Update kill switch
        connection.kill_switch = pause
        connection.updated_at = datetime.utcnow()
        db.commit()
        
        action = "paused" if pause else "resumed"
        return {
            "success": True,
            "message": f"CRM sync {action} for {provider}",
            "provider": provider,
            "workspace_id": workspace_id,
            "kill_switch": pause
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Operation failed: {str(e)}")


@router.get("/admin/sync-status")
async def get_admin_sync_status(
    workspace_id: str = Query(default="ws_1"),
    db: Session = Depends(get_db),
    admin_user: bool = Depends(require_admin)
) -> dict:
    """Admin endpoint to get detailed sync status for all providers"""
    
    try:
        # Get all CRM connections for workspace
        connections = db.query(CrmConnection).filter(
            CrmConnection.workspace_id == workspace_id
        ).all()
        
        # Get recent sync logs
        recent_logs = db.query(CrmSyncLog).filter(
            CrmSyncLog.workspace_id == workspace_id,
            CrmSyncLog.created_at >= datetime.utcnow() - timedelta(hours=24)
        ).order_by(CrmSyncLog.created_at.desc()).limit(50).all()
        
        # Get webhook events
        webhook_events = db.query(CrmWebhookEvent).filter(
            CrmWebhookEvent.workspace_id == workspace_id,
            CrmWebhookEvent.received_at >= datetime.utcnow() - timedelta(hours=24)
        ).order_by(CrmWebhookEvent.received_at.desc()).limit(20).all()
        
        return {
            "success": True,
            "workspace_id": workspace_id,
            "connections": [
                {
                    "provider": conn.provider,
                    "status": conn.status,
                    "sync_enabled": conn.sync_enabled,
                    "kill_switch": conn.kill_switch,
                    "last_sync": conn.updated_at.isoformat() if conn.updated_at else None
                }
                for conn in connections
            ],
            "recent_syncs": [
                {
                    "provider": log.provider,
                    "object": log.object,
                    "direction": log.direction,
                    "level": log.level,
                    "message": log.message,
                    "timestamp": log.created_at.isoformat()
                }
                for log in recent_logs
            ],
            "webhook_events": [
                {
                    "provider": event.provider,
                    "event_id": event.event_id,
                    "status": event.status,
                    "received_at": event.received_at.isoformat()
                }
                for event in webhook_events
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status retrieval failed: {str(e)}")


# ===================== Mapping Presets =====================

@router.get("/presets/{provider}")
async def get_crm_presets(
    provider: str,
    workspace_id: str = Query(default="ws_1")
) -> dict:
    """Get default field mapping presets for a CRM provider"""
    
    try:
        from config.crm_presets import get_all_presets
        
        presets = get_all_presets(provider)
        
        return {
            "success": True,
            "provider": provider,
            "workspace_id": workspace_id,
            "presets": presets
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get presets: {str(e)}")


@router.post("/presets/{provider}/apply")
async def apply_crm_presets(
    provider: str,
    object_type: str = Query(..., description="Object type (contact, company, deal)"),
    workspace_id: str = Query(default="ws_1"),
    db: Session = Depends(get_db)
) -> dict:
    """Apply default field mapping presets for a CRM provider"""
    
    try:
        from config.crm_presets import get_mapping_preset
        
        # Get default mapping
        default_mapping = get_mapping_preset(provider, object_type)
        
        # Find or create field mapping record
        field_mapping = db.query(CrmFieldMapping).filter(
            CrmFieldMapping.workspace_id == workspace_id,
            CrmFieldMapping.provider == provider,
            CrmFieldMapping.object_type == object_type
        ).first()
        
        if field_mapping:
            # Update existing mapping
            field_mapping.field_mappings = default_mapping
            field_mapping.updated_at = datetime.utcnow()
        else:
            # Create new mapping
            field_mapping = CrmFieldMapping(
                id=f"mapping_{secrets.token_urlsafe(8)}",
                workspace_id=workspace_id,
                provider=provider,
                object_type=object_type,
                field_mappings=default_mapping,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(field_mapping)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Applied default mapping for {provider} {object_type}",
            "provider": provider,
            "object_type": object_type,
            "workspace_id": workspace_id,
            "field_mappings": default_mapping
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply presets: {str(e)}")


# ===================== Metrics =====================

@router.get("/metrics")
async def get_crm_metrics(
    workspace_id: str = Query(default="ws_1"),
    provider: Optional[str] = Query(None, description="Filter by CRM provider"),
    db: Session = Depends(get_db)
) -> dict:
    """Get CRM synchronization metrics"""
    
    try:
        # Get sync statistics
        sync_stats = db.query(CrmSyncLog).filter(
            CrmSyncLog.workspace_id == workspace_id
        )
        
        if provider:
            sync_stats = sync_stats.filter(CrmSyncLog.provider == provider)
        
        # Count by status
        success_count = sync_stats.filter(CrmSyncLog.level == "info").count()
        error_count = sync_stats.filter(CrmSyncLog.level == "error").count()
        warning_count = sync_stats.filter(CrmSyncLog.level == "warning").count()
        
        # Count by direction
        pull_count = sync_stats.filter(CrmSyncLog.direction == "pull").count()
        push_count = sync_stats.filter(CrmSyncLog.direction == "push").count()
        
        # Count by object type
        contact_count = sync_stats.filter(CrmSyncLog.object == "contact").count()
        company_count = sync_stats.filter(CrmSyncLog.object == "company").count()
        deal_count = sync_stats.filter(CrmSyncLog.object == "deal").count()
        
        # Get recent activity
        recent_activity = sync_stats.order_by(CrmSyncLog.created_at.desc()).limit(20).all()
        
        return {
            "success": True,
            "workspace_id": workspace_id,
            "provider": provider,
            "metrics": {
                "total_syncs": success_count + error_count + warning_count,
                "successful_syncs": success_count,
                "failed_syncs": error_count,
                "warnings": warning_count,
                "pull_operations": pull_count,
                "push_operations": push_count,
                "by_object_type": {
                    "contacts": contact_count,
                    "companies": company_count,
                    "deals": deal_count
                }
            },
            "recent_activity": [
                {
                    "provider": log.provider,
                    "object": log.object,
                    "direction": log.direction,
                    "level": log.level,
                    "message": log.message,
                    "timestamp": log.created_at.isoformat()
                }
                for log in recent_activity
            ],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# ===================== Sync Operations =====================

@router.post("/sync/start")
async def start_crm_sync(
    payload: dict,
    workspace_id: str = Query(default="ws_1")
) -> dict:
    """Start CRM sync operation"""
    
    required_fields = ["provider", "mode"]
    for field in required_fields:
        if field not in payload:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Validate mode
    valid_modes = ["pull", "push", "both"]
    if payload["mode"] not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Must be one of: {valid_modes}")
    
    # In production, queue background job
    job_id = f"crm_sync_{payload['provider']}_{secrets.token_urlsafe(8)}"
    
    return {
        "message": "CRM sync job queued",
        "job_id": job_id,
        "provider": payload["provider"],
        "mode": payload["mode"],
        "workspace_id": workspace_id
    }


@router.get("/sync/status")
async def get_sync_status(
    provider: str = Query(..., description="CRM provider"),
    workspace_id: str = Query(default="ws_1")
) -> dict:
    """Get CRM sync status and cursors"""
    
    # Mock sync status - in production, fetch from database
    sync_status = {
        "workspace_id": workspace_id,
        "provider": provider,
        "last_sync": "2025-01-20T10:30:00Z",
        "status": "idle",
        "cursors": {
            "contact": {
                "since": "2025-01-20T10:00:00Z",
                "cursor": "abc123",
                "last_count": 25
            },
            "company": {
                "since": "2025-01-20T09:00:00Z",
                "cursor": "def456",
                "last_count": 10
            },
            "deal": {
                "since": "2025-01-20T08:00:00Z",
                "cursor": "ghi789",
                "last_count": 5
            }
        }
    }
    
    return sync_status


# ===================== Webhooks =====================

@router.post("/webhooks/hubspot")
async def hubspot_webhook(request: Request) -> dict:
    """Handle HubSpot webhook events with signature verification"""
    
    # Get webhook secret from environment
    webhook_secret = os.getenv("CRM_HUBSPOT_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")
    
    # Get request body and headers
    body = await request.body()
    headers = dict(request.headers)
    
    # Verify HubSpot signature
    signature = headers.get("x-hubspot-signature")
    if not signature:
        raise HTTPException(status_code=401, detail="Missing HubSpot signature")
    
    # Verify signature using HMAC SHA256
    
    expected_signature = hmac.new(
        webhook_secret.encode('utf-8'),
        body,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=401, detail="Invalid HubSpot signature")
    
    try:
        # Parse webhook payload
        payload = json.loads(body.decode('utf-8'))
        
        # Extract event information
        event_id = payload.get("eventId")
        subscription_type = payload.get("subscriptionType")
        object_type = payload.get("objectType")
        
        # Log webhook event
        print(f"HubSpot webhook verified: {subscription_type} for {object_type}")
        
        # Queue webhook processing job
        from workers.crm_jobs import crm_webhook_dispatcher_job
        crm_webhook_dispatcher_job.send(
            "hubspot", 
            event_id, 
            payload,
            datetime.utcnow().isoformat()
        )
        
        return {
            "status": "received",
            "provider": "hubspot",
            "event_id": event_id,
            "subscription_type": subscription_type,
            "object_type": object_type,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except Exception as e:
        # Log error but don't expose details
        print(f"HubSpot webhook processing error: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")


@router.post("/webhooks/zoho")
async def zoho_webhook(request: Request) -> dict:
    """Handle Zoho webhook events with secret verification"""
    
    # Get webhook secret from environment
    webhook_secret = os.getenv("CRM_ZOHO_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")
    
    # Get request body and headers
    body = await request.body()
    headers = dict(request.headers)
    
    # Verify Zoho webhook secret
    received_secret = headers.get("x-zoho-webhook-secret")
    if not received_secret:
        raise HTTPException(status_code=401, detail="Missing Zoho webhook secret")
    
    if not hmac.compare_digest(received_secret, webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid Zoho webhook secret")
    
    try:
        # Parse webhook payload
        payload = json.loads(body.decode('utf-8'))
        
        # Extract event information
        event_id = payload.get("event_id") or f"zoho_{datetime.utcnow().timestamp()}"
        module = payload.get("module")
        operation = payload.get("operation")
        
        # Log webhook event
        print(f"Zoho webhook verified: {operation} on {module}")
        
        # Queue webhook processing job
        from workers.crm_jobs import crm_webhook_dispatcher_job
        crm_webhook_dispatcher_job.send(
            "zoho", 
            event_id, 
            payload,
            datetime.utcnow().isoformat()
        )
        
        return {
            "status": "received",
            "provider": "zoho",
            "event_id": event_id,
            "module": module,
            "operation": operation,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except Exception as e:
        print(f"Zoho webhook processing error: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")


# ===================== Polling Support (Odoo) =====================

@router.post("/odoo/poll")
async def start_odoo_polling(
    workspace_id: str = Query(default="ws_1"),
    object_type: str = Query(..., description="Object type to poll (contact, company, deal)"),
    db: Session = Depends(get_db)
) -> dict:
    """Start polling Odoo for changes"""
    
    try:
        from services.crm_sync import CrmSyncService
        
        crm_sync_service = CrmSyncService()
        result = await crm_sync_service.poll_odoo_changes(workspace_id, object_type)
        
        return {
            "success": True,
            "operation": "odoo_polling",
            "workspace_id": workspace_id,
            "object_type": object_type,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Polling failed: {str(e)}")


@router.post("/odoo/scheduler/start")
async def start_odoo_scheduler(
    workspace_id: str = Query(default="ws_1"),
    db: Session = Depends(get_db)
) -> dict:
    """Start Odoo polling scheduler"""
    
    try:
        from services.crm_sync import CrmSyncService
        
        crm_sync_service = CrmSyncService()
        result = await crm_sync_service.start_polling_scheduler(workspace_id, "odoo")
        
        return {
            "success": True,
            "operation": "odoo_scheduler_start",
            "workspace_id": workspace_id,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scheduler start failed: {str(e)}")


@router.get("/odoo/status")
async def get_odoo_status(
    workspace_id: str = Query(default="ws_1"),
    db: Session = Depends(get_db)
) -> dict:
    """Get Odoo synchronization status"""
    
    try:
        # Get sync cursors for Odoo
        cursors = db.query(CrmSyncCursor).filter(
            CrmSyncCursor.workspace_id == workspace_id,
            CrmSyncCursor.provider == "odoo"
        ).all()
        
        # Get recent sync logs
        recent_logs = db.query(CrmSyncLog).filter(
            CrmSyncLog.workspace_id == workspace_id,
            CrmSyncLog.provider == "odoo",
            CrmSyncLog.created_at >= datetime.utcnow() - timedelta(hours=24)
        ).order_by(CrmSyncLog.created_at.desc()).limit(10).all()
        
        return {
            "success": True,
            "provider": "odoo",
            "workspace_id": workspace_id,
            "sync_cursors": [
                {
                    "object": cursor.object,
                    "since_ts": cursor.since_ts.isoformat() if cursor.since_ts else None,
                    "cursor_token": cursor.cursor_token,
                    "updated_at": cursor.updated_at.isoformat() if cursor.updated_at else None
                }
                for cursor in cursors
            ],
            "recent_logs": [
                {
                    "object": log.object,
                    "direction": log.direction,
                    "level": log.level,
                    "message": log.message,
                    "created_at": log.created_at.isoformat()
                }
                for log in recent_logs
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status retrieval failed: {str(e)}")


# ===================== Test Connections =====================

@router.post("/test")
async def test_crm_connection(
    payload: dict,
    workspace_id: str = Query(default="ws_1")
) -> dict:
    """Test CRM connection"""
    
    provider = payload.get("provider")
    if not provider:
        raise HTTPException(status_code=400, detail="Missing provider")
    
    # Mock connection test
    test_results = {
        "hubspot": {
            "status": "connected",
            "portal_id": "12345",
            "org_name": "Demo HubSpot Account"
        },
        "zoho": {
            "status": "connected",
            "dc": "com",
            "org_name": "Demo Zoho Account"
        },
        "odoo": {
            "status": "connected",
            "url": payload.get("url"),
            "database": payload.get("database")
        }
    }
    
    result = test_results.get(provider, {"status": "unknown"})
    result["workspace_id"] = workspace_id
    
    return result

# ===================== Push Call Outcomes to CRM =====================

@router.post("/calls/{call_id}/push-to-crm")
async def push_call_to_crm(
    call_id: str,
    provider: str = Query(default="auto", description="CRM provider (auto, hubspot, zoho, odoo)"),
    workspace_id: str = Query(default="ws_1"),
    db: Session = Depends(get_db)
) -> dict:
    """Push call outcome to CRM system"""
    
    # Get call and outcome data
    call = db.query(Call).filter(Call.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    outcome = db.query(CallOutcome).filter(CallOutcome.call_id == call_id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="Call outcome not found")
    
    # Determine provider if auto
    if provider == "auto":
        # Get first connected CRM for workspace
        connection = db.query(CrmConnection).filter(
            CrmConnection.workspace_id == workspace_id,
            CrmConnection.status == CrmConnectionStatus.CONNECTED
        ).first()
        
        if not connection:
            raise HTTPException(status_code=400, detail="No connected CRM found for workspace")
        
        provider = connection.provider.value
    else:
        # Validate provider
        try:
            CrmProvider(provider)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    
    # Check if CRM is connected
    connection = db.query(CrmConnection).filter(
        CrmConnection.workspace_id == workspace_id,
        CrmConnection.provider == provider,
        CrmConnection.status == CrmConnectionStatus.CONNECTED
    ).first()
    
    if not connection:
        raise HTTPException(status_code=400, detail=f"CRM {provider} not connected")
    
    try:
        # Get field mapping for this provider
        mapping = db.query(CrmFieldMapping).filter(
            CrmFieldMapping.workspace_id == workspace_id,
            CrmFieldMapping.provider == provider,
            CrmFieldMapping.object == CrmObjectType.CONTACT
        ).first()
        
        if not mapping:
            # Use default mapping
            mapping = {
                "mapping_json": get_default_mapping(provider, "contact"),
                "picklists_json": {}
            }
        else:
            mapping = {
                "mapping_json": mapping.mapping_json,
                "picklists_json": mapping.picklists_json or {}
            }
        
        # Prepare call data for CRM push
        call_data = {
            "call_id": call_id,
            "workspace_id": workspace_id,
            "provider": provider,
            "duration_s": call.duration_s,
            "outcome": outcome.fields_json,
            "summary": outcome.ai_summary_short,
            "next_step": outcome.next_step,
            "sentiment": outcome.sentiment,
            "score_lead": outcome.score_lead,
            "created_at": call.created_at.isoformat() if call.created_at else None,
            "mapping": mapping
        }
        
        # Queue background job for CRM push
        from workers.crm_jobs import crm_push_outcomes_job
        crm_push_outcomes_job.send(
            workspace_id, provider, call_id, call_data
        )
        
        # Update outcome synced timestamp
        outcome.synced_crm_at = datetime.utcnow()
        db.commit()
        
        return {
            "message": f"Call outcome queued for push to {provider}",
            "call_id": call_id,
            "provider": provider,
            "workspace_id": workspace_id,
            "job_queued": True
        }
        
    except Exception as e:
        # Log error
        from services.crm_sync import CrmSyncService
        sync_service = CrmSyncService()
        
        # Create sync log entry
        log_data = {
            "workspace_id": workspace_id,
            "provider": provider,
            "level": CrmLogLevel.ERROR.value,
            "object": CrmObjectType.ACTIVITY.value,
            "direction": CrmSyncDirection.PUSH.value,
            "correlation_id": call_id,
            "message": f"Failed to queue call push: {str(e)}",
            "payload_json": json.dumps(call_data) if 'call_data' in locals() else "{}"
        }
        
        # Note: In production, this would be async
        print(f"CRM sync log error: {log_data}")
        
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to push call to CRM: {str(e)}"
        )


# ===================== Sync Logs =====================

@router.get("/sync/logs")
async def get_sync_logs(
    provider: str = Query(..., description="CRM provider"),
    workspace_id: str = Query(default="ws_1"),
    level: Optional[str] = Query(None, description="Log level filter"),
    object: Optional[str] = Query(None, description="Object type filter"),
    direction: Optional[str] = Query(None, description="Sync direction filter"),
    limit: int = Query(default=50, description="Number of logs to return"),
    db: Session = Depends(get_db)
) -> dict:
    """Get CRM sync logs with optional filtering"""
    
    # Build query
    query = db.query(CrmSyncLog).filter(
        CrmSyncLog.workspace_id == workspace_id,
        CrmSyncLog.provider == provider
    )
    
    # Apply filters
    if level:
        try:
            log_level = CrmLogLevel(level)
            query = query.filter(CrmSyncLog.level == log_level)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid log level: {level}")
    
    if object:
        try:
            object_type = CrmObjectType(object)
            query = query.filter(CrmSyncLog.object == object_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid object type: {object}")
    
    if direction:
        try:
            sync_direction = CrmSyncDirection(direction)
            query = query.filter(CrmSyncLog.direction == sync_direction)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid sync direction: {direction}")
    
    # Get logs ordered by creation time (newest first)
    logs = query.order_by(CrmSyncLog.created_at.desc()).limit(limit).all()
    
    # Convert to dict format
    log_entries = []
    for log in logs:
        log_entries.append({
            "id": log.id,
            "level": log.level.value,
            "object": log.object.value,
            "direction": log.direction.value,
            "message": log.message,
            "correlation_id": log.correlation_id,
            "payload_json": log.payload_json,
            "created_at": log.created_at.isoformat() if log.created_at else None
        })
    
    return {
        "workspace_id": workspace_id,
        "provider": provider,
        "logs": log_entries,
        "total": len(log_entries),
        "filters": {
            "level": level,
            "object": object,
            "direction": direction,
            "limit": limit
        }
    }


# ===================== Helper Functions =====================

def get_default_mapping(provider: str, object_type: str) -> dict:
    """Get default field mapping for provider and object type"""
    default_mappings = {
        "hubspot": {
            "contact": {
                "email": "email",
                "phone_e164": "phone",
                "first_name": "firstname",
                "last_name": "lastname",
                "title": "jobtitle",
                "country_iso": "country",
                "company_id": "company"
            },
            "company": {
                "name": "name",
                "domain": "domain",
                "phone": "phone",
                "country_iso": "country",
                "vat": "vat_number",
                "address": "address"
            },
            "deal": {
                "title": "dealname",
                "amount_cents": "amount",
                "currency": "currency",
                "stage": "dealstage",
                "pipeline": "pipeline"
            }
        },
        "zoho": {
            "contact": {
                "email": "Email",
                "phone_e164": "Phone",
                "first_name": "First_Name",
                "last_name": "Last_Name",
                "title": "Title",
                "country_iso": "Mailing_Country",
                "company_id": "Account_Name"
            },
            "company": {
                "name": "Account_Name",
                "domain": "Website",
                "phone": "Phone",
                "country_iso": "Billing_Country",
                "vat": "VAT",
                "address": "Billing_Street"
            },
            "deal": {
                "title": "Deal_Name",
                "amount_cents": "Amount",
                "currency": "Currency",
                "stage": "Stage",
                "pipeline": "Pipeline"
            }
        },
        "odoo": {
            "contact": {
                "email": "email",
                "phone_e164": "phone",
                "first_name": "name (first part)",
                "last_name": "name (last part)",
                "title": "function",
                "country_iso": "country_id",
                "company_id": "parent_id"
            },
            "company": {
                "name": "name",
                "domain": "website",
                "phone": "phone",
                "country_iso": "country_id",
                "vat": "vat",
                "address": "street"
            },
            "deal": {
                "title": "name",
                "amount_cents": "expected_revenue",
                "currency": "currency_id",
                "stage": "stage_id",
                "pipeline": "pipeline_id"
            }
        }
    }
    
    return default_mappings.get(provider, {}).get(object_type, {})
