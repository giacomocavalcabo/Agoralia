from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .db import Base


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    locale = Column(String, default="en-US")
    tz = Column(String, default="UTC")
    is_admin_global = Column(Boolean, default=False)
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class Workspace(Base):
    __tablename__ = "workspaces"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    plan = Column(String, default="core")
    created_at = Column(DateTime, default=datetime.utcnow)


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


