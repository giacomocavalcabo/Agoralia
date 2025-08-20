import enum
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Text, JSON, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from db import Base


# ===================== CRM Enums =====================

class CrmProvider(enum.Enum):
    HUBSPOT = "hubspot"
    ZOHO = "zoho"
    ODOO = "odoo"


class CrmConnectionStatus(enum.Enum):
    CONNECTED = "connected"
    ERROR = "error"
    DISCONNECTED = "disconnected"


class CrmObjectType(enum.Enum):
    CONTACT = "contact"
    COMPANY = "company"
    DEAL = "deal"
    ACTIVITY = "activity"


class CrmSyncDirection(enum.Enum):
    PUSH = "push"
    PULL = "pull"


class CrmLogLevel(enum.Enum):
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


class CrmWebhookStatus(enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    ERROR = "error"


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    locale = Column(String, default="en-US")
    tz = Column(String, default="UTC")
    is_admin_global = Column(Boolean, default=False)
    last_login_at = Column(DateTime)
    email_verified_at = Column(DateTime)
    totp_enabled = Column(Boolean, default=False)
    totp_verified_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class Workspace(Base):
    __tablename__ = "workspaces"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    plan = Column(String, default="core")
    created_at = Column(DateTime, default=datetime.utcnow)
    # Numbers: default caller ID for outbound
    default_from_number_e164 = Column(String)


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    workspace_id = Column(String, ForeignKey("workspaces.id"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    role = Column(String, default="viewer")
    invited_at = Column(DateTime)
    joined_at = Column(DateTime)


class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    status = Column(String, default="running")
    pacing_npm = Column(Integer, default=10)
    budget_cap_cents = Column(Integer, default=0)
    owner_user_id = Column(String, ForeignKey("users.id"))
    # Numbers: per-campaign caller ID override
    from_number_e164 = Column(String)


class Call(Base):
    __tablename__ = "calls"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"))
    lang = Column(String)
    iso = Column(String)
    status = Column(String)
    duration_s = Column(Integer, default=0)
    cost_cents = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Extended fields for admin analytics
    lead_id = Column(String)
    agent_id = Column(String)
    provider = Column(String)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    live = Column(Boolean, default=False)
    outcome = Column(String)
    meta_json = Column(JSON)


# ============== Extensions for Auth, Profiles, Billing, Compliance, Notifications, Audit ==============

class UserAuth(Base):
    __tablename__ = "user_auth"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False)  # password|magic|google|microsoft|github|apple|saml
    provider_id = Column(String)
    pass_hash = Column(String)
    passkey_credential_json = Column(JSON)
    totp_secret = Column(String)
    totp_verified_at = Column(DateTime)
    recovery_codes_json = Column(JSON)
    last_used_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class Profile(Base):
    __tablename__ = "profiles"
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    company = Column(String)
    country_iso = Column(String)
    phone_e164 = Column(String)
    newsletter_optin = Column(Boolean, default=False)


class Plan(Base):
    __tablename__ = "plans"
    id = Column(String, primary_key=True)
    code = Column(String, unique=True)
    name = Column(String)
    features_json = Column(JSON)
    concurrency_limit = Column(Integer, default=1)
    price_cents_m = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    plan_id = Column(String, ForeignKey("plans.id"))
    status = Column(String)
    started_at = Column(DateTime)
    current_period_end = Column(DateTime)


class UsageCounter(Base):
    __tablename__ = "usage_counters"
    workspace_id = Column(String, ForeignKey("workspaces.id"), primary_key=True)
    period_ym = Column(String, primary_key=True)  # YYYY-MM
    minutes_voice = Column(Integer, default=0)
    minutes_ai = Column(Integer, default=0)
    calls_count = Column(Integer, default=0)
    cost_cents = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow)


class Credit(Base):
    __tablename__ = "credits"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    cents = Column(Integer, default=0)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class ScheduledCall(Base):
    __tablename__ = "scheduled_calls"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    campaign_id = Column(String, ForeignKey("campaigns.id"))
    lead_id = Column(String)
    at = Column(DateTime)
    tz = Column(String)
    lang = Column(String)
    state = Column(String, default="scheduled")  # scheduled|running|done|failed|blocked
    reason = Column(String)


class Attestation(Base):
    __tablename__ = "attestations"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    campaign_id = Column(String, ForeignKey("campaigns.id"))
    iso = Column(String)
    notice_version = Column(String)
    inputs_json = Column(JSON)
    pdf_url = Column(String)
    sha256 = Column(String)
    signed_by_user_id = Column(String, ForeignKey("users.id"))
    signed_at = Column(DateTime)


class PreflightCheck(Base):
    __tablename__ = "preflight_checks"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    number_hash = Column(String)
    iso = Column(String)
    decision = Column(String)
    reasons_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"))
    user_id = Column(String, ForeignKey("users.id"))
    kind = Column(String)  # email|in_app
    locale = Column(String)
    subject = Column(String)
    body_md = Column(Text)
    sent_at = Column(DateTime)
    stats_json = Column(JSON)


class NotificationTarget(Base):
    __tablename__ = "notification_targets"
    notification_id = Column(String, ForeignKey("notifications.id"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)


class ActivityLog(Base):
    __tablename__ = "activity_log"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"))
    user_id = Column(String, ForeignKey("users.id"))
    actor_user_id = Column(String, ForeignKey("users.id"))
    actor_ip = Column(String)
    kind = Column(String)
    entity = Column(String)
    entity_id = Column(String)
    diff_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


# ===================== Numbers (BYO/Buy) =====================
class Number(Base):
    __tablename__ = "numbers"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    e164 = Column(String, nullable=False)
    country_iso = Column(String)
    source = Column(String, default="byo")  # byo|agoralia
    capabilities = Column(JSON)  # ["outbound","inbound","sms"]
    verified = Column(Boolean, default=False)
    verification_method = Column(String, default="none")  # voice|sms|none
    verified_at = Column(DateTime)
    provider = Column(String)  # retell|sip|other
    provider_ref = Column(String)
    can_inbound = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class NumberVerification(Base):
    __tablename__ = "number_verifications"
    id = Column(String, primary_key=True)
    number_id = Column(String, ForeignKey("numbers.id"))
    method = Column(String)  # voice|sms
    code = Column(String)
    status = Column(String, default="sent")  # sent|ok|failed|expired
    attempts = Column(Integer, default=0)
    last_sent_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class InboundRoute(Base):
    __tablename__ = "inbound_routes"
    id = Column(String, primary_key=True)
    number_id = Column(String, ForeignKey("numbers.id"))
    agent_id = Column(String)
    hours_json = Column(JSON)
    voicemail = Column(Boolean, default=False)
    transcript = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ===================== Outcomes & Templates =====================
class CallOutcome(Base):
    __tablename__ = "call_outcomes"
    id = Column(String, primary_key=True)
    call_id = Column(String, ForeignKey("calls.id"))
    campaign_id = Column(String, ForeignKey("campaigns.id"))
    workspace_id = Column(String, ForeignKey("workspaces.id"))
    template_name = Column(String)
    fields_json = Column(JSON)
    ai_summary_short = Column(Text)
    ai_summary_long = Column(Text)
    action_items_json = Column(JSON)
    sentiment = Column(Integer)
    score_lead = Column(Integer)
    next_step = Column(String)
    synced_crm_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class Template(Base):
    __tablename__ = "templates"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"))
    name = Column(String)
    fields_json = Column(JSON)
    crm_mapping_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


# ===================== Sprint 6 Extensions =====================

class MagicLink(Base):
    __tablename__ = "magic_links"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_seen_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    ip = Column(String)
    user_agent = Column(String)
    revoked_at = Column(DateTime)
    metadata_json = Column(JSON)


class ImpersonationSession(Base):
    __tablename__ = "impersonation_sessions"
    id = Column(String, primary_key=True)
    admin_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    target_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)


# ===================== Sprint 9: CRM Core Integrations =====================

class CrmConnection(Base):
    """CRM connection for a workspace"""
    __tablename__ = "crm_connections"
    
    id = Column(String, primary_key=True)
    workspace_id = Column(String, nullable=False)
    provider = Column(Enum(CrmProvider, name='crm_provider'), nullable=False)
    status = Column(Enum(CrmConnectionStatus, name='crm_connection_status'), nullable=False, default=CrmConnectionStatus.DISCONNECTED)
    
    # Connection details
    access_token_enc = Column(Text, nullable=True)  # Encrypted access token
    refresh_token_enc = Column(Text, nullable=True)  # Encrypted refresh token
    expires_at = Column(DateTime, nullable=True)
    base_url = Column(String, nullable=True)
    account_id = Column(String, nullable=True)
    dc_region = Column(String, nullable=True)  # For Zoho datacenter
    
    # Sync control
    sync_enabled = Column(Boolean, default=True)  # Master switch for sync
    kill_switch = Column(Boolean, default=False)  # Emergency pause for incidents
    
    # Configuration
    field_mappings = Column(JSON, default={})
    sync_settings = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('workspace_id', 'provider', name='uq_workspace_provider'),
    )


