"""Add KB constraints, unique constraints, and indexes
Revision ID: 0010
Revises: 0003_numbers_outcomes
Create Date: 2025-01-18 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0010_kb_constraints_indexes'
down_revision = '0006_knowledge_base_system'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # ===================== KB Constraints & Indexes =====================
    
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('kb_fields') as batch_op:
        # Unique constraint on kb_fields (kb_id, section_id, key, lang)
        batch_op.create_unique_constraint(
            'uq_kb_fields_kb_section_key_lang',
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
    with op.batch_alter_table('kb_import_jobs') as batch_op:
        batch_op.create_unique_constraint(
            'uq_kb_import_jobs_idempotency_key',
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
    with op.batch_alter_table('kb_fields') as batch_op:
        batch_op.add_column(sa.Column('version', sa.Integer(), nullable=False, default=1))
    
    # Add cost tracking columns
    with op.batch_alter_table('kb_import_jobs') as batch_op:
        batch_op.add_column(sa.Column('cost_estimated_cents', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('cost_actual_cents', sa.Integer(), nullable=True))
        
        # Add progress tracking
        batch_op.add_column(sa.Column('progress_json', sa.JSON(), nullable=True))
        
        # Add template configuration
        batch_op.add_column(sa.Column('template_json', sa.JSON(), nullable=True))
        
        # Add error details
        batch_op.add_column(sa.Column('error_details', sa.JSON(), nullable=True))

def downgrade() -> None:
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('kb_fields') as batch_op:
        # Remove indexes
        batch_op.drop_index('ix_kb_fields_kb_section_key')
        batch_op.drop_index('ix_kb_fields_lang')
        batch_op.drop_index('ix_kb_fields_completeness_freshness')
        
        # Remove unique constraints
        batch_op.drop_constraint('uq_kb_fields_kb_section_key_lang', type_='unique')
        
        # Remove columns
        batch_op.drop_column('version')
    
    with op.batch_alter_table('kb_import_jobs') as batch_op:
        # Remove indexes
        batch_op.drop_index('ix_kb_import_jobs_workspace_status')
        batch_op.drop_index('ix_kb_import_jobs_created_at')
        
        # Remove unique constraints
        batch_op.drop_constraint('uq_kb_import_jobs_idempotency_key', type_='unique')
        
        # Remove columns
        batch_op.drop_column('cost_estimated_cents')
        batch_op.drop_column('cost_actual_cents')
        batch_op.drop_column('progress_json')
        batch_op.drop_column('template_json')
        batch_op.drop_column('error_details')
    
    # Remove other indexes (not in batch mode)
    op.drop_index('ix_kb_sections_kb_id', 'kb_sections')
    op.drop_index('ix_kb_sources_workspace_kb', 'kb_sources')
    op.drop_index('ix_kb_chunks_source_id', 'kb_chunks')
