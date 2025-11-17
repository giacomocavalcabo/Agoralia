"""Workspace settings models (tenant-level)"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from config.database import Base


class WorkspaceSettings(Base):
    __tablename__ = "workspace_settings"
    
    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_workspace_settings_tenant_id"),
        Index("idx_workspace_settings_tenant_id", "tenant_id"),
    )
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, nullable=False)  # Logical value, not FK
    
    # Operative
    default_agent_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    default_from_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    default_spacing_ms: Mapped[int] = mapped_column(Integer, default=1000)
    
    # Budget
    budget_monthly_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    budget_warn_percent: Mapped[int] = mapped_column(Integer, default=80)
    budget_stop_enabled: Mapped[int] = mapped_column(Integer, default=1)  # 1=true, 0=false
    
    # Quiet Hours Default
    quiet_hours_enabled: Mapped[int] = mapped_column(Integer, default=0)  # 0=false, 1=true
    quiet_hours_weekdays: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # "09:00-21:00"
    quiet_hours_saturday: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # "09:00-21:00" | "forbidden"
    quiet_hours_sunday: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # "forbidden" | "09:00-21:00"
    quiet_hours_timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # "Europe/Rome"
    
    # Compliance Configuration (how to use CountryRule, not the rules themselves)
    require_legal_review: Mapped[int] = mapped_column(Integer, default=1)  # 1=true, 0=false
    override_country_rules_enabled: Mapped[int] = mapped_column(Integer, default=0)  # 1=true, 0=false
    
    # Language/Agent
    default_lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # "it-IT", "en-US"
    supported_langs_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array (JSONB in Postgres)
    prefer_detect_language: Mapped[int] = mapped_column(Integer, default=0)  # 1=true, 0=false
    kb_version_outbound: Mapped[int] = mapped_column(Integer, default=0)  # For cache invalidation
    kb_version_inbound: Mapped[int] = mapped_column(Integer, default=0)
    
    # Branding
    workspace_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # "Europe/Rome"
    brand_logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    brand_color: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # "#RRGGBB"
    
    # Integrations (encrypted)
    retell_api_key_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Encrypted at rest
    retell_webhook_secret_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Encrypted at rest
    
    # Notifications
    email_notifications_enabled: Mapped[int] = mapped_column(Integer, default=1)  # 1=true, 0=false
    email_campaign_started: Mapped[int] = mapped_column(Integer, default=1)
    email_campaign_paused: Mapped[int] = mapped_column(Integer, default=1)
    email_budget_warning: Mapped[int] = mapped_column(Integer, default=1)
    email_compliance_alert: Mapped[int] = mapped_column(Integer, default=1)
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

