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


class CallSummary(Base):
    __tablename__ = "summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    call_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("calls.id"), nullable=True)
    provider_call_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    bullets_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


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

