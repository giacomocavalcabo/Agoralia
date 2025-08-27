# backend/services/providers/twilio_adapter.py
import httpx
from typing import List, Dict
from backend.schemas_telephony_coverage import Country, Capabilities, Requirement, PricingInfo

class TwilioAdapter:
    def __init__(self, account_sid: str, auth_token: str):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.base_url = "https://api.twilio.com"
        self.auth = (account_sid, auth_token)
    
    async def list_countries(self) -> List[Country]:
        """Get list of countries with phone number availability"""
        # TODO: Implement real Twilio API call to /AvailablePhoneNumbers
        # For now, return mock data based on common Twilio coverage
        
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
        """Get pricing information for calls from origin to destination"""
        # TODO: Implement real Twilio pricing API call
        # For now, return mock pricing data
        
        # Mock pricing matrix
        pricing_matrix = {
            ("US", "IT"): {"rate": 0.15, "currency": "USD"},
            ("US", "DE"): {"rate": 0.12, "currency": "USD"},
            ("IT", "US"): {"rate": 0.08, "currency": "EUR"},
            ("DE", "US"): {"rate": 0.10, "currency": "EUR"},
        }
        
        route = (origin, destination)
        if route in pricing_matrix:
            return PricingInfo(
                available=True,
                rate_per_minute=pricing_matrix[route]["rate"],
                currency=pricing_matrix[route]["currency"]
            )
        
        return PricingInfo(
            available=False,
            notes=["Pricing not available for this route"]
        )
