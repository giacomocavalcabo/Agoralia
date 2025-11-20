"""Agent and knowledge base models"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, JSON, Float, Boolean
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
    name: Mapped[str] = mapped_column(String(256))
    lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    voice_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    retell_agent_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)  # Retell AI agent ID
    
    # Response Engine (JSON)
    response_engine: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Full response engine config
    
    # Welcome Message & Speaking
    begin_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Welcome/custom message
    start_speaker: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)  # "agent" or "user"
    begin_message_delay_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0-5000 ms
    
    # Voice Settings
    voice_model: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    fallback_voice_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # Array of voice IDs
    voice_temperature: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-2
    voice_speed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0.5-2
    volume: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-2
    
    # Agent Behavior
    responsiveness: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1
    interruption_sensitivity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1
    enable_backchannel: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    backchannel_frequency: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1
    backchannel_words: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # Array of strings
    reminder_trigger_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # ms
    reminder_max_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Ambient Sound
    ambient_sound: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # coffee-shop, convention-hall, etc.
    ambient_sound_volume: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-2
    
    # Language & Webhook
    webhook_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    webhook_timeout_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # ms
    
    # Transcription & Keywords
    boosted_keywords: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # Array of strings
    stt_mode: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # "fast" or "accurate"
    vocab_specialization: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # "general" or "medical"
    denoising_mode: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # noise-cancellation, etc.
    
    # Data Storage
    data_storage_setting: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # everything, everything_except_pii, basic_attributes_only
    opt_in_signed_url: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    # Speech Settings
    pronunciation_dictionary: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # Array of dicts
    normalize_for_speech: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    # Call Settings
    end_call_after_silence_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # ms, min 10000
    max_call_duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # ms, 60000-7200000
    ring_duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # ms, 5000-90000
    
    # Voicemail
    voicemail_option: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Post-Call Analysis
    post_call_analysis_data: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # Array of dicts
    post_call_analysis_model: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # gpt-4o-mini, etc.
    
    # DTMF
    allow_user_dtmf: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    user_dtmf_options: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # PII
    pii_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Knowledge Base (stored as JSON array of Retell KB IDs for quick access)
    knowledge_base_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # Array of Retell KB IDs
    
    # Additional agent metadata (role, mission, custom prompt - for UI)
    role: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # inbound, outbound, both
    mission: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Mission/objective description
    custom_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Additional custom instructions
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class KnowledgeBase(Base):
    __tablename__ = "kbs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lang: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    scope: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    retell_kb_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)  # Retell AI KB ID (knowledge_base_xxx)


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

