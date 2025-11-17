"""User preferences service functions (race-safe)"""
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from config.database import engine
from models.user_preferences import UserPreferences


def get_user_preferences(
    user_id: int,
    tenant_id: int,
    session: Optional[Session] = None
) -> UserPreferences:
    """
    Get user preferences, create if not exists (race-safe)
    
    IMPORTANT: Always filter by both user_id AND tenant_id for isolation
    
    Args:
        user_id: User ID (FK to users.id)
        tenant_id: Logical tenant ID for isolation
        session: Optional session
    
    Returns:
        UserPreferences instance
    """
    if session:
        return _get_or_create_preferences(user_id, tenant_id, session)
    
    with Session(engine) as session:
        return _get_or_create_preferences(user_id, tenant_id, session)


def _get_or_create_preferences(
    user_id: int,
    tenant_id: int,
    session: Session
) -> UserPreferences:
    """Internal helper: get or create preferences (race-safe)"""
    prefs = session.query(UserPreferences).filter_by(
        user_id=user_id,
        tenant_id=tenant_id  # Always filter by tenant_id too
    ).first()
    
    if prefs:
        return prefs
    
    # Try to create
    prefs = UserPreferences(user_id=user_id, tenant_id=tenant_id)
    session.add(prefs)
    try:
        session.commit()
        session.refresh(prefs)
        return prefs
    except IntegrityError:
        # Race condition: someone else created it first
        session.rollback()
        # Re-read
        prefs = session.query(UserPreferences).filter_by(
            user_id=user_id,
            tenant_id=tenant_id
        ).first()
        if not prefs:
            raise RuntimeError(f"Failed to get or create user preferences for user {user_id}")
        return prefs


def update_user_preferences(
    user_id: int,
    tenant_id: int,
    updates: Dict[str, Any],
    session: Optional[Session] = None
) -> UserPreferences:
    """
    Update user preferences (partial update)
    
    Args:
        user_id: User ID
        tenant_id: Logical tenant ID
        updates: Dictionary of fields to update
        session: Optional session
    
    Returns:
        Updated UserPreferences instance
    """
    if session:
        return _update_preferences(user_id, tenant_id, updates, session)
    
    with Session(engine) as session:
        return _update_preferences(user_id, tenant_id, updates, session)


def _update_preferences(
    user_id: int,
    tenant_id: int,
    updates: Dict[str, Any],
    session: Session
) -> UserPreferences:
    """Internal helper: update preferences"""
    prefs = get_user_preferences(user_id, tenant_id, session)
    
    # Update fields
    for key, value in updates.items():
        if hasattr(prefs, key) and value is not None:
            setattr(prefs, key, value)
    
    session.commit()
    session.refresh(prefs)
    return prefs

