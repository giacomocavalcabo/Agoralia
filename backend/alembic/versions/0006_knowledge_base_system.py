"""Sprint 8: Knowledge Base System

Revision ID: 0006
Revises: 0005_sprint6_extensions
Create Date: 2025-01-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0006'
down_revision = '0005_sprint6_extensions'
branch_labels = None
depends_on = None


def upgrade():
    # Enable pgvector extension for embeddings
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    
    # Create knowledge_bases table
    op.create_table('knowledge_bases',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=True),
        sa.Column('locale_default', sa.String(), nullable=True),
        sa.Column('version', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('completeness_pct', sa.Integer(), nullable=True),
        sa.Column('freshness_score', sa.Integer(), nullable=True),
        sa.Column('meta_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('published_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create kb_sections table
    op.create_table('kb_sections',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('kb_id', sa.String(), nullable=False),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=True),
        sa.Column('content_md', sa.Text(), nullable=True),
        sa.Column('content_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('completeness_pct', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['kb_id'], ['knowledge_bases.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create kb_fields table
    op.create_table('kb_fields',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('kb_id', sa.String(), nullable=False),
        sa.Column('section_id', sa.String(), nullable=True),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('value_text', sa.Text(), nullable=True),
        sa.Column('value_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('lang', sa.String(), nullable=True),
        sa.Column('source_id', sa.String(), nullable=True),
        sa.Column('confidence', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['kb_id'], ['knowledge_bases.id'], ),
        sa.ForeignKeyConstraint(['section_id'], ['kb_sections.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create kb_sources table
    op.create_table('kb_sources',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('url', sa.String(), nullable=True),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('sha256', sa.String(), nullable=False),
        sa.Column('meta_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create kb_chunks table with pgvector support
    op.create_table('kb_chunks',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('kb_id', sa.String(), nullable=True),
        sa.Column('section_id', sa.String(), nullable=True),
        sa.Column('source_id', sa.String(), nullable=True),
        sa.Column('sha256', sa.String(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('lang', sa.String(), nullable=True),
        sa.Column('tokens', sa.Integer(), nullable=True),
        sa.Column('embedding', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['kb_id'], ['knowledge_bases.id'], ),
        sa.ForeignKeyConstraint(['section_id'], ['kb_sections.id'], ),
        sa.ForeignKeyConstraint(['source_id'], ['kb_sources.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create kb_assignments table
    op.create_table('kb_assignments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('scope', sa.String(), nullable=False),
        sa.Column('scope_id', sa.String(), nullable=True),
        sa.Column('kb_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['kb_id'], ['knowledge_bases.id'], ),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create kb_history table
    op.create_table('kb_history',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('kb_id', sa.String(), nullable=False),
        sa.Column('actor_user_id', sa.String(), nullable=False),
        sa.Column('diff_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['kb_id'], ['knowledge_bases.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create kb_import_jobs table
    op.create_table('kb_import_jobs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('source_id', sa.String(), nullable=False),
        sa.Column('target_kb_id', sa.String(), nullable=True),
        sa.Column('template', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('progress_pct', sa.Integer(), nullable=True),
        sa.Column('estimated_cost_cents', sa.Integer(), nullable=True),
        sa.Column('actual_cost_cents', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['source_id'], ['kb_sources.id'], ),
        sa.ForeignKeyConstraint(['target_kb_id'], ['knowledge_bases.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create ai_usage table
    op.create_table('ai_usage',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('tokens_in', sa.Integer(), nullable=True),
        sa.Column('tokens_out', sa.Integer(), nullable=True),
        sa.Column('cost_micros', sa.Integer(), nullable=True),
        sa.Column('job_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.ForeignKeyConstraint(['job_id'], ['kb_import_jobs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better performance
    op.create_index('ix_knowledge_bases_workspace_id', 'knowledge_bases', ['workspace_id'])
    op.create_index('ix_knowledge_bases_kind', 'knowledge_bases', ['kind'])
    op.create_index('ix_knowledge_bases_status', 'knowledge_bases', ['status'])
    
    op.create_index('ix_kb_sections_kb_id', 'kb_sections', ['kb_id'])
    op.create_index('ix_kb_sections_key', 'kb_sections', ['key'])
    
    op.create_index('ix_kb_fields_kb_id', 'kb_fields', ['kb_id'])
    op.create_index('ix_kb_fields_section_id', 'kb_fields', ['section_id'])
    op.create_index('ix_kb_fields_lang', 'kb_fields', ['lang'])
    
    # Unique constraint for fields (kb_id, section_id, key, lang)
    op.create_unique_constraint('uq_kb_fields_unique', 'kb_fields', ['kb_id', 'section_id', 'key', 'lang'])
    
    # GIN index for full-text search on value_text
    op.execute('CREATE INDEX ix_kb_fields_text_gin ON kb_fields USING gin (to_tsvector(\'simple\', value_text))')
    
    op.create_index('ix_kb_sources_workspace_id', 'kb_sources', ['workspace_id'])
    op.create_index('ix_kb_sources_sha256', 'kb_sources', ['sha256'])
    
    op.create_index('ix_kb_chunks_sha256', 'kb_chunks', ['sha256'])
    op.create_index('ix_kb_chunks_kb_id', 'kb_chunks', ['kb_id'])
    
    # Unique constraint for assignments
    op.create_unique_constraint('uq_kb_assignments_workspace_scope', 'kb_assignments', ['workspace_id', 'scope', 'scope_id'])
    
    op.create_index('ix_kb_import_jobs_workspace_id', 'kb_import_jobs', ['workspace_id'])
    op.create_index('ix_kb_import_jobs_status', 'kb_import_jobs', ['status'])
    
    op.create_index('ix_ai_usage_workspace_id', 'ai_usage', ['workspace_id'])
    op.create_index('ix_ai_usage_kind', 'ai_usage', ['kind'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_ai_usage_kind', table_name='ai_usage')
    op.drop_index('ix_ai_usage_workspace_id', table_name='ai_usage')
    op.drop_index('ix_kb_import_jobs_status', table_name='kb_import_jobs')
    op.drop_index('ix_kb_import_jobs_workspace_id', table_name='kb_import_jobs')
    op.drop_constraint('uq_kb_assignments_workspace_scope', 'kb_assignments', type_='unique')
    op.drop_index('ix_kb_chunks_kb_id', table_name='kb_chunks')
    op.drop_index('ix_kb_chunks_sha256', table_name='kb_chunks')
    op.drop_index('ix_kb_sources_sha256', table_name='kb_sources')
    op.drop_index('ix_kb_sources_workspace_id', table_name='kb_sources')
    op.drop_index('ix_kb_fields_lang', table_name='kb_fields')
    op.drop_index('ix_kb_fields_section_id', table_name='kb_fields')
    op.drop_index('ix_kb_fields_kb_id', table_name='kb_fields')
    op.drop_index('ix_kb_sections_key', table_name='kb_sections')
    op.drop_index('ix_kb_sections_kb_id', table_name='kb_sections')
    op.drop_index('ix_knowledge_bases_status', table_name='knowledge_bases')
    op.drop_index('ix_knowledge_bases_kind', table_name='knowledge_bases')
    op.drop_index('ix_knowledge_bases_workspace_id', table_name='knowledge_bases')
    op.drop_constraint('uq_kb_fields_unique', 'kb_fields', type_='unique')
    op.drop_index('ix_kb_fields_text_gin', table_name='kb_fields')
    
    # Drop tables
    op.drop_table('ai_usage')
    op.drop_table('kb_import_jobs')
    op.drop_table('kb_history')
    op.drop_table('kb_assignments')
    op.drop_table('kb_chunks')
    op.drop_table('kb_sources')
    op.drop_table('kb_fields')
    op.drop_table('kb_sections')
    op.drop_table('knowledge_bases')
    
    # Note: pgvector extension is not dropped as it might be used by other parts of the system
