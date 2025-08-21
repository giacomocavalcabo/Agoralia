"""
Security utilities for authentication system
Includes rate limiting, password validation, and audit logging
"""

import time
import hashlib
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import HTTPException, Request
import redis

# ===================== Password Policy =====================

class PasswordPolicy:
    """Password validation with configurable rules"""
    
    def __init__(self, 
                 min_length: int = 8,
                 require_uppercase: bool = True,
                 require_lowercase: bool = True,
                 require_digits: bool = True,
                 require_special: bool = True):
        self.min_length = min_length
        self.require_uppercase = require_uppercase
        self.require_lowercase = require_lowercase
        self.require_digits = require_digits
        self.require_special = require_special
    
    def validate(self, password: str) -> tuple[bool, str]:
        """Validate password against policy"""
        if len(password) < self.min_length:
            return False, f"Password must be at least {self.min_length} characters long"
        
        if self.require_uppercase and not re.search(r'[A-Z]', password):
            return False, "Password must contain at least one uppercase letter"
        
        if self.require_lowercase and not re.search(r'[a-z]', password):
            return False, "Password must contain at least one lowercase letter"
        
        if self.require_digits and not re.search(r'\d', password):
            return False, "Password must contain at least one digit"
        
        if self.require_special and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            return False, "Password must contain at least one special character"
        
        return True, "Password meets requirements"

# ===================== Rate Limiting =====================

class AuthRateLimiter:
    """Rate limiter for authentication endpoints"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.max_attempts = 5  # Max login attempts per IP
        self.window_seconds = 300  # 5 minutes window
        self.block_duration = 900  # 15 minutes block
    
    def _get_client_key(self, request: Request) -> str:
        """Generate unique key for client (IP + User-Agent hash)"""
        client_ip = request.client.host or "unknown"
        user_agent = request.headers.get("user-agent", "")[:50]  # Limit UA length
        ua_hash = hashlib.md5(user_agent.encode()).hexdigest()[:8]
        return f"auth_rate_limit:{client_ip}:{ua_hash}"
    
    def check_rate_limit(self, request: Request) -> None:
        """Check if client is rate limited"""
        if not self.redis:
            return  # Skip rate limiting if Redis not available
        
        key = self._get_client_key(request)
        
        # Check if blocked
        blocked_until = self.redis.get(f"{key}:blocked")
        if blocked_until:
            remaining = int(blocked_until) - int(time.time())
            if remaining > 0:
                raise HTTPException(
                    status_code=429, 
                    detail=f"Too many failed attempts. Try again in {remaining//60} minutes"
                )
            else:
                # Unblock
                self.redis.delete(f"{key}:blocked")
        
        # Check attempts in current window
        attempts = self.redis.get(f"{key}:attempts")
        if attempts and int(attempts) >= self.max_attempts:
            # Block client
            block_until = int(time.time()) + self.block_duration
            self.redis.setex(f"{key}:blocked", self.block_duration, block_until)
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Account blocked for {self.block_duration//60} minutes"
            )
    
    def record_attempt(self, request: Request, success: bool) -> None:
        """Record authentication attempt"""
        if not self.redis:
            return
        
        key = self._get_client_key(request)
        
        if success:
            # Reset attempts on success
            self.redis.delete(f"{key}:attempts")
        else:
            # Increment failed attempts
            pipe = self.redis.pipeline()
            pipe.incr(f"{key}:attempts")
            pipe.expire(f"{key}:attempts", self.window_seconds)
            pipe.execute()

# ===================== Audit Logging =====================

class AuthAuditLogger:
    """Audit logging for authentication events"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
    
    def log_auth_event(self, 
                      event_type: str,
                      user_email: Optional[str],
                      success: bool,
                      request: Request,
                      details: Optional[Dict[str, Any]] = None) -> None:
        """Log authentication event for audit"""
        if not self.redis:
            return  # Skip if Redis not available
        
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,  # login_success, login_failed, logout, etc.
            "user_email": user_email,
            "success": success,
            "client_ip": request.client.host or "unknown",
            "user_agent": request.headers.get("user-agent", "")[:100],
            "details": details or {}
        }
        
        # Store in Redis with TTL (keep logs for 30 days)
        log_key = f"auth_audit:{int(time.time())}:{hash(str(log_entry))}"
        self.redis.setex(log_key, 2592000, str(log_entry))  # 30 days TTL

# ===================== Session Security =====================

class SessionManager:
    """Secure session management with rotation"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.session_ttl = 86400  # 24 hours
    
    def create_session(self, user_data: Dict[str, Any], request: Request) -> str:
        """Create new session with rotation"""
        import secrets
        
        # Generate new session ID
        session_id = secrets.token_urlsafe(32)
        
        # Add security metadata
        session_data = {
            **user_data,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat(),
            "client_ip": request.client.host or "unknown",
            "user_agent_hash": hashlib.md5(
                request.headers.get("user-agent", "").encode()
            ).hexdigest()[:8]
        }
        
        # Store in Redis
        if self.redis:
            self.redis.setex(session_id, self.session_ttl, str(session_data))
        
        return session_id
    
    def validate_session(self, session_id: str, request: Request) -> Optional[Dict[str, Any]]:
        """Validate session and check security"""
        if not self.redis:
            return None
        
        session_data = self.redis.get(session_id)
        if not session_data:
            return None
        
        # Parse session data
        try:
            session = eval(session_data)  # In production, use proper JSON parsing
        except:
            return None
        
        # Check if session expired
        created_at = datetime.fromisoformat(session.get("created_at", ""))
        if (datetime.now(timezone.utc) - created_at).total_seconds() > self.session_ttl:
            self.redis.delete(session_id)
            return None
        
        # Check client IP (optional security check)
        if session.get("client_ip") != (request.client.host or "unknown"):
            # Log suspicious activity
            self.redis.delete(session_id)
            return None
        
        # Update last activity
        session["last_activity"] = datetime.now(timezone.utc).isoformat()
        self.redis.setex(session_id, self.session_ttl, str(session))
        
        return session

# ===================== Global Instances =====================

# Password policy (configurable)
password_policy = PasswordPolicy(
    min_length=8,
    require_uppercase=True,
    require_lowercase=True,
    require_digits=True,
    require_special=True
)

# Rate limiter (requires Redis)
auth_rate_limiter = AuthRateLimiter()

# Audit logger (requires Redis)
auth_audit_logger = AuthAuditLogger()

# Session manager (requires Redis)
session_manager = SessionManager()
