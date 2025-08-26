"""kb_structured_cards_and_quality

Revision ID: 0014
Revises: 0013
Create Date: 2024-01-XX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade():
    # Create kb_structured_cards table
    op.create_table(
        'kb_structured_cards',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('kb_id', sa.String(), nullable=False),
        sa.Column('card_type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('content_json', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('confidence', sa.Float(), default=1.0),
        sa.Column('source_chunks', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('lang', sa.String(), default='en-US'),
        sa.Column('meta_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for structured cards
    op.create_index('ix_kb_structured_cards_kb_id', 'kb_structured_cards', ['kb_id'])
    op.create_index('ix_kb_structured_cards_type', 'kb_structured_cards', ['card_type'])
    op.create_index('ix_kb_structured_cards_lang', 'kb_structured_cards', ['lang'])
    op.create_index('ix_kb_structured_cards_confidence', 'kb_structured_cards', ['confidence'])
    
    # Create kb_quality table
    op.create_table(
        'kb_quality',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('kb_id', sa.String(), nullable=False),
        sa.Column('metric_type', sa.String(), nullable=False),
        sa.Column('score', sa.Float(), default=0.0),
        sa.Column('breakdown_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('last_calculated', sa.DateTime(), default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for quality metrics
    op.create_index('ix_kb_quality_kb_id', 'kb_quality', ['kb_id'])
    op.create_index('ix_kb_quality_metric_type', 'kb_quality', ['metric_type'])
    op.create_index('ix_kb_quality_score', 'kb_quality', ['score'])
    
    # Create unique constraint for kb_quality (one metric per KB per type)
    op.create_unique_constraint(
        'uq_kb_quality_kb_metric', 
        'kb_quality', 
        ['kb_id', 'metric_type']
    )
    
    print("✅ Created kb_structured_cards and kb_quality tables")


def downgrade():
    # Remove unique constraint
    op.drop_constraint('uq_kb_quality_kb_metric', 'kb_quality', type_='unique')
    
    # Remove quality table and indexes
    op.drop_index('ix_kb_quality_score', table_name='kb_quality')
    op.drop_index('ix_kb_quality_metric_type', table_name='kb_quality')
    op.drop_index('ix_kb_quality_kb_id', table_name='kb_quality')
    op.drop_table('kb_quality')
    
    # Remove structured cards table and indexes
    op.drop_index('ix_kb_structured_cards_confidence', table_name='kb_structured_cards')
    op.drop_index('ix_kb_structured_cards_lang', table_name='kb_structured_cards')
    op.drop_index('ix_kb_structured_cards_type', table_name='kb_structured_cards')
    op.drop_index('ix_kb_structured_cards_kb_id', table_name='kb_structured_cards')
    op.drop_table('kb_structured_cards')
    
    print("✅ Removed kb_structured_cards and kb_quality tables")
