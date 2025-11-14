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
    import sys
    
    try:
        # Import Alembic directly instead of using subprocess
        from alembic.config import Config
        from alembic import command
        
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            print("⚠ DATABASE_URL not set, skipping migrations", file=sys.stderr)
            return
        
        # Configure Alembic
        alembic_ini_path = BACKEND_DIR / "alembic.ini"
        alembic_cfg = Config(str(alembic_ini_path))
        
        # Set absolute path for script_location (alembic directory)
        alembic_script_location = BACKEND_DIR / "alembic"
        alembic_cfg.set_main_option("script_location", str(alembic_script_location))
        alembic_cfg.set_main_option("sqlalchemy.url", database_url)
        
        # Run upgrade to head
        print("Running database migrations...", file=sys.stderr)
        command.upgrade(alembic_cfg, "head")
        print("✓ Database migrations applied successfully", file=sys.stderr)
    except ImportError:
        # Alembic not installed, skip migrations
        print("⚠ Alembic not found, skipping migrations", file=sys.stderr)
    except Exception as e:
        print(f"⚠ Could not run migrations: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)

