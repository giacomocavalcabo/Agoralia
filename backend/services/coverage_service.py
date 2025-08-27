# backend/services/coverage_service.py
from functools import lru_cache
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from ..models import ProviderAccount, TelephonyProvider
from ..services.crypto import dec
from .providers.twilio_adapter import TwilioAdapter
from .providers.telnyx_adapter import TelnyxAdapter
from ..schemas.telephony_coverage import Country, Capabilities, PricingInfo

def get_provider_adapter(provider: TelephonyProvider, api_key: str):
    """Get the appropriate provider adapter"""
    if provider == TelephonyProvider.twilio:
        # For Twilio, we need both account_sid and auth_token
        # For now, we'll use the api_key as auth_token and generate a mock account_sid
        account_sid = f"AC{api_key[:32]}"  # Mock account SID
        return TwilioAdapter(account_sid, api_key)
    elif provider == TelephonyProvider.telnyx:
        return TelnyxAdapter(api_key)
    else:
        raise ValueError(f"Unsupported provider: {provider}")

@lru_cache(maxsize=256)
def get_countries_cached(provider: str, workspace_id: str) -> List[Country]:
    """Get countries for a provider with caching"""
    # This is a simplified version - in production, you'd want to check
    # if the workspace has the provider connected
    if provider == "twilio":
        adapter = TwilioAdapter("mock_sid", "mock_token")
        return adapter.list_countries()
    elif provider == "telnyx":
        adapter = TelnyxAdapter("mock_token")
        return adapter.list_countries()
    else:
        raise ValueError(f"Unsupported provider: {provider}")

@lru_cache(maxsize=1024)
def get_capabilities_cached(provider: str, workspace_id: str, country: str) -> Capabilities:
    """Get capabilities for a provider/country combination with caching"""
    if provider == "twilio":
        adapter = TwilioAdapter("mock_sid", "mock_token")
        return adapter.get_capabilities(country)
    elif provider == "telnyx":
        adapter = TelnyxAdapter("mock_token")
        return adapter.get_capabilities(country)
    else:
        raise ValueError(f"Unsupported provider: {provider}")

async def get_countries(provider: str, workspace_id: str, db: Session) -> List[Country]:
    """Get countries for a provider, checking if workspace has access"""
    # Check if workspace has this provider connected
    provider_account = db.query(ProviderAccount).filter_by(
        workspace_id=workspace_id,
        provider=TelephonyProvider(provider)
    ).first()
    
    if not provider_account:
        raise HTTPException(
            status_code=401,
            detail=f"Provider {provider} not connected. Please connect your account first."
        )
    
    # Get the actual provider adapter with real credentials
    api_key = dec(provider_account.api_key_encrypted)
    adapter = get_provider_adapter(TelephonyProvider(provider), api_key)
    
    try:
        return await adapter.list_countries()
    except Exception as e:
        # Fallback to cached data if API fails
        return get_countries_cached(provider, workspace_id)

async def get_capabilities(provider: str, workspace_id: str, country: str, db: Session) -> Capabilities:
    """Get capabilities for a provider/country combination"""
    # Check if workspace has this provider connected
    provider_account = db.query(ProviderAccount).filter_by(
        workspace_id=workspace_id,
        provider=TelephonyProvider(provider)
    ).first()
    
    if not provider_account:
        raise HTTPException(
            status_code=401,
            detail=f"Provider {provider} not connected. Please connect your account first."
        )
    
    # Get the actual provider adapter with real credentials
    api_key = dec(provider_account.api_key_encrypted)
    adapter = get_provider_adapter(TelephonyProvider(provider), api_key)
    
    try:
        return await adapter.get_capabilities(country)
    except Exception as e:
        # Fallback to cached data if API fails
        return get_capabilities_cached(provider, workspace_id, country)

async def get_pricing_twilio(workspace_id: str, origin: str, destination: str, db: Session) -> PricingInfo:
    """Get Twilio pricing for a route"""
    # Check if workspace has Twilio connected
    provider_account = db.query(ProviderAccount).filter_by(
        workspace_id=workspace_id,
        provider=TelephonyProvider.twilio
    ).first()
    
    if not provider_account:
        raise HTTPException(
            status_code=401,
            detail="Twilio not connected. Please connect your Twilio account first."
        )
    
    # Get the Twilio adapter with real credentials
    api_key = dec(provider_account.api_key_encrypted)
    adapter = TwilioAdapter("mock_sid", api_key)  # We'll need to store account_sid separately
    
    try:
        return await adapter.get_pricing(origin, destination)
    except Exception as e:
        return PricingInfo(
            available=False,
            notes=["Pricing lookup failed", "Contact Twilio support for rates"]
        )
