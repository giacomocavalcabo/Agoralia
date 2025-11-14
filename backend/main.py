"""Main FastAPI application - Refactored modular version"""
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

# Include all API routes
app.include_router(api_router)

