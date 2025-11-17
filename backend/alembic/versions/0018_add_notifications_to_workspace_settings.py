"""Add notifications fields to workspace_settings

Revision ID: 0018_add_notifications_to_workspace_settings
Revises: 0017_add_workspace_settings_user_preferences
Create Date: 2025-01-16 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0018_add_notifications_to_workspace_settings'
down_revision: Union[str, None] = '0017_add_workspace_settings_user_preferences'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if table exists and column doesn't exist before adding
    from sqlalchemy import inspect, text
    from sqlalchemy.engine import Connection
    
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if workspace_settings table exists
    if 'workspace_settings' not in inspector.get_table_names():
        print("⚠ workspace_settings table does not exist, skipping notification columns addition", flush=True)
        return
    
    # Check if column already exists
    existing_columns = [col['name'] for col in inspector.get_columns('workspace_settings')]
    
    # Add notification fields to workspace_settings only if they don't exist
    if 'email_notifications_enabled' not in existing_columns:
        op.add_column('workspace_settings', sa.Column('email_notifications_enabled', sa.Integer(), nullable=False, server_default='1'))
    if 'email_campaign_started' not in existing_columns:
        op.add_column('workspace_settings', sa.Column('email_campaign_started', sa.Integer(), nullable=False, server_default='1'))
    if 'email_campaign_paused' not in existing_columns:
        op.add_column('workspace_settings', sa.Column('email_campaign_paused', sa.Integer(), nullable=False, server_default='1'))
    if 'email_budget_warning' not in existing_columns:
        op.add_column('workspace_settings', sa.Column('email_budget_warning', sa.Integer(), nullable=False, server_default='1'))
    if 'email_compliance_alert' not in existing_columns:
        op.add_column('workspace_settings', sa.Column('email_compliance_alert', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    op.drop_column('workspace_settings', 'email_compliance_alert')
    op.drop_column('workspace_settings', 'email_budget_warning')
    op.drop_column('workspace_settings', 'email_campaign_paused')
    op.drop_column('workspace_settings', 'email_campaign_started')
    op.drop_column('workspace_settings', 'email_notifications_enabled')

