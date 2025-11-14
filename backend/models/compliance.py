"""Compliance-related models"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from config.database import Base


class Disposition(Base):
    __tablename__ = "dispositions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CallMedia(Base):
    __tablename__ = "call_media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    audio_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CallStructured(Base):
    __tablename__ = "call_structured"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    bant_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    trade_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CostEvent(Base):
    __tablename__ = "cost_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    component: Mapped[str] = mapped_column(String(32))  # telephony | llm | stt | tts
    amount: Mapped[int] = mapped_column(Integer)  # store cents to avoid FP
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class DNCEntry(Base):
    __tablename__ = "dnc_numbers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    e164: Mapped[str] = mapped_column(String(32))
    source: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    type: Mapped[str] = mapped_column(String(32))  # marketing | recording
    status: Mapped[str] = mapped_column(String(16))  # granted | denied
    source: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    proof_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CountryRule(Base):
    __tablename__ = "country_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # NULL = global default
    country_iso: Mapped[str] = mapped_column(String(8))  # ISO 3166-1 alpha-2
    
    # Regime B2B/B2C
    regime_b2b: Mapped[str] = mapped_column(String(16), default="opt_out")  # "opt_in" | "opt_out" | "allowed"
    regime_b2c: Mapped[str] = mapped_column(String(16), default="opt_out")  # "opt_in" | "opt_out" | "allowed"
    
    # DNC
    dnc_registry_enabled: Mapped[int] = mapped_column(Integer, default=0)  # 0=false, 1=true
    dnc_registry_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    dnc_registry_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dnc_check_required: Mapped[int] = mapped_column(Integer, default=0)  # 0=false, 1=true
    dnc_api_available: Mapped[int] = mapped_column(Integer, default=0)  # 0=false, 1=true
    
    # Quiet Hours
    quiet_hours_enabled: Mapped[int] = mapped_column(Integer, default=0)  # 0=false, 1=true
    quiet_hours_weekdays: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # "09:00-21:00"
    quiet_hours_saturday: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # "09:00-21:00" | "forbidden"
    quiet_hours_sunday: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # "forbidden" | "09:00-21:00"
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # "Europe/Rome"
    
    # AI Disclosure
    ai_disclosure_required: Mapped[int] = mapped_column(Integer, default=0)  # 0=false, 1=true
    ai_disclosure_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Recording
    recording_basis: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, default="consent")  # "consent" | "legitimate_interest"
    
    # Metadata
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON con rules, exceptions, sources
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