class CrmEntityLink(Base):
    __tablename__ = "crm_entity_links"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    provider = Column(Enum(CrmProvider, name='crm_provider'), nullable=False)
    object = Column(Enum(CrmObjectType, name='crm_object_type'), nullable=False)
    local_id = Column(String, nullable=False)
    remote_id = Column(String, nullable=False)
    remote_etag = Column(String, nullable=True)
    last_sync_at = Column(DateTime, default=datetime.utcnow)


class CrmFieldMapping(Base):
    __tablename__ = "crm_field_mappings"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    provider = Column(Enum(CrmProvider, name='crm_provider'), nullable=False)
    object = Column(Enum(CrmObjectType, name='crm_object_type'), nullable=False)
    mapping_json = Column(JSON, nullable=False)
    picklists_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class CrmSyncCursor(Base):
    __tablename__ = "crm_sync_cursors"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    provider = Column(Enum(CrmProvider, name='crm_provider'), nullable=False)
    object = Column(Enum(CrmObjectType, name='crm_object_type'), nullable=False)
    since_ts = Column(DateTime, nullable=True)
    cursor_token = Column(String, nullable=True)
    page_after = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class CrmSyncLog(Base):
    __tablename__ = "crm_sync_logs"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    provider = Column(Enum(CrmProvider, name='crm_provider'), nullable=False)
    level = Column(Enum(CrmLogLevel, name='crm_log_level'), nullable=False)
    object = Column(Enum(CrmObjectType, name='crm_object_type'), nullable=False)
    direction = Column(Enum(CrmSyncDirection, name='crm_sync_direction'), nullable=False)
    correlation_id = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    payload_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CrmWebhookEvent(Base):
    __tablename__ = "crm_webhook_events"
    id = Column(String, primary_key=True)
    provider = Column(Enum(CrmProvider, name='crm_provider'), nullable=False)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    event_id = Column(String, nullable=False)
    object = Column(Enum(CrmObjectType, name='crm_object_type'), nullable=False)
    payload_json = Column(JSON, nullable=False)
    status = Column(Enum(CrmWebhookStatus, name='crm_webhook_status'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)


# Legacy models for backward compatibility (will be removed in future)
# Note: Legacy models removed to avoid conflicts with new CRM models
# The new CrmConnection model replaces HubSpotConnection
# The new CrmFieldMapping model replaces the legacy version


class ExportJob(Base):
    __tablename__ = "export_jobs"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)  # 'calls', 'outcomes', 'leads'
    filters_json = Column(JSON, nullable=True)
    status = Column(String, nullable=False, default='pending')  # pending, processing, completed, failed
    file_url = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


