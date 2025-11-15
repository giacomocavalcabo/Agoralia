"""Add retell_agent_id to agents table

Revision ID: 0013_add_retell_agent_id
Revises: 0012_add_leads_table
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '0013_add_retell_agent_id'
down_revision = '0012_add_leads_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if agents table exists and retell_agent_id column is missing
    if 'agents' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('agents')]
        if 'retell_agent_id' not in columns:
            with op.batch_alter_table('agents', schema=None) as batch_op:
                batch_op.add_column(sa.Column('retell_agent_id', sa.String(length=128), nullable=True))


def downgrade() -> None:
    # Don't drop column in downgrade for safety
    pass

