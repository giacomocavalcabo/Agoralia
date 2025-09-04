"""
OAuth State Management using JWT
Replaces session-based state management for better reliability
"""
import jwt
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from backend.config.settings import settings

# JWT secret for OAuth state - should be different from session secret
OAUTH_STATE_SECRET = getattr(settings, 'OAUTH_STATE_SECRET', 'oauth-state-secret-change-in-production')
JWT_ALGORITHM = 'HS256'
STATE_EXPIRY_MINUTES = 10  # OAuth state expires in 10 minutes


def create_oauth_state(user_id: str, workspace_id: str, provider: str = "hubspot") -> str:
    """
    Create a JWT-based OAuth state token containing user and workspace info
    
    Args:
        user_id: ID of the user initiating OAuth
        workspace_id: Workspace ID for the OAuth flow
        provider: CRM provider (hubspot, zoho, odoo)
    
    Returns:
        JWT token string to use as OAuth state parameter
    """
    now = datetime.utcnow()
    payload = {
        "uid": user_id,
        "ws": workspace_id,
        "provider": provider,
        "nonce": secrets.token_urlsafe(16),
        "iat": now,
        "exp": now + timedelta(minutes=STATE_EXPIRY_MINUTES)
    }
    
    return jwt.encode(payload, OAUTH_STATE_SECRET, algorithm=JWT_ALGORITHM)


def validate_oauth_state(state: str) -> Optional[Dict[str, Any]]:
    """
    Validate and decode OAuth state token
    
    Args:
        state: JWT token from OAuth callback
    
    Returns:
        Decoded payload dict or None if invalid/expired
    """
    try:
        payload = jwt.decode(
            state, 
            OAUTH_STATE_SECRET, 
            algorithms=[JWT_ALGORITHM],
            options={"verify_exp": True}
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def extract_oauth_info(state: str) -> Optional[Dict[str, str]]:
    """
    Extract user and workspace info from OAuth state
    
    Args:
        state: JWT token from OAuth callback
    
    Returns:
        Dict with user_id, workspace_id, provider or None if invalid
    """
    payload = validate_oauth_state(state)
    if not payload:
        return None
    
    return {
        "user_id": payload.get("uid"),
        "workspace_id": payload.get("ws"),
        "provider": payload.get("provider"),
        "nonce": payload.get("nonce")
    }
