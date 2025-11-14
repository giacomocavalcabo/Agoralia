"""Application settings models"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from config.database import Base


class AppSettings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    default_agent_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    default_from_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    default_spacing_ms: Mapped[Optional[int]] = mapped_column(Integer, default=1000)
    require_legal_review: Mapped[Optional[int]] = mapped_column(Integer, default=1)  # 1=true, 0=false
    legal_defaults_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    budget_monthly_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    budget_warn_percent: Mapped[Optional[int]] = mapped_column(Integer, default=80)
    budget_stop_enabled: Mapped[Optional[int]] = mapped_column(Integer, default=1)
    default_lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    supported_langs_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prefer_detect_language: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    kb_version_outbound: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    kb_version_inbound: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    
    # Default Quiet Hours
    quiet_hours_enabled: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=0)  # 0=false, 1=true
    quiet_hours_weekdays: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # "09:00-21:00"
    quiet_hours_saturday: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # "09:00-21:00" | "forbidden"
    quiet_hours_sunday: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # "forbidden" | "09:00-21:00"
    quiet_hours_timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # "Europe/Rome"


class AppMeta(Base):
    __tablename__ = "app_meta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    brand_logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    brand_color: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

