"""Add quiet hours to campaigns and settings

Revision ID: 0011_add_quiet_hours
Revises: 0010_ensure_campaigns_columns
Create Date: 2024-11-14 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '0011_add_quiet_hours'
down_revision = '0010_ensure_campaigns_columns'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Add quiet hours to campaigns table
    if 'campaigns' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('campaigns')]
        
        with op.batch_alter_table('campaigns', schema=None) as batch_op:
            if 'quiet_hours_enabled' not in columns:
                batch_op.add_column(sa.Column('quiet_hours_enabled', sa.Integer(), nullable=True))
            if 'quiet_hours_weekdays' not in columns:
                batch_op.add_column(sa.Column('quiet_hours_weekdays', sa.String(length=32), nullable=True))
            if 'quiet_hours_saturday' not in columns:
                batch_op.add_column(sa.Column('quiet_hours_saturday', sa.String(length=32), nullable=True))
            if 'quiet_hours_sunday' not in columns:
                batch_op.add_column(sa.Column('quiet_hours_sunday', sa.String(length=32), nullable=True))
            if 'quiet_hours_timezone' not in columns:
                batch_op.add_column(sa.Column('quiet_hours_timezone', sa.String(length=64), nullable=True))
    
    # Add quiet hours to settings table
    if 'settings' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('settings')]
        
        with op.batch_alter_table('settings', schema=None) as batch_op:
            if 'quiet_hours_enabled' not in columns:
                batch_op.add_column(sa.Column('quiet_hours_enabled', sa.Integer(), nullable=True, server_default=sa.text('0')))
            if 'quiet_hours_weekdays' not in columns:
                batch_op.add_column(sa.Column('quiet_hours_weekdays', sa.String(length=32), nullable=True))
            if 'quiet_hours_saturday' not in columns:
                batch_op.add_column(sa.Column('quiet_hours_saturday', sa.String(length=32), nullable=True))
            if 'quiet_hours_sunday' not in columns:
                batch_op.add_column(sa.Column('quiet_hours_sunday', sa.String(length=32), nullable=True))
            if 'quiet_hours_timezone' not in columns:
                batch_op.add_column(sa.Column('quiet_hours_timezone', sa.String(length=64), nullable=True))


def downgrade() -> None:
    # Don't remove columns (too dangerous)
    pass

