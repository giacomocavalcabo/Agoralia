"""add_kb_documents_and_update_chunks

Revision ID: 0012
Revises: 0011
Create Date: 2024-01-XX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade():
    # Create kb_documents table
    op.create_table('kb_documents',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('source_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('mime_type', sa.String(), nullable=True),
        sa.Column('bytes', sa.BigInteger(), nullable=True),
        sa.Column('checksum', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=True),
        sa.Column('lang', sa.String(), nullable=True),
        sa.Column('parsed_text', sa.Text(), nullable=True),
        sa.Column('outline_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['source_id'], ['kb_sources.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add indexes for kb_documents
    op.create_index('ix_kb_documents_source_id', 'kb_documents', ['source_id'])
    op.create_index('ix_kb_documents_status', 'kb_documents', ['status'])
    op.create_index('ix_kb_documents_checksum', 'kb_documents', ['checksum'])
    
    # Update kb_chunks table
    op.add_column('kb_chunks', sa.Column('doc_id', sa.String(), nullable=True))
    op.add_column('kb_chunks', sa.Column('idx', sa.Integer(), nullable=True))
    op.add_column('kb_chunks', sa.Column('meta_json', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('kb_chunks', sa.Column('updated_at', sa.DateTime(), nullable=True))
    
    # Add indexes for kb_chunks
    op.create_index('ix_kb_chunks_doc_id_idx', 'kb_chunks', ['doc_id', 'idx'])
    op.create_index('ix_kb_chunks_doc_id', 'kb_chunks', ['doc_id'])
    
    # Add foreign key constraint for doc_id
    op.create_foreign_key('fk_kb_chunks_doc_id', 'kb_chunks', 'kb_documents', ['doc_id'], ['id'])
    
    # Update existing chunks to have default values
    op.execute("UPDATE kb_chunks SET idx = 0, updated_at = created_at WHERE idx IS NULL")
    
    # Make doc_id not nullable after setting defaults
    op.alter_column('kb_chunks', 'doc_id', nullable=False)
    op.alter_column('kb_chunks', 'idx', nullable=False)


def downgrade():
    # Remove foreign key constraint
    op.drop_constraint('fk_kb_chunks_doc_id', 'kb_chunks', type_='foreignkey')
    
    # Remove indexes
    op.drop_index('ix_kb_chunks_doc_id', table_name='kb_chunks')
    op.drop_index('ix_kb_chunks_doc_id_idx', table_name='kb_chunks')
    
    # Remove columns from kb_chunks
    op.drop_column('kb_chunks', 'updated_at')
    op.drop_column('kb_chunks', 'meta_json')
    op.drop_column('kb_chunks', 'idx')
    op.drop_column('kb_chunks', 'doc_id')
    
    # Drop kb_documents table and indexes
    op.drop_index('ix_kb_documents_checksum', table_name='kb_documents')
    op.drop_index('ix_kb_documents_status', table_name='kb_documents')
    op.drop_index('ix_kb_documents_source_id', table_name='kb_documents')
    op.drop_table('kb_documents')
