"""Add KB constraints, unique constraints, and indexes
Revision ID: 0007
Revises: 0006_phone_e164_unique
Create Date: 2025-01-18 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0007'
down_revision = '0006_phone_e164_unique'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # ===================== KB Constraints & Indexes =====================
    
    # Unique constraint on kb_fields (kb_id, section_id, key, lang)
    op.create_unique_constraint(
        'uq_kb_fields_kb_section_key_lang',
        'kb_fields',
        ['kb_id', 'section_id', 'key', 'lang']
    )
    
    # Index for performance on kb_fields lookups
    op.create_index(
        'ix_kb_fields_kb_section_key',
        'kb_fields',
        ['kb_id', 'section_id', 'key']
    )
    
    # Index for language-based queries
    op.create_index(
        'ix_kb_fields_lang',
        'kb_fields',
        ['lang']
    )
    
    # Index for completeness and freshness scoring
    op.create_index(
        'ix_kb_fields_completeness_freshness',
        'kb_fields',
        ['completeness_pct', 'freshness_score']
    )
    
    # Index for kb_sections
    op.create_index(
        'ix_kb_sections_kb_id',
        'kb_sections',
        ['kb_id']
    )
    
    # Index for kb_sources
    op.create_index(
        'ix_kb_sources_workspace_kb',
        'kb_sources',
        ['workspace_id', 'kb_id']
    )
    
    # Index for kb_chunks
    op.create_index(
        'ix_kb_chunks_source_id',
        'kb_chunks',
        ['source_id']
    )
    
    # Index for kb_import_jobs
    op.create_index(
        'ix_kb_import_jobs_workspace_status',
        'kb_import_jobs',
        ['workspace_id', 'status']
    )
    
    # Index for idempotency key
    op.create_unique_constraint(
        'uq_kb_import_jobs_idempotency_key',
        'kb_import_jobs',
        ['idempotency_key']
    )
    
    # Index for job progress tracking
    op.create_index(
        'ix_kb_import_jobs_created_at',
        'kb_import_jobs',
        ['created_at']
    )
    
    # ===================== Language Normalization =====================
    
    # Update existing records to use BCP-47 format
    op.execute("""
        UPDATE kb_fields 
        SET lang = CASE 
            WHEN lang = 'it' THEN 'it-IT'
            WHEN lang = 'en' THEN 'en-US'
            WHEN lang = 'fr' THEN 'fr-FR'
            WHEN lang = 'de' THEN 'de-DE'
            WHEN lang = 'es' THEN 'es-ES'
            ELSE lang
        END
        WHERE lang IN ('it', 'en', 'fr', 'de', 'es')
    """)
    
    # ===================== Add missing columns =====================
    
    # Add version column for optimistic locking
    op.add_column('kb_fields', sa.Column('version', sa.Integer(), nullable=False, default=1))
    
    # Add cost tracking columns
    op.add_column('kb_import_jobs', sa.Column('cost_estimated_cents', sa.Integer(), nullable=True))
    op.add_column('kb_import_jobs', sa.Column('cost_actual_cents', sa.Integer(), nullable=True))
    
    # Add progress tracking
    op.add_column('kb_import_jobs', sa.Column('progress_json', postgresql.JSONB(), nullable=True))
    
    # Add template configuration
    op.add_column('kb_import_jobs', sa.Column('template_json', postgresql.JSONB(), nullable=True))
    
    # Add error details
    op.add_column('kb_import_jobs', sa.Column('error_details', postgresql.JSONB(), nullable=True))

def downgrade() -> None:
    # Remove indexes
    op.drop_index('ix_kb_fields_kb_section_key', 'kb_fields')
    op.drop_index('ix_kb_fields_lang', 'kb_fields')
    op.drop_index('ix_kb_fields_completeness_freshness', 'kb_fields')
    op.drop_index('ix_kb_sections_kb_id', 'kb_sections')
    op.drop_index('ix_kb_sources_workspace_kb', 'kb_sources')
    op.drop_index('ix_kb_chunks_source_id', 'kb_chunks')
    op.drop_index('ix_kb_import_jobs_workspace_status', 'kb_import_jobs')
    op.drop_index('ix_kb_import_jobs_created_at', 'kb_import_jobs')
    
    # Remove unique constraints
    op.drop_constraint('uq_kb_fields_kb_section_key_lang', 'kb_fields', type_='unique')
    op.drop_constraint('uq_kb_import_jobs_idempotency_key', 'kb_import_jobs', type_='unique')
    
    # Remove columns
    op.drop_column('kb_fields', 'version')
    op.drop_column('kb_import_jobs', 'cost_estimated_cents')
    op.drop_column('kb_import_jobs', 'cost_actual_cents')
    op.drop_column('kb_import_jobs', 'progress_json')
    op.drop_column('kb_import_jobs', 'template_json')
    op.drop_column('kb_import_jobs', 'error_details')
