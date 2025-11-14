"""Tenant isolation utilities"""
from contextlib import contextmanager
from typing import Optional
from fastapi import Request
from sqlalchemy.orm import Session
from sqlalchemy import text

# Import here to avoid circular dependency
def _get_engine():
    from config.database import engine
    return engine

def _get_database_url():
    from config.database import DATABASE_URL
    return DATABASE_URL


def _is_postgres() -> bool:
    """Check if using PostgreSQL database"""
    DATABASE_URL = _get_database_url()
    return bool(DATABASE_URL and not str(DATABASE_URL).startswith("sqlite"))


def _set_tenant_session(session: Session, tenant_id: Optional[int]) -> None:
    """Set tenant ID in database session (PostgreSQL only)"""
    if _is_postgres():
        try:
            session.execute(text("SET app.tenant_id = :tid"), {"tid": int(tenant_id or 0)})
        except Exception:
            pass


@contextmanager
def tenant_session(request: Optional[Request]):
    """Context manager for tenant-scoped database session"""
    from utils.auth import extract_tenant_id
    
    tenant_id = extract_tenant_id(request)
    engine = _get_engine()
    session = Session(engine)
    _set_tenant_session(session, tenant_id)
    try:
        yield session
    finally:
        session.close()

