"""
Integrations router for CRM providers (HubSpot, Zoho, Odoo)
Handles connect, disconnect, test, and field mapping
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from backend.db import get_db
from backend.models import ProviderAccount
from backend.auth.session import get_current_user
from backend.config.settings import settings
from backend.services.kms import encrypt_str, decrypt_str, encrypt_json, decrypt_json
from datetime import datetime

router = APIRouter(prefix="/integrations", tags=["integrations"])

# --- Provider registry: CRM supportati
SUPPORTED_CRM = ["hubspot", "zoho", "odoo"]

def _now_iso():
    return datetime.utcnow().isoformat() + "Z"

# ---- Adapters (stub minimi): implementa validate/test nei tuoi services
class CRMAdapter:
    provider: str
    def validate_api_key(self, api_key: str) -> bool: return True
    def test_connection(self, account: ProviderAccount) -> bool: return True

class HubSpotAdapter(CRMAdapter):
    provider = "hubspot"

class ZohoAdapter(CRMAdapter):
    provider = "zoho"

class OdooAdapter(CRMAdapter):
    provider = "odoo"

ADAPTERS = {
    "hubspot": HubSpotAdapter(),
    "zoho": ZohoAdapter(),
    "odoo": OdooAdapter(),
}

# ---- Schemi
class ConnectPayload(BaseModel):
    label: Optional[str] = None
    method: str = Field(default="api_key", pattern="^(api_key|oauth2)$")
    api_key: Optional[str] = None
    # per oauth2 in futuro: code, redirect_uri, ecc.
    scopes: Optional[List[str]] = None

class DisconnectPayload(BaseModel):
    id: Optional[str] = None  # opzionale: disconnect by id

class MappingPayload(BaseModel):
    provider: str
    mapping: Dict[str, Any]

# ---- Helpers
def require_not_demo():
    if getattr(settings, "DEMO_MODE", False):
        raise HTTPException(status_code=403, detail="demo_mode")

def get_adapter_or_404(provider: str) -> CRMAdapter:
    a = ADAPTERS.get(provider)
    if not a:
        raise HTTPException(status_code=404, detail=f"provider {provider} not supported")
    return a

# ---- Endpoints

@router.get("/status")
def integrations_status(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Get status of all integrations - accessible to all authenticated users"""
    try:
        ws_id = user.workspace_id
        
        # Query existing integrations with safe error handling
        q = (
            db.query(ProviderAccount)
            .filter(ProviderAccount.workspace_id == ws_id)
            .filter(ProviderAccount.category.in_(["crm", "telephony"]))
        )
        accounts = q.all()
        
        # Build status object with provider as keys (frontend expects this format)
        status = {}
        
        # Add connected integrations
        for acc in accounts:
            if acc and acc.provider:
                status[acc.provider] = {
                    "connected": True,
                    "status": getattr(acc, "status", None) or "connected",
                    "id": acc.id,
                    "label": getattr(acc, "label", None),
                    "category": getattr(acc, "category", None),
                    "auth_type": getattr(acc, "auth_type", None),
                    "scopes": (getattr(acc, "scopes", None) or "").split(",") if getattr(acc, "scopes", None) else [],
                    "created_at": getattr(acc, "created_at", None),
                    "updated_at": getattr(acc, "updated_at", None),
                }
        
        # Add disconnected integrations for supported providers
        connected_providers = {acc.provider for acc in accounts if acc and acc.provider}
        for provider in SUPPORTED_CRM:
            if provider not in connected_providers:
                status[provider] = {
                    "connected": False,
                    "status": "disconnected"
                }
        
        return status
        
    except Exception as e:
        # Log error but return safe default status
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting integrations status: {e}")
        
        # Return safe default status for all supported providers
        return {
            provider: {"connected": False, "status": "disconnected"}
            for provider in SUPPORTED_CRM
        }

