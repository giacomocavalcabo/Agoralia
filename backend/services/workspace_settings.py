"""Workspace settings service functions (race-safe)"""
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from config.database import engine
from models.workspace_settings import WorkspaceSettings
from utils.encryption import encrypt_value, decrypt_value


def get_workspace_settings(tenant_id: int, session: Optional[Session] = None) -> WorkspaceSettings:
    """
    Get workspace settings for a tenant, create if not exists (race-safe)
    
    Args:
        tenant_id: Logical tenant ID (not FK)
        session: Optional session (creates new if not provided)
    
    Returns:
        WorkspaceSettings instance
    """
    if session:
        return _get_or_create_settings(tenant_id, session)
    
    with Session(engine) as session:
        return _get_or_create_settings(tenant_id, session)


def _get_or_create_settings(tenant_id: int, session: Session) -> WorkspaceSettings:
    """Internal helper: get or create settings (race-safe)"""
    settings = session.query(WorkspaceSettings).filter_by(tenant_id=tenant_id).first()
    if settings:
        return settings
    
    # Try to create
    settings = WorkspaceSettings(tenant_id=tenant_id)
    session.add(settings)
    try:
        session.commit()
        session.refresh(settings)
        return settings
    except IntegrityError:
        # Race condition: someone else created it first
        session.rollback()
        # Re-read
        settings = session.query(WorkspaceSettings).filter_by(tenant_id=tenant_id).first()
        if not settings:
            raise RuntimeError(f"Failed to get or create workspace settings for tenant {tenant_id}")
        return settings


def update_workspace_settings(
    tenant_id: int,
    updates: Dict[str, Any],
    session: Optional[Session] = None
) -> WorkspaceSettings:
    """
    Update workspace settings (partial update)
    
    Args:
        tenant_id: Logical tenant ID
        updates: Dictionary of fields to update
        session: Optional session
    
    Returns:
        Updated WorkspaceSettings instance
    """
    if session:
        return _update_settings(tenant_id, updates, session)
    
    with Session(engine) as session:
        return _update_settings(tenant_id, updates, session)


def _update_settings(tenant_id: int, updates: Dict[str, Any], session: Session) -> WorkspaceSettings:
    """Internal helper: update settings"""
    settings = get_workspace_settings(tenant_id, session)
    
    # Handle encryption for sensitive fields
    if "retell_api_key" in updates:
        value = updates.pop("retell_api_key")
        settings.retell_api_key_encrypted = encrypt_value(value) if value else None
    
    if "retell_webhook_secret" in updates:
        value = updates.pop("retell_webhook_secret")
        settings.retell_webhook_secret_encrypted = encrypt_value(value) if value else None
    
    # Update other fields
    for key, value in updates.items():
        if hasattr(settings, key) and value is not None:
            setattr(settings, key, value)
    
    session.commit()
    session.refresh(settings)
    return settings


def get_retell_api_key_set(tenant_id: int) -> bool:
    """Check if Retell API key is set (without decrypting)"""
    settings = get_workspace_settings(tenant_id)
    return bool(settings.retell_api_key_encrypted)


def get_retell_webhook_secret_set(tenant_id: int) -> bool:
    """Check if Retell webhook secret is set (without decrypting)"""
    settings = get_workspace_settings(tenant_id)
    return bool(settings.retell_webhook_secret_encrypted)


def decrypt_retell_api_key(tenant_id: int) -> Optional[str]:
    """Decrypt Retell API key (for internal use only)"""
    settings = get_workspace_settings(tenant_id)
    if not settings.retell_api_key_encrypted:
        return None
    return decrypt_value(settings.retell_api_key_encrypted)


def decrypt_retell_webhook_secret(tenant_id: int) -> Optional[str]:
    """Decrypt Retell webhook secret (for internal use only)"""
    settings = get_workspace_settings(tenant_id)
    if not settings.retell_webhook_secret_encrypted:
        return None
    return decrypt_value(settings.retell_webhook_secret_encrypted)

