"""add audit events table

Revision ID: 0022_add_audit_events_table
Revises: 0021_add_workspace_timezone
Create Date: 2025-01-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0022_add_audit_events_table'
down_revision = '0021_add_workspace_timezone'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create audit_events table
    op.create_table('audit_events',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('resource_type', sa.String(), nullable=True),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('ip', sa.String(), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('meta', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index for efficient querying
    op.create_index('idx_audit_ws_time', 'audit_events', ['workspace_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_audit_ws_time', table_name='audit_events')
    op.drop_table('audit_events')
