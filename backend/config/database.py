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


def run_migrations():
    """Run Alembic migrations to upgrade database schema"""
    import subprocess
    import sys
    
    try:
        # Run alembic upgrade head to apply all pending migrations
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=str(BACKEND_DIR),
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode == 0:
            print("✓ Database migrations applied successfully", file=sys.stderr)
        else:
            print(f"⚠ Migration warning: {result.stderr}", file=sys.stderr)
    except FileNotFoundError:
        # Alembic not available, skip migrations
        print("⚠ Alembic not found, skipping migrations", file=sys.stderr)
    except Exception as e:
        print(f"⚠ Could not run migrations: {e}", file=sys.stderr)

