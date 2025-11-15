"""Add quiet_hours_disabled to leads table

Revision ID: 0015_add_lead_quiet_hours_disabled
Revises: 0014_add_indices_and_tenant_improvements
Create Date: 2025-01-15 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '0015_add_lead_quiet_hours_disabled'
down_revision = '0014_add_indices_and_tenant_improvements'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'leads' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('leads')]
        
        with op.batch_alter_table('leads', schema=None) as batch_op:
            if 'quiet_hours_disabled' not in columns:
                batch_op.add_column(sa.Column('quiet_hours_disabled', sa.Integer(), nullable=True, server_default=sa.text('0')))


def downgrade() -> None:
    # Don't drop column (too dangerous)
    pass

