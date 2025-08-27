# backend/schemas/telephony_coverage.py
from pydantic import BaseModel
from typing import List, Literal, Optional, Dict

NumberType = Literal["local", "mobile", "tollfree"]
EntityType = Literal["business", "individual", "any"]

class Requirement(BaseModel):
    number_type: NumberType
    entity: EntityType
    fields: List[str]  # es: ["in_country_address", "business_registration", "proof_of_address"]

class Capabilities(BaseModel):
    buy: Dict[NumberType, bool]  # {"local": true, "mobile": false, "tollfree": true}
    features: Dict[str, bool]    # {"voice": true, "sms": true, "mms": false}
    import_supported: bool
    regulatory: List[Requirement]
    notes: List[str] = []
    outbound_cli_policy: Literal["hosted_only"] = "hosted_only"  # nostra policy globale

class Country(BaseModel):
    code: str                     # "IT"
    name: str                     # "Italy"
    supported_types: List[NumberType]
    capabilities: Capabilities

class PricingInfo(BaseModel):
    available: bool
    rate_per_minute: Optional[float] = None
    currency: str = "USD"
    notes: List[str] = []
