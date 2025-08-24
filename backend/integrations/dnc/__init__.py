"""
DNC (Do Not Call) Registry Integration

This module provides integration with national DNC registries for compliance checking.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class DNCProvider(ABC):
    """Abstract base class for DNC providers"""
    
    @abstractmethod
    def check(self, iso: str, e164: str) -> Tuple[bool, Optional[str]]:
        """
        Check if a phone number is in the DNC registry
        
        Args:
            iso: Country ISO code
            e164: Phone number in E.164 format
            
        Returns:
            Tuple of (in_registry, proof_url)
        """
        pass
    
    @abstractmethod
    def get_supported_countries(self) -> List[str]:
        """Get list of supported country ISO codes"""
        pass


class MockDNCProvider(DNCProvider):
    """Mock DNC provider for demo/testing purposes"""
    
    def __init__(self):
        # Mock data for demo
        self.mock_registry = {
            "US": {
                "+15551234567": True,  # In registry
                "+15559876543": False, # Not in registry
            },
            "IT": {
                "+39021234567": True,  # In registry
                "+39029876543": False, # Not in registry
            },
            "UK": {
                "+447911123456": True, # In registry
                "+447911987654": False, # Not in registry
            }
        }
    
    def check(self, iso: str, e164: str) -> Tuple[bool, Optional[str]]:
        """Mock DNC check"""
        iso = iso.upper()
        
        if iso not in self.mock_registry:
            return False, None
        
        # Check if number is in mock registry
        in_registry = self.mock_registry[iso].get(e164, False)
        
        # Generate mock proof URL
        proof_url = f"https://dnc.{iso.lower()}.gov/check/{e164}" if in_registry else None
        
        logger.info(f"Mock DNC check for {iso} {e164}: {in_registry}")
        
        return in_registry, proof_url
    
    def get_supported_countries(self) -> List[str]:
        """Get supported countries"""
        return list(self.mock_registry.keys())


class DNCService:
    """Service for managing DNC providers"""
    
    def __init__(self):
        self.providers: Dict[str, DNCProvider] = {}
        self._register_default_providers()
    
    def _register_default_providers(self):
        """Register default DNC providers"""
        # Register mock provider for demo
        mock_provider = MockDNCProvider()
        for country in mock_provider.get_supported_countries():
            self.providers[country] = mock_provider
        
        logger.info(f"Registered DNC providers for countries: {list(self.providers.keys())}")
    
    def register_provider(self, country_iso: str, provider: DNCProvider):
        """Register a DNC provider for a specific country"""
        self.providers[country_iso.upper()] = provider
        logger.info(f"Registered DNC provider for {country_iso}")
    
    def check_dnc(self, country_iso: str, e164: str) -> Tuple[bool, Optional[str]]:
        """
        Check DNC status for a phone number
        
        Args:
            country_iso: Country ISO code
            e164: Phone number in E.164 format
            
        Returns:
            Tuple of (in_registry, proof_url)
        """
        country_iso = country_iso.upper()
        
        if country_iso not in self.providers:
            logger.warning(f"No DNC provider for country {country_iso}")
            return False, None
        
        try:
            return self.providers[country_iso].check(country_iso, e164)
        except Exception as e:
            logger.error(f"Error checking DNC for {country_iso} {e164}: {e}")
            return False, None
    
    def get_supported_countries(self) -> List[str]:
        """Get list of countries with DNC support"""
        return list(self.providers.keys())
    
    def is_supported(self, country_iso: str) -> bool:
        """Check if a country has DNC support"""
        return country_iso.upper() in self.providers


# Global instance
dnc_service = DNCService()
