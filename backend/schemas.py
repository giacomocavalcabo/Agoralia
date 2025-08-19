from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum


# ===================== Knowledge Base Schemas =====================

class KbKind(str, Enum):
    COMPANY = "company"
    OFFER_PACK = "offer_pack"
    FAQ_POLICY = "faq_policy"


class KbType(str, Enum):
    SAAS = "saas"
    CONSULTING = "consulting"
    PHYSICAL = "physical"
    MARKETPLACE = "marketplace"
    LOGISTICS = "logistics"
    MANUFACTURING = "manufacturing"
    OTHER = "other"


class KbStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


class KbScope(str, Enum):
    WORKSPACE_DEFAULT = "workspace_default"
    NUMBER = "number"
    CAMPAIGN = "campaign"
    AGENT = "agent"


class SourceKind(str, Enum):
    CSV = "csv"
    FILE = "file"
    URL = "url"


class ImportJobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AiUsageKind(str, Enum):
    KB_EXTRACTION = "kb_extraction"
    KB_EMBEDDING = "kb_embedding"
    KB_SUMMARY = "kb_summary"


# Base schemas
class KbSectionBase(BaseModel):
    key: str = Field(..., description="Section identifier (e.g., purpose, vision)")
    title: str = Field(..., description="Human-readable section title")
    order_index: int = Field(0, description="Order for display")
    content_md: Optional[str] = Field(None, description="Markdown content")
    content_json: Optional[Dict[str, Any]] = Field(None, description="Structured content")


class KbFieldBase(BaseModel):
    key: str = Field(..., description="Field identifier")
    label: str = Field(..., description="Human-readable field label")
    value_text: Optional[str] = Field(None, description="Text value")
    value_json: Optional[Dict[str, Any]] = Field(None, description="Structured value")
    lang: str = Field("en-US", description="Language code")
    confidence: int = Field(100, ge=0, le=100, description="AI confidence score")


class KbSourceBase(BaseModel):
    kind: SourceKind = Field(..., description="Source type")
    url: Optional[str] = Field(None, description="URL for web sources")
    filename: Optional[str] = Field(None, description="Filename for file sources")
    meta_json: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class KbAssignmentBase(BaseModel):
    scope: KbScope = Field(..., description="Assignment scope")
    scope_id: Optional[str] = Field(None, description="ID of the scoped entity")
    kb_id: str = Field(..., description="Knowledge Base ID")


# Create schemas
class KbSectionCreate(KbSectionBase):
    pass


class KbFieldCreate(KbFieldBase):
    section_id: Optional[str] = Field(None, description="Parent section ID")


class KbSourceCreate(KbSourceBase):
    pass


class KbAssignmentCreate(KbAssignmentBase):
    pass


class KnowledgeBaseCreate(BaseModel):
    kind: KbKind = Field(..., description="Knowledge Base type")
    name: str = Field(..., description="Human-readable name")
    type: Optional[KbType] = Field(None, description="Business type (for offer packs)")
    locale_default: str = Field("en-US", description="Default language")
    meta_json: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


# Update schemas
class KbSectionUpdate(BaseModel):
    title: Optional[str] = None
    order_index: Optional[int] = None
    content_md: Optional[str] = None
    content_json: Optional[Dict[str, Any]] = None


class KbFieldUpdate(BaseModel):
    label: Optional[str] = None
    value_text: Optional[str] = None
    value_json: Optional[Dict[str, Any]] = None
    lang: Optional[str] = None
    confidence: Optional[int] = Field(None, ge=0, le=100)


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[KbType] = None
    locale_default: Optional[str] = None
    status: Optional[KbStatus] = None
    meta_json: Optional[Dict[str, Any]] = None


# Response schemas
class KbSectionResponse(KbSectionBase):
    id: str
    kb_id: str
    completeness_pct: int = Field(0, ge=0, le=100)
    updated_at: datetime
    
    class Config:
        from_attributes = True


class KbFieldResponse(KbFieldBase):
    id: str
    kb_id: str
    section_id: Optional[str]
    source_id: Optional[str]
    updated_at: datetime
    
    class Config:
        from_attributes = True


