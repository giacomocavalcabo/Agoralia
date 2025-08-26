from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union, Literal
from datetime import datetime
from enum import Enum


# ===================== Authentication Schemas =====================

class LoginRequest(BaseModel):
    """Schema for login requests - minimal validation"""
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")

class RegisterRequest(BaseModel):
    """Schema for user registration - full validation"""
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password (must meet policy)")
    name: str = Field(..., description="User full name")
    
    @validator('password')
    def validate_password(cls, v):
        """Password policy validation for registration only"""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c in "!@#$%^&*(),.?\":{}|<>" for c in v):
            raise ValueError("Password must contain at least one special character")
        return v

class AuthResponse(BaseModel):
    """Schema for authentication responses"""
    ok: bool = Field(..., description="Authentication success status")
    user: Optional[Dict[str, Any]] = Field(None, description="User data if successful")
    message: Optional[str] = Field(None, description="Response message")
    requires_totp: Optional[bool] = Field(False, description="TOTP required flag")

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
    MANUAL = "manual"
    UPLOAD = "upload"


class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class ChunkType(str, Enum):
    COMPANY = "company"
    PRODUCT = "product"
    PRICING = "pricing"
    CONTACT = "contact"
    POLICY = "policy"
    FAQ = "faq"
    GENERAL = "general"


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


# ===================== Document & Chunk Schemas =====================

class KbDocumentBase(BaseModel):
    """Base schema for KB documents"""
    title: Optional[str] = Field(None, description="Document title")
    mime_type: str = Field(..., description="MIME type of the document")
    bytes: int = Field(..., description="File size in bytes")
    checksum: str = Field(..., description="SHA256 checksum")
    lang: str = Field("en-US", description="Document language (BCP-47)")
    status: DocumentStatus = Field(DocumentStatus.PENDING, description="Processing status")


class KbDocumentCreate(KbDocumentBase):
    """Schema for creating a new KB document"""
    source_id: str = Field(..., description="Source ID that this document belongs to")


class KbDocumentResponse(KbDocumentBase):
    """Schema for KB document responses"""
    id: str
    source_id: str
    version: int
    parsed_text: Optional[str] = None
    outline_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class KbChunkBase(BaseModel):
    """Base schema for KB chunks"""
    text: str = Field(..., description="Chunk text content")
    lang: str = Field("en-US", description="Chunk language")
    tokens: int = Field(0, description="Number of tokens")
    meta_json: Optional[Dict[str, Any]] = Field(None, description="Metadata (type, section, etc.)")


class KbChunkCreate(KbChunkBase):
    """Schema for creating a new KB chunk"""
    doc_id: str = Field(..., description="Document ID this chunk belongs to")
    idx: int = Field(..., description="Chunk index in document")


class KbChunkResponse(KbChunkBase):
    """Schema for KB chunk responses"""
    id: str
    doc_id: str
    kb_id: Optional[str] = None
    section_id: Optional[str] = None
    source_id: Optional[str] = None
    embedding: Optional[List[float]] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class KbChunkSearch(BaseModel):
    """Schema for chunk search requests"""
    query: Optional[str] = Field(None, description="Search query")
    doc_id: Optional[str] = Field(None, description="Filter by document ID")
    type: Optional[ChunkType] = Field(None, description="Filter by chunk type")
    lang: Optional[str] = Field(None, description="Filter by language")
    semantic_type: Optional[str] = Field(None, description="Filter by semantic type")
    min_quality: Optional[float] = Field(None, ge=0.0, le=1.0, description="Minimum quality score")
    max_pii: Optional[float] = Field(None, ge=0.0, le=1.0, description="Maximum PII score")
    top_k: int = Field(20, ge=1, le=100, description="Maximum results")
    use_semantic: bool = Field(True, description="Use semantic search if available")


class KbChunkSearchResponse(BaseModel):
    """Schema for chunk search responses"""
    items: List[KbChunkResponse]
    total: int
    query: Optional[str] = None


# ===================== Source Management Schemas =====================

class KbSourceCreate(BaseModel):
    """Schema for creating a new KB source"""
    type: SourceKind = Field(..., description="Source type")
    label: str = Field(..., description="Human-readable label")
    url: Optional[str] = Field(None, description="URL for web sources")
    meta_json: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class KbSourceResponse(BaseModel):
    """Schema for KB source responses"""
    id: str
    workspace_id: str
    type: SourceKind
    label: str
    url: Optional[str] = None
    filename: Optional[str] = None
    sha256: str
    meta_json: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


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


# Prompt bricks schemas
class PromptBricksRequest(BaseModel):
    kb_id: Optional[str] = Field(None, description="Explicit KB ID to use (skip resolution if provided)")
    campaign_id: Optional[str] = None
    number_id: Optional[str] = None
    agent_id: Optional[str] = None
    lang: Optional[str] = Field(None, description="Preferred language (BCP-47)")


class PromptBricksResponse(BaseModel):
    kb_id: str
    system: str
    rules: List[str] = []
    style: List[str] = []
    company_facts: List[str] = []
    disclaimers: List[str] = []
    opening_script: Optional[str] = None
    closing_script: Optional[str] = None


# Usage tracking schemas
class KbUsageTrackRequest(BaseModel):
    kb_id: str = Field(..., description="Knowledge Base ID")
    kind: str = Field(..., description="Usage type (resolve, prompt_bricks, etc.)")
    context: Optional[Dict[str, Any]] = Field(None, description="Usage context")
    success: bool = Field(..., description="Whether the usage was successful")
    tokens_used: Optional[int] = Field(None, description="Tokens consumed")
    cost_micros: Optional[int] = Field(None, description="Cost in microcents")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class MergeDecision(BaseModel):
    """Individual merge decision for a field"""
    field_key: str = Field(..., description="Field key to merge")
    field_id: Optional[str] = Field(None, description="Existing field ID (if updating)")
    action: Literal["keep_old", "use_new", "merge"] = Field(..., description="Merge action to take")
    new_value: Optional[str] = Field(None, description="New value (if using or merging)")

class MergeDecisions(BaseModel):
    """Collection of merge decisions for an import job"""
    decisions: List[MergeDecision] = Field(..., description="List of merge decisions")
    strategy: Literal["manual", "auto_accept_new", "auto_merge"] = Field("manual", description="Merge strategy")


class KbUsageResponse(BaseModel):
    id: str
    workspace_id: str
    kb_id: str
    kind: str
    context: Optional[Dict[str, Any]]
    success: bool
    tokens_used: int
    cost_micros: int
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True


class KbAnalyticsResponse(BaseModel):
    period: str
    total_usage: int
    overall_hit_rate: float
    kb_stats: Dict[str, Dict[str, Any]]
    period_start: str
    period_end: str
