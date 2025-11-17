"""SQLAlchemy models for Agoralia"""
from config.database import Base
from .calls import CallRecord, CallSegment, ScheduledCall
from .billing import Plan, Subscription, UsageEvent, Addon, Entitlement
from .workflows import WorkflowUsage, WorkflowEmailEvent
from .users import User
from .webhooks import WebhookEvent, WebhookDLQ
from .crm import CRMConnection, CRMMappings
from .settings import AppSettings, AppMeta
from .workspace_settings import WorkspaceSettings
from .user_preferences import UserPreferences
from .agents import Agent, KnowledgeBase, KnowledgeSection, PhoneNumber, TenantAgent
from .campaigns import Campaign, Lead
from .compliance import CostEvent, DNCEntry, Consent, CountryRule

# Note: Disposition, CallMedia, CallStructured, CallSummary removed - migrated to CallRecord
# Note: UserPlanOverride, EmailProviderSettings removed - not used

__all__ = [
    "Base",
    "CallRecord",
    "CallSegment",
    "ScheduledCall",
    "Plan",
    "Subscription",
    "UsageEvent",
    "Addon",
    "Entitlement",
    "WorkflowUsage",
    "WorkflowEmailEvent",
    "User",
    "WebhookEvent",
    "WebhookDLQ",
    "CRMConnection",
    "CRMMappings",
    "AppSettings",
    "AppMeta",
    "WorkspaceSettings",
    "UserPreferences",
    "Agent",
    "KnowledgeBase",
    "KnowledgeSection",
    "PhoneNumber",
    "TenantAgent",
    "Campaign",
    "Lead",
    "CostEvent",
    "DNCEntry",
    "Consent",
    "CountryRule",
]

