"""Campaign and lead models"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from config.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    status: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # draft | scheduled | running | paused | completed | cancelled
    
    # Agent and phone configuration
    agent_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)  # Retell agent ID
    from_number_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("numbers.id"), nullable=True)  # PhoneNumber.id
    kb_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("kbs.id"), nullable=True)  # Knowledge base ID
    
    # Scheduling
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, default="UTC")
    
    # Limits & Budget
    max_calls_per_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    budget_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cost_per_call_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=100)  # Stima default
    
    # Stats (computed, aggiornati via worker/webhook)
    calls_made: Mapped[int] = mapped_column(Integer, default=0)
    calls_successful: Mapped[int] = mapped_column(Integer, default=0)
    calls_failed: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_cents: Mapped[int] = mapped_column(Integer, default=0)
    
    # Metadata
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    company: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    phone: Mapped[str] = mapped_column(String(32))
    country_iso: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    preferred_lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # supplier | supplied
    consent_basis: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    consent_status: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # granted | denied | unknown
    campaign_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("campaigns.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

