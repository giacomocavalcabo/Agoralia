"""
Rate Limiting utilities for CRM providers
"""
import time
import hashlib
from typing import Optional, Dict, Tuple
from fastapi import HTTPException, Request
import redis
import os
import logging
from typing import Dict, Tuple
from collections import defaultdict
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self):
        self._redis = None
        self._memory_store: Dict[str, list] = {}
        
        # Try to connect to Redis
        redis_url = os.getenv("REDIS_URL") or os.getenv("REDIS_TLS_URL")
        if redis_url:
            try:
                self._redis = redis.from_url(redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None
    
    def _get_key(self, identifier: str, action: str) -> str:
        """Generate Redis key for rate limiting"""
        return f"rate_limit:{action}:{identifier}"
    
    def _get_memory_key(self, identifier: str, action: str) -> str:
        """Generate memory key for rate limiting"""
        return f"{action}:{identifier}"
    
    def check_rate_limit(
        self, 
        identifier: str, 
        action: str, 
        max_requests: int, 
        window_seconds: int
    ) -> Tuple[bool, int, int]:
        """
        Check if request is allowed
        
        Returns:
            (allowed, remaining_requests, reset_time)
        """
        now = int(time.time())
        key = self._get_key(identifier, action)
        
        if self._redis:
            # Redis-based rate limiting
            try:
                pipe = self._redis.pipeline()
                pipe.zremrangebyscore(key, 0, now - window_seconds)
                pipe.zadd(key, {str(now): now})
                pipe.expire(key, window_seconds)
                pipe.zcard(key)
                results = pipe.execute()
                
                current_requests = results[3]
                allowed = current_requests <= max_requests
                remaining = max(0, max_requests - current_requests)
                
                return allowed, remaining, now + window_seconds
                
            except Exception:
                # Fallback to memory
                pass
        
        # Memory-based rate limiting (fallback)
        memory_key = self._get_memory_key(identifier, action)
        if memory_key not in self._memory_store:
            self._memory_store[memory_key] = []
        
        # Clean old entries
        cutoff = now - window_seconds
        self._memory_store[memory_key] = [
            timestamp for timestamp in self._memory_store[memory_key] 
            if timestamp > cutoff
        ]
        
        # Check limit
        current_requests = len(self._memory_store[memory_key])
        allowed = current_requests < max_requests
        
        if allowed:
            self._memory_store[memory_key].append(now)
        
        remaining = max(0, max_requests - current_requests)
        return allowed, remaining, now + window_seconds
    
    def get_auth_limits(self, request: Request) -> Dict[str, int]:
        """Get rate limit info for authentication endpoints"""
        client_ip = request.client.host
        user_agent = request.headers.get("user-agent", "")
        
        # IP-based limits
        ip_key = f"ip:{client_ip}"
        
        # User agent fingerprint for device tracking
        device_hash = hashlib.sha256(user_agent.encode()).hexdigest()[:8]
        device_key = f"device:{device_hash}"
        
        limits = {}
        
        # Check IP limits
        for action, (max_req, window) in [
            ("login", (5, 60)),      # 5 login attempts per minute per IP
            ("magic", (3, 300)),     # 3 magic links per 5 minutes per IP
            ("oauth", (10, 300)),    # 10 OAuth attempts per 5 minutes per IP
        ]:
            allowed, remaining, reset = self.check_rate_limit(ip_key, action, max_req, window)
            limits[f"ip_{action}"] = {
                "allowed": allowed,
                "remaining": remaining,
                "reset": reset
            }
        
        # Check device limits
        for action, (max_req, window) in [
            ("login", (20, 3600)),   # 20 login attempts per hour per device
        ]:
            allowed, remaining, reset = self.check_rate_limit(device_key, action, max_req, window)
            limits[f"device_{action}"] = {
                "allowed": allowed,
                "remaining": remaining,
                "reset": reset
            }
        
        return limits

# Global instance
rate_limiter = RateLimiter()

class WorkspaceRateLimiter:
    """Rate limiter per workspace per operazioni telephony"""
    
    def __init__(self):
        # {workspace_id: [(timestamp, operation_type), ...]}
        self.requests: Dict[str, list] = defaultdict(list)
        
        # Configurazione rate limits
        self.limits = {
            "purchase": {"per_minute": 5, "per_day": 20},      # 5 acquisti/min, 20/giorno
            "import": {"per_minute": 10, "per_day": 50},       # 10 import/min, 50/giorno
            "inventory_search": {"per_minute": 30, "per_day": 1000}  # 30 ricerche/min, 1000/giorno
        }
    
    def _cleanup_old_requests(self, workspace_id: str, operation: str):
        """Rimuove richieste vecchie per mantenere la memoria pulita"""
        now = time.time()
        cutoff_minute = now - 60
        cutoff_day = now - 86400
        
        # Mantieni solo le richieste recenti
        self.requests[workspace_id] = [
            (ts, op) for ts, op in self.requests[workspace_id]
            if ts > cutoff_day
        ]
    
    def check_rate_limit(self, workspace_id: str, operation: str) -> bool:
        """Verifica se la richiesta rispetta i rate limit"""
        if operation not in self.limits:
            logger.warning(f"Unknown operation type: {operation}")
            return True
        
        now = time.time()
        cutoff_minute = now - 60
        cutoff_day = now - 86400
        
        # Conta richieste per minuto e per giorno
        minute_requests = [
            (ts, op) for ts, op in self.requests[workspace_id]
            if ts > cutoff_minute and op == operation
        ]
        
        day_requests = [
            (ts, op) for ts, op in self.requests[workspace_id]
            if ts > cutoff_day and op == operation
        ]
        
        limits = self.limits[operation]
        
        # Verifica limiti
        if len(minute_requests) >= limits["per_minute"]:
            logger.warning(f"Rate limit exceeded for {workspace_id}: {operation} per minute")
            return False
        
        if len(day_requests) >= limits["per_day"]:
            logger.warning(f"Rate limit exceeded for {workspace_id}: {operation} per day")
            return False
        
        return True
    
    def record_request(self, workspace_id: str, operation: str):
        """Registra una richiesta per il rate limiting"""
        now = time.time()
        self.requests[workspace_id].append((now, operation))
        
        # Cleanup per mantenere la memoria gestibile
        self._cleanup_old_requests(workspace_id, operation)
    
    def enforce_rate_limit(self, workspace_id: str, operation: str):
        """Applica rate limiting, solleva eccezione se superato"""
        if not self.check_rate_limit(workspace_id, operation):
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "rate_limit_exceeded",
                    "operation": operation,
                    "message": f"Rate limit exceeded for {operation}. Please try again later.",
                    "retry_after": 60
                }
            )
        
        self.record_request(workspace_id, operation)

# Istanza globale
telephony_rate_limiter = WorkspaceRateLimiter()

def require_rate_limit(request: Request, action: str = "default"):
    """Decorator to require rate limiting"""
    client_ip = request.client.host
    
    # Default limits
    limits = {
        "default": (100, 60),      # 100 requests per minute
        "auth": (10, 60),          # 10 auth requests per minute
        "admin": (50, 60),         # 50 admin requests per minute
    }
    
    max_req, window = limits.get(action, limits["default"])
    allowed, remaining, reset = rate_limiter.check_rate_limit(
        f"ip:{client_ip}", action, max_req, window
    )
    
    if not allowed:
        raise HTTPException(
            status_code=429, 
            detail={
                "error": "Rate limit exceeded",
                "retry_after": reset - int(time.time()),
                "limit": f"{max_req} requests per {window} seconds"
            }
        )
    
    return True
