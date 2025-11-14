"""Database configuration and initialization"""
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase

# Backend directory
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Database configuration
DB_PATH = BACKEND_DIR / "data.db"
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    engine = create_engine(DATABASE_URL, echo=False, future=True, pool_pre_ping=True)
else:
    engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, future=True)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""
    pass


def init_db():
    """Initialize database tables (non-blocking, for dev only)"""
    try:
        Base.metadata.create_all(engine)
    except Exception as e:
        import sys
        print(f"Warning: Could not create database tables at startup: {e}", file=sys.stderr)
        print("Database will be initialized via Alembic migrations.", file=sys.stderr)

