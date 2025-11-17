"""Main FastAPI application - Refactored modular version"""
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import time
import logging

# Load environment variables
BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

# Import configuration
from config import init_db, get_cors_origins, run_migrations

# Import routes
from routes import api_router

# Run database migrations (upgrade schema)
run_migrations()

# Initialize database (non-blocking, creates tables if missing)
init_db()

# Create FastAPI app
app = FastAPI(title="Agoralia Backend", version="0.1.0")

# Configure CORS
origins = get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Structured request logging (minimal)
logger = logging.getLogger("agoralia.api")
logging.basicConfig(level=logging.INFO)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    path = request.url.path
    method = request.method
    try:
        response = await call_next(request)
        status = response.status_code
    except Exception as e:
        status = 500
        logger.exception("Request error: %s %s -> 500 (%s)", method, path, str(e))
        raise
    finally:
        dur_ms = int((time.time() - start) * 1000)
        tenant = request.headers.get("X-Tenant-Id") or "-"
        logger.info("%s %s %s %dms", method, path, f"tenant={tenant}", dur_ms)
    return response

# Include all API routes
app.include_router(api_router)

# Serve static files (logos, etc.)
uploads_dir = BACKEND_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
print(f"[INFO] Static files directory: {uploads_dir}", flush=True)
try:
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
    print(f"[INFO] Static files mounted at /uploads", flush=True)
except Exception as e:
    print(f"[WARNING] Failed to mount static files: {e}", flush=True)

