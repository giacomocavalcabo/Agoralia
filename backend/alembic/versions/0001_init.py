"""init schema

Revision ID: 0001_init
Revises: 
Create Date: 2025-08-18 00:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0001_init'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('email', sa.String(), nullable=False, unique=True),
        sa.Column('name', sa.String()),
        sa.Column('locale', sa.String(), server_default='en-US'),
        sa.Column('tz', sa.String(), server_default='UTC'),
        sa.Column('is_admin_global', sa.Boolean(), server_default=sa.text('0')),
        sa.Column('last_login_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table(
        'workspaces',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('plan', sa.String(), server_default='core'),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table(
        'workspace_members',
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id'), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('role', sa.String(), server_default='viewer'),
        sa.Column('invited_at', sa.DateTime()),
        sa.Column('joined_at', sa.DateTime()),
    )

    op.create_table(
        'campaigns',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('status', sa.String(), server_default='running'),
        sa.Column('pacing_npm', sa.Integer(), server_default='10'),
        sa.Column('budget_cap_cents', sa.Integer(), server_default='0'),
        sa.Column('owner_user_id', sa.String(), sa.ForeignKey('users.id')),
    )

    op.create_table(
        'calls',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id')),
        sa.Column('lang', sa.String()),
        sa.Column('iso', sa.String()),
        sa.Column('status', sa.String()),
        sa.Column('duration_s', sa.Integer(), server_default='0'),
        sa.Column('cost_cents', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime()),
    )


def downgrade() -> None:
    op.drop_table('calls')
    op.drop_table('campaigns')
    op.drop_table('workspace_members')
    op.drop_table('workspaces')
    op.drop_table('users')


