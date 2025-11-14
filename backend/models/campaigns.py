"""Campaign and lead models"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from config.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    status: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # active | paused | done
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


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

