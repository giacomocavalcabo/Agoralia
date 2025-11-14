"""Optimize calls schema by consolidating related tables

Revision ID: 0005_optimize_calls_schema
Revises: 0004_country_rules_lead_nature
Create Date: 2024-01-16 10:00:00.000000

This migration:
1. Adds columns to calls for dispositions, media, structured, summaries
2. Migrates data from old tables to calls
3. Drops old tables (dispositions, call_media, call_structured, summaries)
4. Drops unused tables (workspaces, memberships, user_plan_overrides, email_provider_settings)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '0005_optimize_calls_schema'
down_revision = '0004_country_rules_lead_nature'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ========================================================================
    # 1. Add new columns to calls table
    # ========================================================================
    with op.batch_alter_table('calls', schema=None) as batch_op:
        # Dispositions fields
        batch_op.add_column(sa.Column('disposition_outcome', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('disposition_note', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('disposition_updated_at', sa.DateTime(timezone=True), nullable=True))
        
        # Media fields (extend existing audio_url, add media_json for array/other media)
        batch_op.add_column(sa.Column('media_json', sa.Text(), nullable=True))
        
        # Structured fields (bant, trade)
        batch_op.add_column(sa.Column('structured_json', sa.Text(), nullable=True))
        
        # Summary fields
        batch_op.add_column(sa.Column('summary_json', sa.Text(), nullable=True))
    
    # ========================================================================
    # 2. Migrate data from old tables to calls
    # ========================================================================
    conn = op.get_bind()
    
    # Migrate dispositions
    conn.execute(text("""
        UPDATE calls c
        SET 
            disposition_outcome = d.outcome,
            disposition_note = d.note,
            disposition_updated_at = d.updated_at
        FROM dispositions d
        WHERE c.id = d.call_id
    """))
    
    # Migrate call_media
    conn.execute(text("""
        UPDATE calls c
        SET media_json = (
            SELECT json_build_object('audio_urls', COALESCE(json_agg(cm.audio_url ORDER BY cm.created_at), '[]'::json))
            FROM call_media cm
            WHERE cm.call_id = c.id
        )
        WHERE EXISTS (SELECT 1 FROM call_media WHERE call_id = c.id)
    """))
    
    # If audio_url is already set but no media_json, create media_json with it
    conn.execute(text("""
        UPDATE calls
        SET media_json = json_build_object('audio_urls', json_build_array(audio_url))
        WHERE audio_url IS NOT NULL AND audio_url != '' AND (media_json IS NULL OR media_json = '')
    """))
    
    # Migrate call_structured (handle NULL JSON)
    conn.execute(text("""
        UPDATE calls c
        SET structured_json = (
            SELECT json_build_object(
                'bant', COALESCE(cs.bant_json::jsonb, '{}'::jsonb),
                'trade', COALESCE(cs.trade_json::jsonb, '{}'::jsonb)
            )
            FROM call_structured cs
            WHERE cs.call_id = c.id
            LIMIT 1
        )
        WHERE EXISTS (SELECT 1 FROM call_structured WHERE call_id = c.id)
    """))
    
    # Migrate summaries
    conn.execute(text("""
        UPDATE calls c
        SET summary_json = (
            SELECT json_build_object('bullets', COALESCE(s.bullets_json::jsonb, '{}'::jsonb))
            FROM summaries s
            WHERE s.call_id = c.id
            ORDER BY s.id DESC
            LIMIT 1
        )
        WHERE EXISTS (SELECT 1 FROM summaries WHERE call_id = c.id)
    """))
    
    # ========================================================================
    # 3. Drop old tables (with IF EXISTS for safety)
    # ========================================================================
    # Drop old related tables
    op.execute(text("DROP TABLE IF EXISTS dispositions CASCADE"))
    op.execute(text("DROP TABLE IF EXISTS call_media CASCADE"))
    op.execute(text("DROP TABLE IF EXISTS call_structured CASCADE"))
    op.execute(text("DROP TABLE IF EXISTS summaries CASCADE"))
    
    # Drop unused tables
    op.execute(text("DROP TABLE IF EXISTS workspaces CASCADE"))
    op.execute(text("DROP TABLE IF EXISTS memberships CASCADE"))
    op.execute(text("DROP TABLE IF EXISTS user_plan_overrides CASCADE"))
    op.execute(text("DROP TABLE IF EXISTS email_provider_settings CASCADE"))


def downgrade() -> None:
    # Recreate old tables
    op.create_table(
        'dispositions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('call_id', sa.Integer(), sa.ForeignKey('calls.id'), nullable=True),
        sa.Column('outcome', sa.String(length=64), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    
    op.create_table(
        'call_media',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('call_id', sa.Integer(), sa.ForeignKey('calls.id'), nullable=True),
        sa.Column('audio_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    
    op.create_table(
        'call_structured',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('call_id', sa.Integer(), sa.ForeignKey('calls.id'), nullable=True),
        sa.Column('bant_json', sa.Text(), nullable=True),
        sa.Column('trade_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    
    op.create_table(
        'summaries',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('call_id', sa.Integer(), sa.ForeignKey('calls.id'), nullable=True),
        sa.Column('provider_call_id', sa.String(length=128), nullable=True),
        sa.Column('bullets_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    
    # Migrate data back (simplified - only dispositions, others would need JSON parsing)
    conn = op.get_bind()
    conn.execute(text("""
        INSERT INTO dispositions (call_id, tenant_id, outcome, note, updated_at)
        SELECT id, tenant_id, disposition_outcome, disposition_note, disposition_updated_at
        FROM calls
        WHERE disposition_outcome IS NOT NULL OR disposition_note IS NOT NULL
    """))
    
    # Remove new columns from calls
    with op.batch_alter_table('calls', schema=None) as batch_op:
        batch_op.drop_column('summary_json')
        batch_op.drop_column('structured_json')
        batch_op.drop_column('media_json')
        batch_op.drop_column('disposition_updated_at')
        batch_op.drop_column('disposition_note')
        batch_op.drop_column('disposition_outcome')

