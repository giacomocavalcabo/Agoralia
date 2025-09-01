"""Telephony Providers - Add provider accounts and number orders

Revision ID: 0016
Revises: 0015_gamma_calls_storage
Create Date: 2025-01-18 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0016_telephony_providers'
down_revision = '0015_gamma_calls_storage'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ===================== Provider Accounts Table =====================
    op.create_table('provider_accounts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('provider', sa.Enum('twilio', 'telnyx', name='telephonyprovider'), nullable=False),
        sa.Column('api_key_encrypted', sa.String(), nullable=False),
        sa.Column('label', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # ===================== Number Orders Table =====================
    op.create_table('number_orders',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('provider', sa.Enum('twilio', 'telnyx', name='telephonyprovider'), nullable=False),
        sa.Column('request', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('provider_ref', sa.String(), nullable=True),
        sa.Column('result', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # ===================== Numbers Table Extensions =====================
    # Add provider fields to existing numbers table
    op.add_column('numbers', sa.Column('provider', sa.String(), nullable=True))
    op.add_column('numbers', sa.Column('provider_ref', sa.String(), nullable=True))
    op.add_column('numbers', sa.Column('hosted', sa.Boolean(), nullable=True, default=False))
    op.add_column('numbers', sa.Column('verified_cli', sa.Boolean(), nullable=True, default=False))
    
    # ===================== Indexes for Performance =====================
    op.create_index('ix_provider_accounts_workspace', 'provider_accounts', ['workspace_id'])
    op.create_index('ix_number_orders_workspace', 'number_orders', ['workspace_id'])
    op.create_index('ix_number_orders_provider_ref', 'number_orders', ['provider_ref'])
    op.create_index('ix_numbers_provider', 'numbers', ['provider'])


def downgrade() -> None:
    # Remove indexes
    op.drop_index('ix_numbers_provider')
    op.drop_index('ix_number_orders_provider_ref')
    op.drop_index('ix_number_orders_workspace')
    op.drop_index('ix_provider_accounts_workspace')
    
    # Remove columns from numbers table
    op.drop_column('numbers', 'verified_cli')
    op.drop_column('numbers', 'hosted')
    op.drop_column('numbers', 'provider_ref')
    op.drop_column('numbers', 'provider')
    
    # Drop tables
    op.drop_table('number_orders')
    op.drop_table('provider_accounts')
