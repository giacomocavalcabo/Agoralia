"""kb_pgvector_and_jobs

Revision ID: 0013
Revises: 0012
Create Date: 2024-01-XX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade():
    # Enable pgvector extension if available
    try:
        op.execute('CREATE EXTENSION IF NOT EXISTS vector')
        print("✅ pgvector extension enabled")
    except Exception as e:
        print(f"⚠️ pgvector extension not available: {e}")
        print("   Will use fallback cosine similarity")
    
    # Add vector column to kb_chunks (if pgvector available)
    try:
        # Try to add vector column with pgvector
        op.execute('ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding_vector vector(1536)')
        print("✅ Added embedding_vector column with pgvector")
        
        # Create HNSW index for fast similarity search
        op.execute('CREATE INDEX IF NOT EXISTS ix_kb_chunks_embedding_hnsw ON kb_chunks USING hnsw (embedding_vector vector_cosine_ops)')
        print("✅ Created HNSW index for similarity search")
        
    except Exception as e:
        print(f"⚠️ pgvector columns not added: {e}")
        print("   Will use JSON embedding column as fallback")
    
    # Add job tracking columns
    op.add_column('kb_chunks', sa.Column('job_id', sa.String(), nullable=True))
    op.add_column('kb_chunks', sa.Column('processing_status', sa.String(), default='pending'))
    op.add_column('kb_chunks', sa.Column('processing_error', sa.Text(), nullable=True))
    
    # Add indexes for job tracking
    op.create_index('ix_kb_chunks_job_id', 'kb_chunks', ['job_id'])
    op.create_index('ix_kb_chunks_processing_status', 'kb_chunks', ['processing_status'])
    
    # Add quality metrics columns
    op.add_column('kb_chunks', sa.Column('quality_score', sa.Float(), default=1.0))
    op.add_column('kb_chunks', sa.Column('pii_score', sa.Float(), default=0.0))
    op.add_column('kb_chunks', sa.Column('duplicate_score', sa.Float(), default=0.0))
    
    # Create index for quality filtering
    op.create_index('ix_kb_chunks_quality', 'kb_chunks', ['quality_score', 'pii_score'])
    
    # Add semantic search metadata
    op.add_column('kb_chunks', sa.Column('semantic_type', sa.String(), nullable=True))
    op.add_column('kb_chunks', sa.Column('semantic_tags', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Create index for semantic filtering
    op.create_index('ix_kb_chunks_semantic_type', 'kb_chunks', ['semantic_type'])
    
    # Add full-text search index on chunk text
    op.execute('CREATE INDEX IF NOT EXISTS ix_kb_chunks_text_gin ON kb_chunks USING gin(to_tsvector(\'english\', text))')
    print("✅ Created full-text search index")


def downgrade():
    # Remove semantic search columns
    op.drop_index('ix_kb_chunks_semantic_type', table_name='kb_chunks')
    op.drop_column('kb_chunks', 'semantic_tags')
    op.drop_column('kb_chunks', 'semantic_type')
    
    # Remove quality metrics columns
    op.drop_index('ix_kb_chunks_quality', table_name='kb_chunks')
    op.drop_column('kb_chunks', 'duplicate_score')
    op.drop_column('kb_chunks', 'pii_score')
    op.drop_column('kb_chunks', 'quality_score')
    
    # Remove job tracking columns
    op.drop_index('ix_kb_chunks_processing_status', table_name='kb_chunks')
    op.drop_index('ix_kb_chunks_job_id', table_name='kb_chunks')
    op.drop_column('kb_chunks', 'processing_error')
    op.drop_column('kb_chunks', 'processing_status')
    op.drop_column('kb_chunks', 'job_id')
    
    # Remove pgvector columns (if they exist)
    try:
        op.execute('DROP INDEX IF EXISTS ix_kb_chunks_embedding_hnsw')
        op.execute('ALTER TABLE kb_chunks DROP COLUMN IF EXISTS embedding_vector')
        print("✅ Removed pgvector columns")
    except Exception as e:
        print(f"⚠️ Could not remove pgvector columns: {e}")
    
    # Remove full-text search index
    op.execute('DROP INDEX IF EXISTS ix_kb_chunks_text_gin')
    
    # Note: pgvector extension is not removed as it might be used by other parts of the system