@router.post("/{provider}/connect")
def integrations_connect(provider: str, payload: ConnectPayload,
                         request: Request,
                         db: Session = Depends(get_db),
                         user=Depends(get_current_user)):
    # Check demo mode but provide better error message
    if getattr(settings, "DEMO_MODE", False):
        raise HTTPException(status_code=403, detail="Integration connections are disabled in demo mode")

    adapter = get_adapter_or_404(provider)
    ws_id = user.workspace_id

    # Idempotency semplice
    idem = request.headers.get("Idempotency-Key")
    if not idem:
        raise HTTPException(status_code=400, detail="missing idempotency key")

    # metodo api_key minimo (oauth2: da implementare)
    if payload.method == "api_key":
        if not payload.api_key:
            raise HTTPException(status_code=400, detail="missing api_key")
        if not adapter.validate_api_key(payload.api_key):
            raise HTTPException(status_code=401, detail="invalid_credentials")

        acc = (
            db.query(ProviderAccount)
              .filter(ProviderAccount.workspace_id == ws_id,
                      ProviderAccount.provider == provider,
                      ProviderAccount.category == "crm")
              .first()
        )
        if not acc:
            acc = ProviderAccount(
                workspace_id=ws_id,
                provider=provider,
                category="crm",
                auth_type="api_key",
                status="connected",
                label=payload.label or provider.capitalize(),
            )
            db.add(acc)

        # salva cifrato
        acc.api_key_encrypted = encrypt_str(payload.api_key)
        acc.scopes = ",".join(payload.scopes) if payload.scopes else None
        acc.status = "connected"
        db.commit()
        db.refresh(acc)
        return {"id": acc.id, "status": acc.status, "provider": acc.provider}

    # oauth2 (placeholder)
    raise HTTPException(status_code=400, detail="auth method not supported yet")

@router.delete("/{provider}/disconnect")
def integrations_disconnect(provider: str,
                            body: DisconnectPayload,
                            db: Session = Depends(get_db),
                            user=Depends(get_current_user)):
    # Check demo mode but provide better error message
    if getattr(settings, "DEMO_MODE", False):
        raise HTTPException(status_code=403, detail="Integration disconnections are disabled in demo mode")
    ws_id = user.workspace_id
    q = db.query(ProviderAccount).filter(
        ProviderAccount.workspace_id == ws_id,
        ProviderAccount.provider == provider,
        ProviderAccount.category == "crm",
    )
    if body.id:
        q = q.filter(ProviderAccount.id == body.id)
    acc = q.first()
    if not acc:
        raise HTTPException(status_code=404, detail="not_connected")
    # soft disconnect
    acc.status = "disconnected"
    acc.api_key_encrypted = None
    acc.secrets_encrypted = None
    db.commit()
    return {"ok": True}

@router.post("/{provider}/test")
def integrations_test(provider: str,
                      db: Session = Depends(get_db),
                      user=Depends(get_current_user)):
    try:
        ws_id = user.workspace_id
        acc = db.query(ProviderAccount).filter(
            ProviderAccount.workspace_id == ws_id,
            ProviderAccount.provider == provider,
            ProviderAccount.category == "crm",
        ).first()
        if not acc:
            raise HTTPException(status_code=404, detail="not_connected")
        adapter = get_adapter_or_404(provider)
        ok = adapter.test_connection(acc)
        return {"ok": bool(ok)}
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error testing {provider} connection: {e}")
        return {"ok": False, "error": "Connection test failed"}

@router.get("/mapping")
def get_mapping(provider: str,
                db: Session = Depends(get_db),
                user=Depends(get_current_user)):
    ws_id = user.workspace_id
    acc = db.query(ProviderAccount).filter(
        ProviderAccount.workspace_id == ws_id,
        ProviderAccount.provider == provider,
        ProviderAccount.category == "crm",
    ).first()
    if not acc:
        return {"provider": provider, "mapping": {}}
    # riuso metadata_json per evitare nuova colonna
    meta = getattr(acc, "metadata_json", None) or {}
    mapping = meta.get("crm_mapping", {})
    return {"provider": provider, "mapping": mapping}

@router.post("/mapping")
def set_mapping(payload: MappingPayload,
                db: Session = Depends(get_db),
                user=Depends(get_current_user)):
    ws_id = user.workspace_id
    acc = db.query(ProviderAccount).filter(
        ProviderAccount.workspace_id == ws_id,
        ProviderAccount.provider == payload.provider,
        ProviderAccount.category == "crm",
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="not_connected")
    meta = getattr(acc, "metadata_json", None) or {}
    meta["crm_mapping"] = payload.mapping
    acc.metadata_json = meta
    db.commit()
    return {"ok": True}
