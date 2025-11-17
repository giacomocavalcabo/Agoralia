"""API routes for Agoralia backend"""
from fastapi import APIRouter

# Import all routers
from .health import router as health_router
from .billing import router as billing_router
from .templates import router as templates_router
from .metrics import router as metrics_router
from .auth import router as auth_router
from .settings import router as settings_router
from .workspace_settings import router as workspace_settings_router
from .agents import router as agents_router
from .calls import router as calls_router

# Create main router
api_router = APIRouter()

# Include all sub-routers
api_router.include_router(health_router, tags=["health"])
api_router.include_router(billing_router, prefix="/billing", tags=["billing"])
api_router.include_router(templates_router, tags=["templates"])
api_router.include_router(metrics_router, prefix="/metrics", tags=["metrics"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(settings_router, prefix="/settings", tags=["settings"])
api_router.include_router(workspace_settings_router, prefix="/settings/workspace", tags=["settings"])
api_router.include_router(agents_router, tags=["agents"])
api_router.include_router(calls_router, prefix="/calls", tags=["calls"])

# Import remaining routers
from .campaigns import router as campaigns_router
from .workflows import router as workflows_router
from .webhooks import router as webhooks_router
from .misc import router as misc_router

# Include remaining routers
api_router.include_router(campaigns_router, tags=["campaigns", "leads"])
api_router.include_router(workflows_router, prefix="/workflows", tags=["workflows"])
api_router.include_router(webhooks_router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(misc_router, tags=["misc"])

# Import compliance router
from .compliance import router as compliance_router

# Include compliance router
api_router.include_router(compliance_router, prefix="/compliance", tags=["compliance"])

# Note: Migration endpoint removed - migrations now run automatically on startup
# If needed temporarily, uncomment:
# from .migrations import router as migrations_router
# api_router.include_router(migrations_router, prefix="/migrations", tags=["migrations"])

# TODO: Add CRM router when created
# api_router.include_router(crm_router, prefix="/crm", tags=["crm"])

