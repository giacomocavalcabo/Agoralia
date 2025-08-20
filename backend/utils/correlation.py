"""
Correlation ID utilities for request tracing
"""
import uuid
from typing import Optional
from contextvars import ContextVar
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Context variable to store correlation ID
correlation_id_var: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)


def get_correlation_id() -> Optional[str]:
    """Get current correlation ID from context"""
    return correlation_id_var.get()


def set_correlation_id(correlation_id: str) -> None:
    """Set correlation ID in context"""
    correlation_id_var.set(correlation_id)


def generate_correlation_id() -> str:
    """Generate a new correlation ID"""
    return f"req_{uuid.uuid4().hex[:16]}"


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Middleware to add correlation ID to requests"""
    
    async def dispatch(self, request: Request, call_next):
        # Generate or extract correlation ID
        correlation_id = request.headers.get("X-Request-Id") or generate_correlation_id()
        
        # Set in context
        set_correlation_id(correlation_id)
        
        # Add to request state for access in handlers
        request.state.correlation_id = correlation_id
        
        # Process request
        response = await call_next(request)
        
        # Add correlation ID to response headers
        response.headers["X-Request-Id"] = correlation_id
        
        return response


def add_correlation_id_header(headers: dict) -> dict:
    """Add correlation ID to headers if available"""
    correlation_id = get_correlation_id()
    if correlation_id:
        headers["X-Request-Id"] = correlation_id
    return headers


def log_with_correlation_id(message: str, **kwargs) -> str:
    """Format log message with correlation ID"""
    correlation_id = get_correlation_id()
    if correlation_id:
        return f"[{correlation_id}] {message}"
    return message
