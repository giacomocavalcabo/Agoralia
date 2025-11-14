"""Redis client utilities"""
import os
try:
    import redis  # type: ignore
except Exception:
    redis = None


def get_redis():
    """Get Redis client instance"""
    if redis is None:
        return None
    url = os.getenv("REDIS_URL")
    if not url:
        return None
    try:
        return redis.Redis.from_url(url, decode_responses=True)
    except Exception:
        return None

