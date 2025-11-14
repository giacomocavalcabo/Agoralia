"""Workflow-related models"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from config.database import Base


class WorkflowUsage(Base):
    __tablename__ = "workflow_usage"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    emails_sent: Mapped[int] = mapped_column(Integer, default=0)
    webhooks_sent: Mapped[int] = mapped_column(Integer, default=0)
    actions_executed: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WorkflowEmailEvent(Base):
    __tablename__ = "workflow_email_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    workflow_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    to_email: Mapped[str] = mapped_column(String(256))
    template_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    billed: Mapped[int] = mapped_column(Integer, default=0)


# Note: EmailProviderSettings removed - not used in routes

