"""
Zoho CRM client implementation
"""
import httpx
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import json
import base64

from .base import ClientBase, CrmError, RateLimitError, AuthenticationError, ValidationError


class ZohoClient(ClientBase):
    """Zoho CRM client with DC-aware OAuth"""
    
    # Zoho has multiple data centers
    DC_URLS = {
        "US": "https://www.zohoapis.com",
        "EU": "https://www.zohoapis.eu", 
        "IN": "https://www.zohoapis.in",
        "AU": "https://www.zohoapis.com.au",
        "JP": "https://www.zohoapis.jp"
    }
    
    def __init__(self, workspace_id: str, credentials: Dict[str, Any]):
        super().__init__(workspace_id, credentials)
        self.client_id = credentials.get("client_id")
        self.client_secret = credentials.get("client_secret")
        self.refresh_token = credentials.get("refresh_token")
        self.dc = credentials.get("dc", "US")  # Default to US
        self.access_token = credentials.get("access_token")
        self.expires_at = credentials.get("expires_at")
        
        if not all([self.client_id, self.client_secret, self.refresh_token]):
            raise ValidationError("Missing required credentials", "zoho", "init")
        
        self.base_url = self.DC_URLS.get(self.dc, self.DC_URLS["US"])
    
    async def _refresh_access_token(self) -> str:
        """Refresh access token using refresh token"""
        url = f"https://accounts.zoho.com/oauth/v2/token"
        
        data = {
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "refresh_token"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, data=data)
                
                if response.status_code != 200:
                    raise AuthenticationError(
                        "Failed to refresh token", "zoho", "token_refresh"
                    )
                
                token_data = response.json()
                self.access_token = token_data["access_token"]
                self.expires_at = datetime.utcnow() + timedelta(hours=1)
                
                return self.access_token
                
            except Exception as e:
                raise AuthenticationError(f"Token refresh failed: {e}", "zoho", "token_refresh")
    
    async def _get_valid_token(self) -> str:
        """Get valid access token, refreshing if needed"""
        if not self.access_token or (self.expires_at and datetime.utcnow() >= self.expires_at):
            await self._refresh_access_token()
        return self.access_token
    
    async def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make authenticated request to Zoho API"""
        token = await self._get_valid_token()
        url = f"{self.base_url}/crm/v3/{endpoint}"
        
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
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
                        "Rate limit exceeded", "zoho", endpoint,
                        {"retry_after": retry_after}
                    )
                
                if response.status_code == 401:
                    # Try to refresh token once
                    await self._refresh_access_token()
                    token = self.access_token
                    headers["Authorization"] = f"Zoho-oauthtoken {token}"
                    
                    response = await client.request(method, url, headers=headers, **kwargs)
                    if response.status_code == 401:
                        raise AuthenticationError("Invalid credentials after refresh", "zoho", endpoint)
                
                if response.status_code >= 400:
                    error_data = response.json() if response.content else {}
                    raise CrmError(
                        f"Zoho API error: {response.status_code}",
                        "zoho", endpoint, error_data
                    )
                
                return response.json() if response.content else {}
                
            except httpx.RequestError as e:
                raise CrmError(f"Request failed: {e}", "zoho", endpoint)
    
    async def healthcheck(self) -> Dict[str, Any]:
        """Check connection health"""
        try:
            # Test with a simple API call
            result = await self._make_request("GET", "org")
            return {
                "status": "healthy",
                "provider": "zoho",
                "dc": self.dc,
                "org_name": result.get("org", {}).get("name"),
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": "zoho",
                "dc": self.dc,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def upsert_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update contact"""
        properties = {
            "First_Name": contact_data.get("firstname"),
            "Last_Name": contact_data.get("lastname"),
            "Phone": contact_data.get("phone"),
            "Email": contact_data.get("email"),
            "Account_Name": contact_data.get("company"),
            "Mailing_Country": contact_data.get("country")
        }
        
        properties = {k: v for k, v in properties.items() if v is not None}
        payload = {"data": [{"properties": properties}]}
        
        if contact_data.get("id"):
            # Update existing contact
            endpoint = f"Contacts/{contact_data['id']}"
            result = await self._make_request("PUT", endpoint, json=payload)
        else:
            # Create new contact
            endpoint = "Contacts"
            result = await self._make_request("POST", endpoint, json=payload)
        
        contact = result.get("data", [{}])[0]
        return {
            "id": contact.get("details", {}).get("id"),
            "properties": contact.get("properties", {}),
            "created_at": contact.get("details", {}).get("Created_Time"),
            "updated_at": contact.get("details", {}).get("Modified_Time")
        }
    
    async def upsert_company(self, company_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update company (Account in Zoho)"""
        properties = {
            "Account_Name": company_data.get("name"),
            "Phone": company_data.get("phone"),
            "Billing_Country": company_data.get("country"),
            "Industry": company_data.get("industry")
        }
        
        properties = {k: v for k, v in properties.items() if v is not None}
        payload = {"data": [{"properties": properties}]}
        
        if company_data.get("id"):
            endpoint = f"Accounts/{company_data['id']}"
            result = await self._make_request("PUT", endpoint, json=payload)
        else:
            endpoint = "Accounts"
            result = await self._make_request("POST", endpoint, json=payload)
        
        account = result.get("data", [{}])[0]
        return {
            "id": account.get("details", {}).get("id"),
            "properties": account.get("properties", {}),
            "created_at": account.get("details", {}).get("Created_Time"),
            "updated_at": account.get("details", {}).get("Modified_Time")
        }
    
    async def upsert_deal(self, deal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update deal (Deal in Zoho)"""
        properties = {
            "Deal_Name": deal_data.get("dealname"),
            "Amount": deal_data.get("amount"),
            "Stage": deal_data.get("dealstage"),
            "Closing_Date": deal_data.get("closedate")
        }
        
        properties = {k: v for k, v in properties.items() if v is not None}
        payload = {"data": [{"properties": properties}]}
        
        if deal_data.get("id"):
            endpoint = f"Deals/{deal_data['id']}"
            result = await self._make_request("PUT", endpoint, json=payload)
        else:
            endpoint = "Deals"
            result = await self._make_request("POST", endpoint, json=payload)
        
        deal = result.get("data", [{}])[0]
        return {
            "id": deal.get("details", {}).get("id"),
            "properties": deal.get("properties", {}),
            "created_at": deal.get("details", {}).get("Created_Time"),
            "updated_at": deal.get("details", {}).get("Modified_Time")
        }
    
    async def pull_contacts(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull contacts from Zoho"""
        endpoint = "Contacts"
        params = {"per_page": 100}
        
        if filters:
            if filters.get("email"):
                params["email"] = filters["email"]
        
        result = await self._make_request("GET", endpoint, params=params)
        
        contacts = []
        for contact in result.get("data", []):
            contacts.append({
                "id": contact.get("details", {}).get("id"),
                "properties": contact.get("properties", {}),
                "created_at": contact.get("details", {}).get("Created_Time"),
                "updated_at": contact.get("details", {}).get("Modified_Time")
            })
        
        return contacts
    
    async def pull_companies(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull companies from Zoho"""
        endpoint = "Accounts"
        params = {"per_page": 100}
        
        if filters:
            if filters.get("name"):
                params["account_name"] = filters["name"]
        
        result = await self._make_request("GET", endpoint, params=params)
        
        companies = []
        for company in result.get("data", []):
            companies.append({
                "id": company.get("details", {}).get("id"),
                "properties": company.get("properties", {}),
                "created_at": company.get("details", {}).get("Created_Time"),
                "updated_at": company.get("details", {}).get("Modified_Time")
            })
        
        return companies
    
    async def pull_deals(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull deals from Zoho"""
        endpoint = "Deals"
        params = {"per_page": 100}
        
        if filters:
            if filters.get("dealstage"):
                params["stage"] = filters["dealstage"]
        
        result = await self._make_request("GET", endpoint, params=params)
        
        deals = []
        for deal in result.get("data", []):
            deals.append({
                "id": deal.get("details", {}).get("id"),
                "properties": deal.get("properties", {}),
                "created_at": deal.get("details", {}).get("Created_Time"),
                "updated_at": deal.get("details", {}).get("Modified_Time")
            })
        
        return deals
    
    async def associate_contact_company(self, contact_id: str, company_id: str) -> bool:
        """Associate contact with company"""
        try:
            # Create association between contact and account
            endpoint = "Contacts/associations"
            payload = {
                "data": [{
                    "type": "Contacts",
                    "id": contact_id,
                    "association_data": [{
                        "type": "Accounts",
                        "id": company_id
                    }]
                }]
            }
            
            await self._make_request("POST", endpoint, json=payload)
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to associate contact {contact_id} with company {company_id}: {e}")
            return False
    
    async def get_field_mapping(self) -> Dict[str, Any]:
        """Get default field mapping for Zoho"""
        return {
            "contact": {
                "firstname": "First_Name",
                "lastname": "Last_Name",
                "phone": "Phone",
                "email": "Email",
                "company": "Account_Name",
                "country": "Mailing_Country"
            },
            "company": {
                "name": "Account_Name",
                "phone": "Phone",
                "country": "Billing_Country",
                "industry": "Industry"
            },
            "deal": {
                "dealname": "Deal_Name",
                "amount": "Amount",
                "dealstage": "Stage",
                "closedate": "Closing_Date"
            }
        }
    
    async def validate_credentials(self) -> bool:
        """Validate stored credentials"""
        try:
            health = await self.healthcheck()
            return health["status"] == "healthy"
        except Exception:
            return False
