"""User preferences models (user-level)"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from config.database import Base


class UserPreferences(Base):
    __tablename__ = "user_preferences"
    
    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_preferences_user_id"),
        Index("idx_user_preferences_user_id", "user_id"),
        Index("idx_user_preferences_tenant_id", "tenant_id"),
    )
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    tenant_id: Mapped[int] = mapped_column(Integer, nullable=False)  # Logical value for isolation, not FK
    
    # UI/UX
    theme: Mapped[str] = mapped_column(String(16), default="system")  # "light" | "dark" | "system"
    ui_locale: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # "it-IT", "en-US" (override workspace)
    
    # Notifications
    email_notifications_enabled: Mapped[int] = mapped_column(Integer, default=1)  # 1=true, 0=false
    email_campaign_started: Mapped[int] = mapped_column(Integer, default=1)
    email_campaign_paused: Mapped[int] = mapped_column(Integer, default=1)
    email_budget_warning: Mapped[int] = mapped_column(Integer, default=1)
    email_compliance_alert: Mapped[int] = mapped_column(Integer, default=1)
    
    # Dashboard
    dashboard_layout: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSONB in Postgres
    default_view: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # "campaigns" | "calls" | "dashboard"
    
    # Table Preferences
    table_page_size: Mapped[int] = mapped_column(Integer, default=50)
    table_sort_preferences: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSONB in Postgres
    
    # Date/Time
    date_format: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"
    time_format: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)  # "24h" | "12h"
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # Override workspace timezone
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

