"""add workspace timezone

Revision ID: 0021_add_workspace_timezone
Revises: 0020_provider_account_integrations
Create Date: 2025-01-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0021_add_workspace_timezone'
down_revision = '0020_provider_account_integrations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add timezone column to workspaces table with UTC default
    op.add_column('workspaces', sa.Column('timezone', sa.String(length=50), nullable=False, server_default='UTC'))


def downgrade() -> None:
    # Remove timezone column from workspaces table
    op.drop_column('workspaces', 'timezone')
