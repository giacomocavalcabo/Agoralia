"""
Rate Limiting utilities for CRM providers
"""
import time
import asyncio
from typing import Dict, Any, Callable
from functools import wraps
import random
from ..config.crm import get_rate_limit_config

class RateLimiter:
    """Token bucket rate limiter for CRM providers"""
    
    def __init__(self, provider: str):
        config = get_rate_limit_config(provider)
        self.requests_per_second = config.get("requests_per_second", 5)
        self.burst_limit = config.get("burst_limit", 10)
        self.tokens = self.burst_limit
        self.last_refill = time.time()
        self.lock = asyncio.Lock()
    
    async def acquire(self) -> bool:
        """Acquire a token for making a request"""
        async with self.lock:
            now = time.time()
            time_passed = now - self.last_refill
            
            # Refill tokens based on time passed
            tokens_to_add = time_passed * self.requests_per_second
            self.tokens = min(self.burst_limit, self.tokens + tokens_to_add)
            self.last_refill = now
            
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            
            return False
    
    async def wait_for_token(self):
        """Wait until a token is available"""
        while not await self.acquire():
            # Calculate wait time
            wait_time = (1 - self.tokens) / self.requests_per_second
            # Add jitter to prevent thundering herd
            jitter = random.uniform(0, 0.1)
            await asyncio.sleep(wait_time + jitter)

def rate_limited(provider: str):
    """Decorator to apply rate limiting to CRM operations"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            limiter = RateLimiter(provider)
            await limiter.wait_for_token()
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def retry_with_backoff(max_attempts: int = 3, base_delay: float = 1.0, max_delay: float = 300.0):
    """Decorator to retry operations with exponential backoff"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    if attempt == max_attempts - 1:
                        # Last attempt, re-raise the exception
                        raise last_exception
                    
                    # Calculate delay with exponential backoff
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    # Add jitter to prevent thundering herd
                    jitter = random.uniform(0, delay * 0.1)
                    
                    print(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay + jitter:.2f}s...")
                    await asyncio.sleep(delay + jitter)
            
            # This should never be reached, but just in case
            raise last_exception
        
        return wrapper
    return decorator

class CRMRetryHandler:
    """Handles retry logic for CRM operations"""
    
    def __init__(self, provider: str):
        config = get_rate_limit_config(provider)
        self.max_attempts = config.get("retry_attempts", 3)
        self.backoff_base = config.get("backoff_base", 2.0)
        self.max_backoff = config.get("max_backoff", 300)
    
    async def execute_with_retry(self, operation: Callable, *args, **kwargs):
        """Execute operation with retry logic"""
        last_exception = None
        
        for attempt in range(self.max_attempts):
            try:
                return await operation(*args, **kwargs)
            except Exception as e:
                last_exception = e
                
                if attempt == self.max_attempts - 1:
                    # Last attempt, re-raise the exception
                    raise last_exception
                
                # Calculate delay with exponential backoff
                delay = min(self.backoff_base ** attempt, self.max_backoff)
                # Add jitter
                jitter = random.uniform(0, delay * 0.1)
                
                print(f"CRM operation failed (attempt {attempt + 1}/{self.max_attempts}): {e}")
                print(f"Retrying in {delay + jitter:.2f}s...")
                
                await asyncio.sleep(delay + jitter)
        
        # This should never be reached
        raise last_exception