# ===================== Sprint 8: Knowledge Base System =====================

class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    kind = Column(String, nullable=False)  # company, offer_pack, faq_policy
    name = Column(String, nullable=False)
    type = Column(String)  # saas, consulting, physical, marketplace, logistics, manufacturing, other
    locale_default = Column(String, default="en-US")
    version = Column(String, default="1.0.0")
    status = Column(String, default="draft")  # draft, published
    completeness_pct = Column(Integer, default=0)  # 0-100
    freshness_score = Column(Integer, default=100)  # 0-100
    meta_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime)


class KbSection(Base):
    __tablename__ = "kb_sections"
    id = Column(String, primary_key=True)
    kb_id = Column(String, ForeignKey("knowledge_bases.id"), nullable=False)
    key = Column(String, nullable=False)  # purpose, vision, value_props, etc.
    title = Column(String, nullable=False)
    order_index = Column(Integer, default=0)
    content_md = Column(Text)
    content_json = Column(JSON)
    completeness_pct = Column(Integer, default=0)  # 0-100
    updated_at = Column(DateTime, default=datetime.utcnow)


class KbField(Base):
    __tablename__ = "kb_fields"
    id = Column(String, primary_key=True)
    kb_id = Column(String, ForeignKey("knowledge_bases.id"), nullable=False)
    section_id = Column(String, ForeignKey("kb_sections.id"))
    key = Column(String, nullable=False)
    label = Column(String, nullable=False)
    value_text = Column(Text)
    value_json = Column(JSON)
    lang = Column(String, default="en-US")  # BCP-47 format
    source_id = Column(String, ForeignKey("kb_sources.id"))
    confidence = Column(Integer, default=100)  # 0-100
    completeness_pct = Column(Integer, default=0)  # 0-100
    freshness_score = Column(Integer, default=100)  # 0-100
    version = Column(Integer, default=1, nullable=False)  # Optimistic locking
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Unique constraint will be added via migration
    __table_args__ = (
        # This will be enforced at the database level
        # UniqueConstraint('kb_id', 'section_id', 'key', 'lang', name='uq_kb_fields_kb_section_key_lang')
    )


