"""
Base interface for CRM integrations
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ClientBase(ABC):
    """Base class for CRM client implementations"""
    
    def __init__(self, workspace_id: str, credentials: Dict[str, Any]):
        self.workspace_id = workspace_id
        self.credentials = credentials
        self.logger = logger.getChild(self.__class__.__name__)
    
    @abstractmethod
    async def healthcheck(self) -> Dict[str, Any]:
        """Check connection health and return status"""
        pass
    
    @abstractmethod
    async def upsert_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update contact"""
        pass
    
    @abstractmethod
    async def upsert_company(self, company_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update company"""
        pass
    
    @abstractmethod
    async def upsert_deal(self, deal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update deal/opportunity"""
        pass
    
    @abstractmethod
    async def pull_contacts(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull contacts from CRM"""
        pass
    
    @abstractmethod
    async def pull_companies(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull companies from CRM"""
        pass
    
    @abstractmethod
    async def pull_deals(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull deals from CRM"""
        pass
    
    @abstractmethod
    async def associate_contact_company(self, contact_id: str, company_id: str) -> bool:
        """Associate contact with company"""
        pass
    
    @abstractmethod
    async def get_field_mapping(self) -> Dict[str, Any]:
        """Get default field mapping for this CRM"""
        pass
    
    @abstractmethod
    async def validate_credentials(self) -> bool:
        """Validate stored credentials"""
        pass


class CrmError(Exception):
    """Base exception for CRM operations"""
    def __init__(self, message: str, provider: str, operation: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.provider = provider
        self.operation = operation
        self.details = details or {}
        super().__init__(self.message)


class RateLimitError(CrmError):
    """Rate limit exceeded"""
    pass


class AuthenticationError(CrmError):
    """Authentication failed"""
    pass


class ValidationError(CrmError):
    """Data validation failed"""
    pass
