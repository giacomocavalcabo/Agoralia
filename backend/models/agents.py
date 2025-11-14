"""Agent and knowledge base models"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from config.database import Base


class TenantAgent(Base):
    __tablename__ = "tenant_agents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(16))  # chat | voice
    lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    agent_id: Mapped[str] = mapped_column(String(128))
    is_multi: Mapped[int] = mapped_column(Integer, default=0)


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    voice_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class KnowledgeBase(Base):
    __tablename__ = "kbs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    scope: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)


class KnowledgeSection(Base):
    __tablename__ = "kb_sections"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    kb_id: Mapped[int] = mapped_column(Integer, ForeignKey("kbs.id"))
    kind: Mapped[str] = mapped_column(String(16))  # knowledge | rules | style
    content_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PhoneNumber(Base):
    __tablename__ = "numbers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    e164: Mapped[str] = mapped_column(String(32))
    type: Mapped[str] = mapped_column(String(16), default="retell")
    verified: Mapped[int] = mapped_column(Integer, default=0)
    country: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)

