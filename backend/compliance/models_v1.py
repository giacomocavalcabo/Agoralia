from typing import Literal, Optional, List, Dict, Any, Union
from pydantic import BaseModel, constr, Field, validator

class DNCRegistry(BaseModel):
    name: str
    url: Optional[str] = None
    access: str = "unknown"
    check_required_for_er: bool = False

class QuietHours(BaseModel):
    start: Optional[str] = None
    end: Optional[str] = None
    days: Optional[List[str]] = None
    timezone: Optional[str] = None

class ComplianceFlags(BaseModel):
    requires_consent_b2c: bool = False
    requires_consent_b2b: bool = False
    requires_dnc_scrub: bool = False
    allows_automated: bool = True
    recording_requires_consent: bool = False
    has_quiet_hours: bool = False

class Source(BaseModel):
    title: str
    url: Optional[str] = None
    updated: Optional[str] = None

class Exception(BaseModel):
    description: str
    conditions: Optional[str] = None

class RuleV1(BaseModel):
    country: str
    iso: str  # Support both 2 and 3 character ISOs (e.g., AND for Andorra)
    regime_b2c: str = "unspecified"  # More flexible
    regime_b2b: str = "unspecified"  # More flexible
    quiet_hours: Optional[Any] = None  # More flexible
    ai_disclosure: str = "unspecified"  # More flexible
    recording_basis: str = "unspecified"  # More flexible
    callerid_rules: Optional[str] = None
    dnc: Any = []  # More flexible
    flags: Optional[ComplianceFlags] = None
    recent_changes: Optional[str] = None
    last_verified: Optional[str] = None
    confidence: Optional[str] = None
    confidence_score: Optional[float] = None
    regime_b2c_text: Optional[str] = None
    regime_b2b_text: Optional[str] = None
    notes_for_product: Optional[str] = None
    sources: Any = []  # More flexible
    exceptions: Any = []  # More flexible
    
    @validator('flags', pre=True, always=True)
    def ensure_flags(cls, v):
        """Ensure flags exist with defaults"""
        if v is None:
            return ComplianceFlags()
        if isinstance(v, dict):
            return ComplianceFlags(**v)
        return v

class RulesV1Response(BaseModel):
    version: str = "v1"
    count: int
    rules: Dict[str, RuleV1]
