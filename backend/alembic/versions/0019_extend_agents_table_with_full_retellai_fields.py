"""Extend agents table with full RetellAI fields

Revision ID: 0019_extend_agents_table_with_full_retellai_fields
Revises: 0018_add_notifications_to_workspace_settings
Create Date: 2025-01-17 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0019_extend_agents_table_with_full_retellai_fields'
down_revision: Union[str, None] = '0018_add_notifications_to_workspace_settings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect, text
    import sys
    
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if agents table exists
    table_names = inspector.get_table_names()
    print(f"[MIGRATION 0019] Checking tables: {table_names}", file=sys.stderr, flush=True)
    
    if 'agents' not in table_names:
        print("⚠ agents table does not exist, skipping columns addition", file=sys.stderr, flush=True)
        return
    
    # Check existing columns
    existing_columns = [col['name'] for col in inspector.get_columns('agents')]
    print(f"[MIGRATION 0019] Existing columns: {existing_columns}", file=sys.stderr, flush=True)
    
    # Extend name column length
    if 'name' in existing_columns:
        op.alter_column('agents', 'name', type_=sa.String(256), existing_type=sa.String(128))
        conn.commit()
    
    # Add all new columns using direct SQL for reliability
    columns_to_add = [
        # Response Engine (JSON)
        ('response_engine', 'JSON', None),
        
        # Welcome Message & Speaking
        ('begin_message', 'TEXT', None),
        ('start_speaker', 'VARCHAR(8)', None),
        ('begin_message_delay_ms', 'INTEGER', None),
        
        # Voice Settings
        ('voice_model', 'VARCHAR(64)', None),
        ('fallback_voice_ids', 'JSON', None),
        ('voice_temperature', 'REAL', None),
        ('voice_speed', 'REAL', None),
        ('volume', 'REAL', None),
        
        # Agent Behavior
        ('responsiveness', 'REAL', None),
        ('interruption_sensitivity', 'REAL', None),
        ('enable_backchannel', 'BOOLEAN', None),
        ('backchannel_frequency', 'REAL', None),
        ('backchannel_words', 'JSON', None),
        ('reminder_trigger_ms', 'INTEGER', None),
        ('reminder_max_count', 'INTEGER', None),
        
        # Ambient Sound
        ('ambient_sound', 'VARCHAR(64)', None),
        ('ambient_sound_volume', 'REAL', None),
        
        # Language & Webhook
        ('webhook_url', 'TEXT', None),
        ('webhook_timeout_ms', 'INTEGER', None),
        
        # Transcription & Keywords
        ('boosted_keywords', 'JSON', None),
        ('stt_mode', 'VARCHAR(16)', None),
        ('vocab_specialization', 'VARCHAR(16)', None),
        ('denoising_mode', 'VARCHAR(64)', None),
        
        # Data Storage
        ('data_storage_setting', 'VARCHAR(32)', None),
        ('opt_in_signed_url', 'BOOLEAN', None),
        
        # Speech Settings
        ('pronunciation_dictionary', 'JSON', None),
        ('normalize_for_speech', 'BOOLEAN', None),
        
        # Call Settings
        ('end_call_after_silence_ms', 'INTEGER', None),
        ('max_call_duration_ms', 'INTEGER', None),
        ('ring_duration_ms', 'INTEGER', None),
        
        # Voicemail
        ('voicemail_option', 'JSON', None),
        
        # Post-Call Analysis
        ('post_call_analysis_data', 'JSON', None),
        ('post_call_analysis_model', 'VARCHAR(32)', None),
        
        # DTMF
        ('allow_user_dtmf', 'BOOLEAN', None),
        ('user_dtmf_options', 'JSON', None),
        
        # PII
        ('pii_config', 'JSON', None),
        
        # Knowledge Base
        ('knowledge_base_ids', 'JSON', None),
        
        # Additional metadata
        ('role', 'VARCHAR(16)', None),
        ('mission', 'TEXT', None),
        ('custom_prompt', 'TEXT', None),
        
        # Timestamps
        ('created_at', 'TIMESTAMP WITH TIME ZONE', 'DEFAULT NOW()'),
        ('updated_at', 'TIMESTAMP WITH TIME ZONE', 'DEFAULT NOW()'),
    ]
    
    columns_added = []
    for col_name, col_type, default_sql in columns_to_add:
        if col_name not in existing_columns:
            try:
                if default_sql:
                    op.execute(text(f"ALTER TABLE agents ADD COLUMN {col_name} {col_type} {default_sql}"))
                else:
                    op.execute(text(f"ALTER TABLE agents ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                columns_added.append(col_name)
                print(f"[MIGRATION 0019] Added column: {col_name}", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"[MIGRATION 0019] Error adding column {col_name}: {e}", file=sys.stderr, flush=True)
                conn.rollback()
        else:
            print(f"[MIGRATION 0019] Column {col_name} already exists, skipping", file=sys.stderr, flush=True)
    
    print(f"[MIGRATION 0019] Added {len(columns_added)} columns: {columns_added}", file=sys.stderr, flush=True)
    
    # Refresh inspector to see new columns
    inspector = inspect(conn)
    final_columns = [col['name'] for col in inspector.get_columns('agents')]
    print(f"[MIGRATION 0019] Final columns after migration: {final_columns}", file=sys.stderr, flush=True)


def downgrade() -> None:
    # Remove all added columns
    columns_to_remove = [
        'response_engine', 'begin_message', 'start_speaker', 'begin_message_delay_ms',
        'voice_model', 'fallback_voice_ids', 'voice_temperature', 'voice_speed', 'volume',
        'responsiveness', 'interruption_sensitivity', 'enable_backchannel', 'backchannel_frequency',
        'backchannel_words', 'reminder_trigger_ms', 'reminder_max_count',
        'ambient_sound', 'ambient_sound_volume',
        'webhook_url', 'webhook_timeout_ms',
        'boosted_keywords', 'stt_mode', 'vocab_specialization', 'denoising_mode',
        'data_storage_setting', 'opt_in_signed_url',
        'pronunciation_dictionary', 'normalize_for_speech',
        'end_call_after_silence_ms', 'max_call_duration_ms', 'ring_duration_ms',
        'voicemail_option', 'post_call_analysis_data', 'post_call_analysis_model',
        'allow_user_dtmf', 'user_dtmf_options', 'pii_config',
        'knowledge_base_ids', 'role', 'mission', 'custom_prompt',
        'created_at', 'updated_at',
    ]
    
    conn = op.get_bind()
    for col_name in columns_to_remove:
        try:
            op.execute(f"ALTER TABLE agents DROP COLUMN IF EXISTS {col_name}")
            conn.commit()
        except Exception as e:
            print(f"Error removing column {col_name}: {e}")
            conn.rollback()
    
    # Restore name column length
    op.alter_column('agents', 'name', type_=sa.String(128), existing_type=sa.String(256))

