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
    # Add notification fields to workspace_settings
    op.add_column('workspace_settings', sa.Column('email_notifications_enabled', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('workspace_settings', sa.Column('email_campaign_started', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('workspace_settings', sa.Column('email_campaign_paused', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('workspace_settings', sa.Column('email_budget_warning', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('workspace_settings', sa.Column('email_compliance_alert', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    op.drop_column('workspace_settings', 'email_compliance_alert')
    op.drop_column('workspace_settings', 'email_budget_warning')
    op.drop_column('workspace_settings', 'email_campaign_paused')
    op.drop_column('workspace_settings', 'email_campaign_started')
    op.drop_column('workspace_settings', 'email_notifications_enabled')

