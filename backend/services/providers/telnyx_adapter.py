# backend/services/providers/telnyx_adapter.py
import httpx
from typing import List, Dict
from backend.schemas.telephony_coverage import Country, Capabilities, Requirement, PricingInfo

class TelnyxAdapter:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.telnyx.com"
        self.headers = {"Authorization": f"Bearer {api_key}"}
    
    async def list_countries(self) -> List[Country]:
        """Get list of countries with phone number availability"""
        # TODO: Implement real Telnyx API call to /phone_numbers/orders
        # For now, return mock data based on common Telnyx coverage
        
        mock_countries = [
            {
                "code": "US",
                "name": "United States",
                "capabilities": {
                    "buy": {"local": True, "mobile": True, "tollfree": True},
                    "features": {"voice": True, "sms": True, "mms": True},
                    "import_supported": True,
                    "regulatory": [
                        {
                            "number_type": "local",
                            "entity": "business",
                            "fields": ["business_registration", "proof_of_address", "ein"]
                        },
                        {
                            "number_type": "tollfree",
                            "entity": "business",
                            "fields": ["business_registration", "proof_of_address", "ein", "tollfree_application"]
                        }
                    ],
                    "notes": ["Local numbers require in-country address", "Toll-free requires special application"]
                }
            },
            {
                "code": "IT",
                "name": "Italy",
                "capabilities": {
                    "buy": {"local": True, "mobile": False, "tollfree": False},
                    "features": {"voice": True, "sms": True, "mms": False},
                    "import_supported": True,
                    "regulatory": [
                        {
                            "number_type": "local",
                            "entity": "business",
                            "fields": ["business_registration", "italian_address", "vat_number"]
                        }
                    ],
                    "notes": ["Requires Italian business registration", "Local address mandatory"]
                }
            },
            {
                "code": "DE",
                "name": "Germany",
                "capabilities": {
                    "buy": {"local": True, "mobile": False, "tollfree": False},
                    "features": {"voice": True, "sms": True, "mms": False},
                    "import_supported": True,
                    "regulatory": [
                        {
                            "number_type": "local",
                            "entity": "business",
                            "fields": ["business_registration", "german_address", "tax_id"]
                        }
                    ],
                    "notes": ["Requires German business registration", "Local address mandatory"]
                }
            },
            {
                "code": "GB",
                "name": "United Kingdom",
                "capabilities": {
                    "buy": {"local": True, "mobile": False, "tollfree": False},
                    "features": {"voice": True, "sms": True, "mms": False},
                    "import_supported": True,
                    "regulatory": [
                        {
                            "number_type": "local",
                            "entity": "business",
                            "fields": ["business_registration", "uk_address", "vat_number"]
                        }
                    ],
                    "notes": ["Requires UK business registration", "Local address mandatory"]
                }
            }
        ]
        
        return [Country(**country) for country in mock_countries]
    
    async def get_capabilities(self, country_code: str) -> Capabilities:
        """Get capabilities for a specific country"""
        countries = await self.list_countries()
        country = next((c for c in countries if c.code == country_code), None)
        if not country:
            raise ValueError(f"Country {country_code} not found")
        return country.capabilities
    
    async def get_pricing(self, origin: str, destination: str) -> PricingInfo:
        """Telnyx pricing often not publicly available via API"""
        return PricingInfo(
            available=False,
            notes=["Pricing not publicly available via API", "Contact Telnyx sales for rates"]
        )