class KbSource(Base):
    __tablename__ = "kb_sources"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    kind = Column(String, nullable=False)  # csv, file, url
    url = Column(String)
    filename = Column(String)
    sha256 = Column(String, nullable=False)
    meta_json = Column(JSON)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)


class KbChunk(Base):
    __tablename__ = "kb_chunks"
    id = Column(String, primary_key=True)
    kb_id = Column(String, ForeignKey("knowledge_bases.id"))
    section_id = Column(String, ForeignKey("kb_sections.id"))
    source_id = Column(String, ForeignKey("kb_sources.id"))
    sha256 = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    lang = Column(String, default="en-US")
    tokens = Column(Integer, default=0)
    embedding = Column(JSON)  # pgvector will be added via migration
    created_at = Column(DateTime, default=datetime.utcnow)


class KbAssignment(Base):
    __tablename__ = "kb_assignments"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    scope = Column(String, nullable=False)  # workspace_default, number, campaign, agent
    scope_id = Column(String)  # number_id, campaign_id, agent_id
    kb_id = Column(String, ForeignKey("knowledge_bases.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class KbHistory(Base):
    __tablename__ = "kb_history"
    id = Column(String, primary_key=True)
    kb_id = Column(String, ForeignKey("knowledge_bases.id"), nullable=False)
    actor_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    diff_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class KbImportJob(Base):
    __tablename__ = "kb_import_jobs"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    source_id = Column(String, ForeignKey("kb_sources.id"), nullable=False)
    target_kb_id = Column(String, ForeignKey("knowledge_bases.id"))
    template = Column(String)  # company, offer_pack, etc.
    status = Column(String, default="queued")  # queued, running, reviewing, committing, done, failed, canceled
    progress_pct = Column(Integer, default=0)
    progress_json = Column(JSON)  # Detailed progress tracking
    cost_estimated_cents = Column(Integer, default=0)
    cost_actual_cents = Column(Integer, default=0)
    template_json = Column(JSON)  # Template configuration
    error_details = Column(JSON)  # Detailed error information
    idempotency_key = Column(String, unique=True)  # Prevent duplicate jobs
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)


class AiUsage(Base):
    __tablename__ = "ai_usage"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    kind = Column(String, nullable=False)  # kb_extraction, kb_embedding, kb_summary
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    cost_micros = Column(Integer, default=0)  # cost in microcents
    job_id = Column(String, ForeignKey("kb_import_jobs.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


# ===================== Legacy Models for Backward Compatibility =====================

# Note: Legacy models removed to avoid conflicts with new CRM models
# The new CrmConnection model replaces HubSpotConnection
# The new CrmFieldMapping model replaces the legacy version


class KbUsage(Base):
    __tablename__ = "kb_usage"
    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    kb_id = Column(String, ForeignKey("knowledge_bases.id"), nullable=False)
    kind = Column(String, nullable=False)  # resolve, prompt_bricks, etc.
    context = Column(JSON)  # Usage context (campaign_id, number_id, etc.)
    success = Column(Boolean, default=True)
    tokens_used = Column(Integer, default=0)
    cost_micros = Column(Integer, default=0)  # Cost in microcents
    meta_json = Column(JSON)  # Additional metadata
    created_at = Column(DateTime, default=datetime.utcnow)

