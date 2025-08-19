"""
HubSpot CRM client implementation
"""
import httpx
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import json

from .base import ClientBase, CrmError, RateLimitError, AuthenticationError, ValidationError


class HubSpotClient(ClientBase):
    """HubSpot CRM client"""
    
    BASE_URL = "https://api.hubapi.com"
    API_VERSION = "v3"
    
    def __init__(self, workspace_id: str, credentials: Dict[str, Any]):
        super().__init__(workspace_id, credentials)
        self.access_token = credentials.get("access_token")
        self.refresh_token = credentials.get("refresh_token")
        self.expires_at = credentials.get("expires_at")
        self.portal_id = credentials.get("portal_id")
        
        if not self.access_token:
            raise ValidationError("Missing access_token", "hubspot", "init")
    
    async def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make authenticated request to HubSpot API"""
        url = f"{self.BASE_URL}/{self.API_VERSION}/{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(
                    method, url, headers=headers, **kwargs
                )
                
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    raise RateLimitError(
                        "Rate limit exceeded", "hubspot", endpoint, 
                        {"retry_after": retry_after}
                    )
                
                if response.status_code == 401:
                    raise AuthenticationError(
                        "Invalid or expired token", "hubspot", endpoint
                    )
                
                if response.status_code >= 400:
                    error_data = response.json() if response.content else {}
                    raise CrmError(
                        f"HubSpot API error: {response.status_code}", 
                        "hubspot", endpoint, error_data
                    )
                
                return response.json() if response.content else {}
                
            except httpx.RequestError as e:
                raise CrmError(f"Request failed: {e}", "hubspot", endpoint)
    
    async def healthcheck(self) -> Dict[str, Any]:
        """Check connection health"""
        try:
            # Test with a simple API call
            result = await self._make_request("GET", "crm/v3/objects/contacts?limit=1")
            return {
                "status": "healthy",
                "provider": "hubspot",
                "portal_id": self.portal_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": "hubspot",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def upsert_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update contact"""
        # Map our fields to HubSpot properties
        properties = {
            "firstname": contact_data.get("firstname"),
            "lastname": contact_data.get("lastname"),
            "email": contact_data.get("email"),
            "phone": contact_data.get("phone"),
            "company": contact_data.get("company"),
            "country": contact_data.get("country")
        }
        
        # Remove None values
        properties = {k: v for k, v in properties.items() if v is not None}
        
        payload = {"properties": properties}
        
        if contact_data.get("id"):
            # Update existing contact
            endpoint = f"crm/v3/objects/contacts/{contact_data['id']}"
            result = await self._make_request("PATCH", endpoint, json=payload)
        else:
            # Create new contact
            endpoint = "crm/v3/objects/contacts"
            result = await self._make_request("POST", endpoint, json=payload)
        
        return {
            "id": result.get("id"),
            "properties": result.get("properties", {}),
            "created_at": result.get("createdAt"),
            "updated_at": result.get("updatedAt")
        }
    
    async def upsert_company(self, company_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update company"""
        properties = {
            "name": company_data.get("name"),
            "phone": company_data.get("phone"),
            "country": company_data.get("country"),
            "industry": company_data.get("industry")
        }
        
        properties = {k: v for k, v in properties.items() if v is not None}
        payload = {"properties": properties}
        
        if company_data.get("id"):
            endpoint = f"crm/v3/objects/companies/{company_data['id']}"
            result = await self._make_request("PATCH", endpoint, json=payload)
        else:
            endpoint = "crm/v3/objects/companies"
            result = await self._make_request("POST", endpoint, json=payload)
        
        return {
            "id": result.get("id"),
            "properties": result.get("properties", {}),
            "created_at": result.get("createdAt"),
            "updated_at": result.get("updatedAt")
        }
    
    async def upsert_deal(self, deal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update deal"""
        properties = {
            "dealname": deal_data.get("dealname"),
            "amount": deal_data.get("amount"),
            "dealstage": deal_data.get("dealstage"),
            "closedate": deal_data.get("closedate")
        }
        
        properties = {k: v for k, v in properties.items() if v is not None}
        payload = {"properties": properties}
        
        if deal_data.get("id"):
            endpoint = f"crm/v3/objects/deals/{deal_data['id']}"
            result = await self._make_request("PATCH", endpoint, json=payload)
        else:
            endpoint = "crm/v3/objects/deals"
            result = await self._make_request("POST", endpoint, json=payload)
        
        return {
            "id": result.get("id"),
            "properties": result.get("properties", {}),
            "created_at": result.get("createdAt"),
            "updated_at": result.get("updatedAt")
        }
    
    async def pull_contacts(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull contacts from HubSpot"""
        endpoint = "crm/v3/objects/contacts"
        params = {"limit": 100}
        
        if filters:
            # Add filter parameters
            if filters.get("email"):
                params["filter"] = f"email={filters['email']}"
        
        result = await self._make_request("GET", endpoint, params=params)
        
        contacts = []
        for contact in result.get("results", []):
            contacts.append({
                "id": contact.get("id"),
                "properties": contact.get("properties", {}),
                "created_at": contact.get("createdAt"),
                "updated_at": contact.get("updatedAt")
            })
        
        return contacts
    
    async def pull_companies(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull companies from HubSpot"""
        endpoint = "crm/v3/objects/companies"
        params = {"limit": 100}
        
        if filters:
            if filters.get("name"):
                params["filter"] = f"name={filters['name']}"
        
        result = await self._make_request("GET", endpoint, params=params)
        
        companies = []
        for company in result.get("results", []):
            companies.append({
                "id": company.get("id"),
                "properties": company.get("properties", {}),
                "created_at": company.get("createdAt"),
                "updated_at": company.get("updatedAt")
            })
        
        return companies
    
    async def pull_deals(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull deals from HubSpot"""
        endpoint = "crm/v3/objects/deals"
        params = {"limit": 100}
        
        if filters:
            if filters.get("dealstage"):
                params["filter"] = f"dealstage={filters['dealstage']}"
        
        result = await self._make_request("GET", endpoint, params=params)
        
        deals = []
        for deal in result.get("results", []):
            deals.append({
                "id": deal.get("id"),
                "properties": deal.get("properties", {}),
                "created_at": deal.get("createdAt"),
                "updated_at": deal.get("updatedAt")
            })
        
        return deals
    
    async def associate_contact_company(self, contact_id: str, company_id: str) -> bool:
        """Associate contact with company"""
        try:
            # Create association between contact and company
            endpoint = "crm/v3/objects/contacts/associations"
            payload = {
                "inputs": [{
                    "from": {"id": contact_id},
                    "to": {"id": company_id},
                    "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 1}]
                }]
            }
            
            await self._make_request("PUT", endpoint, json=payload)
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to associate contact {contact_id} with company {company_id}: {e}")
            return False
    
    async def get_field_mapping(self) -> Dict[str, Any]:
        """Get default field mapping for HubSpot"""
        return {
            "contact": {
                "firstname": "firstname",
                "lastname": "lastname",
                "phone": "phone",
                "email": "email",
                "company": "company",
                "country": "country"
            },
            "company": {
                "name": "name",
                "phone": "phone",
                "country": "country",
                "industry": "industry"
            },
            "deal": {
                "dealname": "dealname",
                "amount": "amount",
                "dealstage": "dealstage",
                "closedate": "closedate"
            }
        }
    
    async def validate_credentials(self) -> bool:
        """Validate stored credentials"""
        try:
            health = await self.healthcheck()
            return health["status"] == "healthy"
        except Exception:
            return False
