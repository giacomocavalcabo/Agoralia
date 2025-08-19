"""
Odoo CRM client implementation using JSON-RPC
"""
import httpx
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import json
import xmlrpc.client

from .base import ClientBase, CrmError, RateLimitError, AuthenticationError, ValidationError


class OdooClient(ClientBase):
    """Odoo CRM client using JSON-RPC"""
    
    def __init__(self, workspace_id: str, credentials: Dict[str, Any]):
        super().__init__(workspace_id, credentials)
        self.url = credentials.get("url")
        self.database = credentials.get("database")
        self.username = credentials.get("username")
        self.password = credentials.get("password")
        self.api_key = credentials.get("api_key")  # Alternative to username/password
        
        if not all([self.url, self.database]):
            raise ValidationError("Missing required credentials", "odoo", "init")
        
        if not (self.username and self.password) and not self.api_key:
            raise ValidationError("Missing authentication", "odoo", "init")
        
        # Remove trailing slash from URL
        if self.url.endswith('/'):
            self.url = self.url[:-1]
    
    async def _authenticate(self) -> str:
        """Authenticate and get session ID"""
        if self.api_key:
            # Use API key authentication
            headers = {"Authorization": f"Bearer {self.api_key}"}
            return "api_key_auth"
        
        # Use username/password authentication
        auth_url = f"{self.url}/web/session/authenticate"
        payload = {
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
                "db": self.database,
                "login": self.username,
                "password": self.password
            },
            "id": 1
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(auth_url, json=payload)
                
                if response.status_code != 200:
                    raise AuthenticationError(
                        "Authentication failed", "odoo", "login"
                    )
                
                result = response.json()
                if result.get("error"):
                    raise AuthenticationError(
                        f"Authentication error: {result['error']}", "odoo", "login"
                    )
                
                # Get session ID from cookies
                cookies = response.cookies
                session_id = cookies.get("session_id")
                if not session_id:
                    raise AuthenticationError("No session ID received", "odoo", "login")
                
                return session_id
                
            except Exception as e:
                raise AuthenticationError(f"Authentication failed: {e}", "odoo", "login")
    
    async def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make authenticated request to Odoo"""
        session_id = await self._authenticate()
        
        if method == "GET":
            url = f"{self.url}{endpoint}"
            headers = {"Cookie": f"session_id={session_id}"}
        else:
            url = f"{self.url}/web/dataset/call_kw"
            headers = {
                "Cookie": f"session_id={session_id}",
                "Content-Type": "application/json"
            }
        
        async with httpx.AsyncClient() as client:
            try:
                if method == "GET":
                    response = await client.get(url, headers=headers)
                else:
                    response = await client.post(url, headers=headers, **kwargs)
                
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    raise RateLimitError(
                        "Rate limit exceeded", "odoo", endpoint,
                        {"retry_after": retry_after}
                    )
                
                if response.status_code == 401:
                    raise AuthenticationError("Session expired", "odoo", endpoint)
                
                if response.status_code >= 400:
                    error_data = response.json() if response.content else {}
                    raise CrmError(
                        f"Odoo API error: {response.status_code}",
                        "odoo", endpoint, error_data
                    )
                
                return response.json() if response.content else {}
                
            except httpx.RequestError as e:
                raise CrmError(f"Request failed: {e}", "odoo", endpoint)
    
    async def _call_method(self, model: str, method: str, args: List = None, kwargs: Dict = None) -> Any:
        """Call Odoo model method"""
        payload = {
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
                "model": model,
                "method": method,
                "args": args or [],
                "kwargs": kwargs or {}
            },
            "id": 1
        }
        
        result = await self._make_request("POST", "", json=payload)
        return result.get("result")
    
    async def healthcheck(self) -> Dict[str, Any]:
        """Check connection health"""
        try:
            # Test with a simple API call
            result = await self._call_method("res.users", "search_read", [], {"limit": 1})
            return {
                "status": "healthy",
                "provider": "odoo",
                "url": self.url,
                "database": self.database,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": "odoo",
                "url": self.url,
                "database": self.database,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def upsert_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update contact (res.partner)"""
        # Map our fields to Odoo fields
        vals = {
            "name": f"{contact_data.get('firstname', '')} {contact_data.get('lastname', '')}".strip(),
            "phone": contact_data.get("phone"),
            "email": contact_data.get("email"),
            "country_id": await self._get_country_id(contact_data.get("country")),
            "is_company": False
        }
        
        # Remove None values
        vals = {k: v for k, v in vals.items() if v is not None}
        
        if contact_data.get("id"):
            # Update existing contact
            await self._call_method("res.partner", "write", [contact_data["id"], vals])
            result = await self._call_method("res.partner", "read", [contact_data["id"]])
            contact = result[0] if result else {}
        else:
            # Create new contact
            contact_id = await self._call_method("res.partner", "create", [vals])
            result = await self._call_method("res.partner", "read", [contact_id])
            contact = result[0] if result else {}
        
        return {
            "id": contact.get("id"),
            "properties": contact,
            "created_at": contact.get("create_date"),
            "updated_at": contact.get("write_date")
        }
    
    async def upsert_company(self, company_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update company (res.partner with is_company=True)"""
        vals = {
            "name": company_data.get("name"),
            "phone": company_data.get("phone"),
            "country_id": await self._get_country_id(company_data.get("country")),
            "is_company": True,
            "industry": company_data.get("industry")
        }
        
        vals = {k: v for k, v in vals.items() if v is not None}
        
        if company_data.get("id"):
            await self._call_method("res.partner", "write", [company_data["id"], vals])
            result = await self._call_method("res.partner", "read", [company_data["id"]])
            company = result[0] if result else {}
        else:
            company_id = await self._call_method("res.partner", "create", [vals])
            result = await self._call_method("res.partner", "read", [company_id])
            company = result[0] if result else {}
        
        return {
            "id": company.get("id"),
            "properties": company,
            "created_at": company.get("create_date"),
            "updated_at": company.get("write_date")
        }
    
    async def upsert_deal(self, deal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update deal (crm.lead)"""
        vals = {
            "name": deal_data.get("dealname"),
            "expected_revenue": deal_data.get("amount"),
            "stage_id": await self._get_stage_id(deal_data.get("dealstage")),
            "date_deadline": deal_data.get("closedate"),
            "type": "opportunity"
        }
        
        vals = {k: v for k, v in vals.items() if v is not None}
        
        if deal_data.get("id"):
            await self._call_method("crm.lead", "write", [deal_data["id"], vals])
            result = await self._call_method("crm.lead", "read", [deal_data["id"]])
            deal = result[0] if result else {}
        else:
            deal_id = await self._call_method("crm.lead", "create", [vals])
            result = await self._call_method("crm.lead", "read", [deal_id])
            deal = result[0] if result else {}
        
        return {
            "id": deal.get("id"),
            "properties": deal,
            "created_at": deal.get("create_date"),
            "updated_at": deal.get("write_date")
        }
    
    async def _get_country_id(self, country_name: str) -> Optional[int]:
        """Get country ID by name"""
        if not country_name:
            return None
        
        countries = await self._call_method(
            "res.country", "search_read",
            [("name", "ilike", country_name)], {"limit": 1}
        )
        return countries[0]["id"] if countries else None
    
    async def _get_stage_id(self, stage_name: str) -> Optional[int]:
        """Get CRM stage ID by name"""
        if not stage_name:
            return None
        
        stages = await self._call_method(
            "crm.stage", "search_read",
            [("name", "ilike", stage_name)], {"limit": 1}
        )
        return stages[0]["id"] if stages else None
    
    async def pull_contacts(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull contacts from Odoo"""
        domain = [("is_company", "=", False)]
        
        if filters:
            if filters.get("email"):
                domain.append(("email", "ilike", filters["email"]))
        
        contacts = await self._call_method(
            "res.partner", "search_read", [domain], {"limit": 100}
        )
        
        return [{
            "id": contact["id"],
            "properties": contact,
            "created_at": contact.get("create_date"),
            "updated_at": contact.get("write_date")
        } for contact in contacts]
    
    async def pull_companies(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull companies from Odoo"""
        domain = [("is_company", "=", True)]
        
        if filters:
            if filters.get("name"):
                domain.append(("name", "ilike", filters["name"]))
        
        companies = await self._call_method(
            "res.partner", "search_read", [domain], {"limit": 100}
        )
        
        return [{
            "id": company["id"],
            "properties": company,
            "created_at": company.get("create_date"),
            "updated_at": company.get("write_date")
        } for company in companies]
    
    async def pull_deals(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pull deals from Odoo"""
        domain = [("type", "=", "opportunity")]
        
        if filters:
            if filters.get("dealstage"):
                domain.append(("stage_id.name", "ilike", filters["dealstage"]))
        
        deals = await self._call_method(
            "crm.lead", "search_read", [domain], {"limit": 100}
        )
        
        return [{
            "id": deal["id"],
            "properties": deal,
            "created_at": deal.get("create_date"),
            "updated_at": deal.get("write_date")
        } for deal in deals]
    
    async def associate_contact_company(self, contact_id: str, company_id: str) -> bool:
        """Associate contact with company"""
        try:
            # Set parent_id to link contact to company
            await self._call_method(
                "res.partner", "write",
                [int(contact_id), {"parent_id": int(company_id)}]
            )
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to associate contact {contact_id} with company {company_id}: {e}")
            return False
    
    async def get_field_mapping(self) -> Dict[str, Any]:
        """Get default field mapping for Odoo"""
        return {
            "contact": {
                "firstname": "name (first part)",
                "lastname": "name (last part)",
                "phone": "phone",
                "email": "email",
                "company": "parent_id (company)",
                "country": "country_id"
            },
            "company": {
                "name": "name",
                "phone": "phone",
                "country": "country_id",
                "industry": "industry"
            },
            "deal": {
                "dealname": "name",
                "amount": "expected_revenue",
                "dealstage": "stage_id",
                "closedate": "date_deadline"
            }
        }
    
    async def validate_credentials(self) -> bool:
        """Validate stored credentials"""
        try:
            health = await self.healthcheck()
            return health["status"] == "healthy"
        except Exception:
            return False