class KbSourceResponse(KbSourceBase):
    id: str
    workspace_id: str
    sha256: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class KbChunkResponse(BaseModel):
    id: str
    kb_id: Optional[str]
    section_id: Optional[str]
    source_id: Optional[str]
    sha256: str
    text: str
    lang: str
    tokens: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class KbAssignmentResponse(KbAssignmentBase):
    id: str
    workspace_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class KnowledgeBaseResponse(BaseModel):
    id: str
    workspace_id: str
    kind: KbKind
    name: str
    type: Optional[KbType]
    locale_default: str
    version: str
    status: KbStatus
    completeness_pct: int = Field(0, ge=0, le=100)
    freshness_score: int = Field(100, ge=0, le=100)
    meta_json: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class KnowledgeBaseDetailResponse(KnowledgeBaseResponse):
    sections: List[KbSectionResponse] = []
    fields: List[KbFieldResponse] = []
    sources: List[KbSourceResponse] = []
    assignments: List[KbAssignmentResponse] = []


class KbImportJobResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    source_id: str
    target_kb_id: Optional[str]
    template: Optional[str]
    status: ImportJobStatus
    progress_pct: int = Field(0, ge=0, le=100)
    estimated_cost_cents: int
    actual_cost_cents: int
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class AiUsageResponse(BaseModel):
    id: str
    workspace_id: str
    kind: AiUsageKind
    tokens_in: int
    tokens_out: int
    cost_micros: int
    job_id: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Import schemas
class ImportSourceRequest(BaseModel):
    source: KbSourceCreate
    target_kb_id: Optional[str] = Field(None, description="Target KB ID (create new if not provided)")
    template: Optional[str] = Field(None, description="Template to use for new KB")
    idempotency_key: Optional[str] = Field(None, description="Idempotency key to prevent duplicate imports")


class ImportMappingRequest(BaseModel):
    job_id: str
    mappings: Dict[str, str] = Field(..., description="Source field -> KB field mapping")


class ImportReviewRequest(BaseModel):
    job_id: str
    auto_merge: bool = Field(False, description="Automatically merge conflicts")
    publish_after: bool = Field(False, description="Publish KB after import")


# Resolve schemas
class KbResolveRequest(BaseModel):
    campaign_id: Optional[str] = None
    number_id: Optional[str] = None
    agent_id: Optional[str] = None
    lang: Optional[str] = None


class KbResolveResponse(BaseModel):
    kb_id: str
    kind: KbKind
    name: str
    type: Optional[KbType]
    locale: str
    sections: List[KbSectionResponse]
    fields: List[KbFieldResponse]
    meta: Dict[str, Any]


# Template schemas
class CompanyKbTemplate(BaseModel):
    purpose: str = Field(..., description="Company purpose (1 sentence)")
    vision: str = Field(..., description="Company vision")
    brand_voice: Dict[str, List[str]] = Field(..., description="Brand voice dos and don'ts")
    operating_areas: List[Dict[str, Any]] = Field(..., description="Countries and languages")
    icp: Dict[str, List[str]] = Field(..., description="Ideal Customer Profile")
    contacts: Dict[str, str] = Field(..., description="Contact information")
    policies: Dict[str, str] = Field(..., description="Company policies")
    legal_defaults: Dict[str, Any] = Field(..., description="Legal defaults per country")


class OfferPackTemplate(BaseModel):
    name: str = Field(..., description="Offer pack name")
    type: KbType = Field(..., description="Business type")
    languages: List[str] = Field(..., description="Supported languages")
    value_props: List[str] = Field(..., description="Value propositions")
    differentiators: List[str] = Field(..., description="Competitive differentiators")
    pricing_bands: List[Dict[str, Any]] = Field(..., description="Pricing tiers")
    qualification: Dict[str, str] = Field(..., description="BANT qualification")
    objections: List[Dict[str, str]] = Field(..., description="Common objections and responses")
    scripts: Dict[str, str] = Field(..., description="Opening and closing scripts")
    cta: List[str] = Field(..., description="Call to action options")
    faq: List[Dict[str, str]] = Field(..., description="Product FAQ")


# Utility schemas
class KbProgressResponse(BaseModel):
    kb_id: str
    name: str
    kind: KbKind
    completeness_pct: int
    freshness_score: int
    sections_count: int
    fields_count: int
    last_updated: datetime


class KbSearchRequest(BaseModel):
    q: Optional[str] = Field(None, description="Search query")
    kind: Optional[KbKind] = Field(None, description="Filter by KB kind")
    status: Optional[KbStatus] = Field(None, description="Filter by status")
    type: Optional[KbType] = Field(None, description="Filter by business type")
    lang: Optional[str] = Field(None, description="Filter by language")


class KbSearchResponse(BaseModel):
    results: List[KnowledgeBaseResponse]
    total: int
    page: int
    per_page: int
