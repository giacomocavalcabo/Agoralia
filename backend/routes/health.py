"""Health check endpoints"""
import os
from fastapi import APIRouter
from sqlalchemy import text
from config.database import engine

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/system/status")
async def system_status():
    """System status check - database, env vars, etc."""
    status = {
        "status": "ok",
        "database": "unknown",
        "env_vars": {}
    }
    
    # Check database
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            result.fetchone()
            status["database"] = "connected"
    except Exception as e:
        status["database"] = f"error: {str(e)}"
        status["status"] = "degraded"
    
    # Check critical env vars
    critical_vars = ["DATABASE_URL", "JWT_SECRET", "RETELL_API_KEY"]
    for var in critical_vars:
        value = os.getenv(var)
        if value:
            status["env_vars"][var] = "set"
            # Mask sensitive values
            if "SECRET" in var or "KEY" in var or "URL" in var:
                status["env_vars"][var + "_preview"] = value[:20] + "..." if len(value) > 20 else "***"
        else:
            status["env_vars"][var] = "not set"
            if var in ["DATABASE_URL", "JWT_SECRET"]:
                status["status"] = "error"
    
    return status

