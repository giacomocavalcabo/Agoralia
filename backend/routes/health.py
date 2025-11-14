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
    from sqlalchemy import inspect
    
    status = {
        "status": "ok",
        "database": "unknown",
        "env_vars": {},
        "tables": {}
    }
    
    # Check database
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            result.fetchone()
            status["database"] = "connected"
            
            # Check users table structure
            inspector = inspect(engine)
            if "users" in inspector.get_table_names():
                users_columns = [col['name'] for col in inspector.get_columns('users')]
                status["tables"]["users"] = {
                    "exists": True,
                    "columns": users_columns,
                    "has_tenant_id": "tenant_id" in users_columns
                }
            else:
                status["tables"]["users"] = {
                    "exists": False
                }
            
            # Check alembic version
            if "alembic_version" in inspector.get_table_names():
                result = conn.execute(text("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1"))
                row = result.fetchone()
                if row:
                    status["alembic_version"] = row[0]
                else:
                    status["alembic_version"] = "empty"
            else:
                status["alembic_version"] = "table_not_exists"
                
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

