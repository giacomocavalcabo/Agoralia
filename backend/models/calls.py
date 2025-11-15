"""Call-related models"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from config.database import Base


class CallRecord(Base):
    __tablename__ = "calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    direction: Mapped[str] = mapped_column(String(16))
    provider: Mapped[str] = mapped_column(String(32), default="retell")
    to_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    from_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    provider_call_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="created")
    raw_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    audio_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Disposition fields (from dispositions table)
    disposition_outcome: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    disposition_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    disposition_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Media fields (from call_media table)
    media_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON: {"audio_urls": [...]}
    
    # Structured fields (from call_structured table)
    structured_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON: {"bant": {...}, "trade": {...}}
    
    # Summary fields (from summaries table)
    summary_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON: {"bullets": [...]}
    
    # Billing fields
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_cost_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Cost in cents to avoid float issues
    
    # Idempotency fields for webhook processing
    last_event_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    last_event_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class CallSegment(Base):
    __tablename__ = "call_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    provider_call_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    turn_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    speaker: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    start_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    end_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# Note: CallSummary removed - now stored in CallRecord.summary_json
# Kept for backward compatibility during migration if needed


class ScheduledCall(Base):
    __tablename__ = "scheduled_calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lead_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    to_number: Mapped[str] = mapped_column(String(32))
    from_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    agent_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    kb_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    campaign_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16), default="scheduled")  # scheduled|queued|done|canceled
    provider_call_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

