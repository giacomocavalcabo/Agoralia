"""Add leads table

Revision ID: 0012_add_leads_table
Revises: 0011_add_quiet_hours
Create Date: 2024-11-14 16:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '0012_add_leads_table'
down_revision = '0011_add_quiet_hours'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if leads table exists
    if 'leads' not in inspector.get_table_names():
        # Create leads table
        op.create_table(
            'leads',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('tenant_id', sa.Integer(), nullable=True),
            sa.Column('name', sa.String(length=128), nullable=False),
            sa.Column('company', sa.String(length=128), nullable=True),
            sa.Column('phone', sa.String(length=32), nullable=False),
            sa.Column('country_iso', sa.String(length=8), nullable=True),
            sa.Column('preferred_lang', sa.String(length=16), nullable=True),
            sa.Column('role', sa.String(length=16), nullable=True),  # supplier | supplied
            sa.Column('nature', sa.String(length=8), nullable=True, server_default='unknown'),  # b2b | b2c | unknown
            sa.Column('consent_basis', sa.String(length=32), nullable=True),
            sa.Column('consent_status', sa.String(length=16), nullable=True, server_default='unknown'),  # granted | denied | unknown
            sa.Column('campaign_id', sa.Integer(), sa.ForeignKey('campaigns.id'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        )
    else:
        # Table exists, check if columns need to be added
        columns = [col['name'] for col in inspector.get_columns('leads')]
        
        with op.batch_alter_table('leads', schema=None) as batch_op:
            if 'nature' not in columns:
                batch_op.add_column(sa.Column('nature', sa.String(length=8), nullable=True, server_default='unknown'))


def downgrade() -> None:
    # Don't drop table (too dangerous)
    pass

