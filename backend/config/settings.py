"""Application settings and configuration"""
import os


def get_cors_origins() -> list[str]:
    """Get CORS allowed origins based on environment"""
    front_origin = os.getenv("FRONTEND_ORIGIN")
    is_production = os.getenv("ENVIRONMENT", "").lower() == "production"
    origins = []
    
    if front_origin:
        origins.append(front_origin)
    elif not is_production:
        # Allow local dev origins only in non-production
        origins.extend([
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ])
    
    return origins

