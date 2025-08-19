"""
CRM Router - Consolidated routes for all CRM providers
"""
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Dict, List, Optional, Any
from datetime import datetime
import secrets
import json

from ..db import get_db
from ..models import (
    CrmConnection, CrmFieldMapping, CrmSyncCursor, CrmSyncLog,
    CrmProvider, CrmConnectionStatus, CrmObjectType, CrmSyncDirection, CrmLogLevel, CrmWebhookStatus,
    Call, CallOutcome
)
from ..integrations import HubSpotClient, ZohoClient, OdooClient
from deps.auth import get_tenant_id, require_workspace_access

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
async def hubspot_start(workspace_id: str = Query(default="ws_1")) -> dict:
    """Start HubSpot OAuth flow"""
    # In production, redirect to HubSpot OAuth
    # For now, return mock URL
    return {
        "auth_url": "https://app.hubspot.com/oauth/authorize?client_id=mock&redirect_uri=mock&scope=contacts deals",
        "workspace_id": workspace_id
    }


@router.get("/hubspot/callback")
async def hubspot_callback(
    code: str, 
    state: str, 
    workspace_id: str = Query(default="ws_1"),
    db: Session = Depends(get_db)
) -> dict:
    """Handle HubSpot OAuth callback"""
    # In production, exchange code for tokens
    # For now, return mock success
    
    return {
        "message": "HubSpot connected successfully",
        "portal_id": "12345",
        "access_token": "mock_token",
        "workspace_id": workspace_id
    }


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
async def zoho_start(
    dc: str = Query(default="com", description="Datacenter: com, eu, in, au, jp"),
    workspace_id: str = Query(default="ws_1")
) -> dict:
    """Start Zoho OAuth flow"""
    dc_urls = {
        "com": "https://accounts.zoho.com",
        "eu": "https://accounts.zoho.eu", 
        "in": "https://accounts.zoho.in",
        "au": "https://accounts.zoho.com.au",
        "jp": "https://accounts.zoho.jp"
    }
    
    base_url = dc_urls.get(dc, dc_urls["com"])
    
    return {
        "auth_url": f"{base_url}/oauth/v2/auth?client_id=mock&redirect_uri=mock&scope=ZohoCRM.modules.ALL",
        "dc": dc,
        "workspace_id": workspace_id
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
    """Handle HubSpot webhook events"""
    
    # In production, verify signature and process webhook
    body = await request.body()
    headers = dict(request.headers)
    
    # Log webhook event
    print(f"HubSpot webhook received: {headers.get('x-hubspot-signature')}")
    
    return {
        "status": "received",
        "provider": "hubspot",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/webhooks/zoho")
async def zoho_webhook(request: Request) -> dict:
    """Handle Zoho webhook events"""
    
    body = await request.body()
    headers = dict(request.headers)
    
    print(f"Zoho webhook received: {headers.get('x-zoho-signature')}")
    
    return {
        "status": "received",
        "provider": "zoho",
        "timestamp": datetime.utcnow().isoformat()
    }


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
