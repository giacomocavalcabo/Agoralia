"""Add search indexes

Revision ID: 0004
Revises: 0003_numbers_outcomes
Create Date: 2025-01-18 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0004'
down_revision = '0003_numbers_outcomes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add GIN indexes for search optimization
    # Users: email and name search
    op.create_index('ix_users_email_search', 'users', ['email'], postgresql_using='gin')
    op.create_index('ix_users_name_search', 'users', ['name'], postgresql_using='gin')
    
    # Workspaces: name search
    op.create_index('ix_workspaces_name_search', 'workspaces', ['name'], postgresql_using='gin')
    
    # Calls: phone numbers, language, ISO search
    op.create_index('ix_calls_to_search', 'calls', ['to'], postgresql_using='gin')
    op.create_index('ix_calls_from_search', 'calls', ['from'], postgresql_using='gin')
    op.create_index('ix_calls_lang_search', 'calls', ['lang'], postgresql_using='gin')
    op.create_index('ix_calls_iso_search', 'calls', ['iso'], postgresql_using='gin')
    
    # Campaigns: name, goal, role search
    op.create_index('ix_campaigns_name_search', 'campaigns', ['name'], postgresql_using='gin')
    op.create_index('ix_campaigns_goal_search', 'campaigns', ['goal'], postgresql_using='gin')
    op.create_index('ix_campaigns_role_search', 'campaigns', ['role'], postgresql_using='gin')


def downgrade() -> None:
    # Remove search indexes
    op.drop_index('ix_users_email_search')
    op.drop_index('ix_users_name_search')
    op.drop_index('ix_workspaces_name_search')
    op.drop_index('ix_calls_to_search')
    op.drop_index('ix_calls_from_search')
    op.drop_index('ix_calls_lang_search')
    op.drop_index('ix_calls_iso_search')
    op.drop_index('ix_campaigns_name_search')
    op.drop_index('ix_campaigns_goal_search')
    op.drop_index('ix_campaigns_role_search')
