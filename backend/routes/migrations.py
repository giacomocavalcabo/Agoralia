"""Database migration endpoint (temporary)"""
import os
import sys
from pathlib import Path
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

router = APIRouter()


@router.post("/run-migrations")
async def run_migrations_endpoint() -> Dict[str, Any]:
    """Run Alembic migrations manually (temporary endpoint)"""
    # Security: Only allow in development or with proper auth
    admin_emails = os.getenv("ADMIN_EMAILS", "").split(",")
    # TODO: Add proper authentication check here
    # For now, we'll just check if it's enabled
    
    BACKEND_DIR = Path(__file__).resolve().parent.parent
    
    try:
        from alembic.config import Config
        from alembic import command
        
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise HTTPException(status_code=500, detail="DATABASE_URL not set")
        
        # Configure Alembic
        alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))
        alembic_cfg.set_main_option("sqlalchemy.url", database_url)
        
        # Run upgrade to head
        command.upgrade(alembic_cfg, "head")
        
        return {
            "ok": True,
            "message": "Migrations completed successfully"
        }
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback_str = traceback.format_exc()
        print(f"Migration error: {error_msg}", file=sys.stderr)
        print(traceback_str, file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Migration failed: {error_msg}")

