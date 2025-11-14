"""API routes for Agoralia backend"""
from fastapi import APIRouter

# Import all routers
from .health import router as health_router
from .billing import router as billing_router
from .templates import router as templates_router
from .metrics import router as metrics_router
from .auth import router as auth_router
from .settings import router as settings_router
from .agents import router as agents_router
from .calls import router as calls_router

# Create main router
api_router = APIRouter()

# Include all sub-routers
api_router.include_router(health_router, tags=["health"])
api_router.include_router(billing_router, prefix="/billing", tags=["billing"])
api_router.include_router(templates_router, tags=["templates"])
api_router.include_router(metrics_router, tags=["metrics"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(settings_router, prefix="/settings", tags=["settings"])
api_router.include_router(agents_router, tags=["agents"])
api_router.include_router(calls_router, prefix="/calls", tags=["calls"])

# TODO: Add remaining routers as they are created
# api_router.include_router(crm_router, prefix="/crm", tags=["crm"])
# api_router.include_router(campaigns_router, tags=["campaigns"])
# api_router.include_router(webhooks_router, tags=["webhooks"])
# api_router.include_router(workflows_router, prefix="/workflows", tags=["workflows"])

