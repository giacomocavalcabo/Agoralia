"""Sprint 6 Extensions - Additive migrations for Numbers, Outcomes, Auth

Revision ID: 0005
Revises: 0004_search_indexes
Create Date: 2025-01-18 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0005'
down_revision = '0004_search_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ===================== Numbers Table Extensions =====================
    # Add new fields to existing numbers table for Retell integration
    op.add_column('numbers', sa.Column('provider_number_id', sa.String(), nullable=True))
    op.add_column('numbers', sa.Column('verification_status', sa.String(), nullable=True, default='pending'))
    op.add_column('numbers', sa.Column('purchase_cost_cents', sa.Integer(), nullable=True))
    op.add_column('numbers', sa.Column('monthly_cost_cents', sa.Integer(), nullable=True))
    op.add_column('numbers', sa.Column('assigned_to', sa.String(), nullable=True))  # 'workspace' or 'campaign'
    op.add_column('numbers', sa.Column('assigned_id', sa.String(), nullable=True))  # workspace_id or campaign_id
    op.add_column('numbers', sa.Column('tags', postgresql.JSONB(), nullable=True))
    
    # Update existing records to have default verification_status
    op.execute("UPDATE numbers SET verification_status = 'verified' WHERE verified = true")
    op.execute("UPDATE numbers SET verification_status = 'pending' WHERE verified = false")
    
    # ===================== CallOutcome Table Extensions =====================
    # Add BANT/TRADE schema fields to existing call_outcomes table
    op.add_column('call_outcomes', sa.Column('schema_version', sa.Integer(), nullable=True, default=1))
    op.add_column('call_outcomes', sa.Column('bant_json', postgresql.JSONB(), nullable=True))
    op.add_column('call_outcomes', sa.Column('disposition', sa.String(), nullable=True))
    op.add_column('call_outcomes', sa.Column('next_action', sa.String(), nullable=True))
    op.add_column('call_outcomes', sa.Column('crm_sync_json', postgresql.JSONB(), nullable=True))
    
    # ===================== UserAuth Table Extensions =====================
    # Add TOTP and OAuth fields to existing user_auth table
    op.add_column('user_auth', sa.Column('totp_enabled', sa.Boolean(), nullable=True, default=False))
    op.add_column('user_auth', sa.Column('totp_verified_at', sa.DateTime(), nullable=True))
    op.add_column('user_auth', sa.Column('oauth_refresh_token', sa.String(), nullable=True))
    op.add_column('user_auth', sa.Column('oauth_expires_at', sa.DateTime(), nullable=True))
    
    # ===================== New Tables for Sprint 6 =====================
    
    # Magic link authentication
    op.create_table('magic_links',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('token_hash', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Admin impersonation sessions
    op.create_table('impersonation_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('admin_user_id', sa.String(), nullable=False),
        sa.Column('target_user_id', sa.String(), nullable=False),
        sa.Column('token_hash', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # CRM HubSpot integration
    op.create_table('hubspot_connections',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('access_token', sa.String(), nullable=False),
        sa.Column('refresh_token', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('portal_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # CRM field mappings
    op.create_table('crm_field_mappings',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('crm_provider', sa.String(), nullable=False),  # 'hubspot', 'zoho', etc.
        sa.Column('mapping_json', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # CSV export jobs
    op.create_table('export_jobs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),  # 'calls', 'outcomes', 'leads'
        sa.Column('filters_json', postgresql.JSONB(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, default='pending'),  # pending, processing, completed, failed
        sa.Column('file_url', sa.String(), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # ===================== Indexes for Performance =====================
    op.create_index('ix_numbers_verification_status', 'numbers', ['verification_status'])
    op.create_index('ix_numbers_assigned_to', 'numbers', ['assigned_to', 'assigned_id'])
    op.create_index('ix_call_outcomes_schema_version', 'call_outcomes', ['schema_version'])
    op.create_index('ix_call_outcomes_disposition', 'call_outcomes', ['disposition'])
    op.create_index('ix_magic_links_token_hash', 'magic_links', ['token_hash'])
    op.create_index('ix_impersonation_sessions_token_hash', 'impersonation_sessions', ['token_hash'])
    op.create_index('ix_export_jobs_status', 'export_jobs', ['status'])


def downgrade() -> None:
    # Remove indexes
    op.drop_index('ix_numbers_verification_status')
    op.drop_index('ix_numbers_assigned_to')
    op.drop_index('ix_call_outcomes_schema_version')
    op.drop_index('ix_call_outcomes_disposition')
    op.drop_index('ix_magic_links_token_hash')
    op.drop_index('ix_impersonation_sessions_token_hash')
    op.drop_index('ix_export_jobs_status')
    
    # Drop new tables
    op.drop_table('export_jobs')
    op.drop_table('crm_field_mappings')
    op.drop_table('hubspot_connections')
    op.drop_table('impersonation_sessions')
    op.drop_table('magic_links')
    
    # Remove columns from existing tables
    op.drop_column('user_auth', 'oauth_expires_at')
    op.drop_column('user_auth', 'oauth_refresh_token')
    op.drop_column('user_auth', 'totp_verified_at')
    op.drop_column('user_auth', 'totp_enabled')
    
    op.drop_column('call_outcomes', 'crm_sync_json')
    op.drop_column('call_outcomes', 'next_action')
    op.drop_column('call_outcomes', 'disposition')
    op.drop_column('call_outcomes', 'bant_json')
    op.drop_column('call_outcomes', 'schema_version')
    
    op.drop_column('numbers', 'tags')
    op.drop_column('numbers', 'assigned_id')
    op.drop_column('numbers', 'assigned_to')
    op.drop_column('numbers', 'monthly_cost_cents')
    op.drop_column('numbers', 'purchase_cost_cents')
    op.drop_column('numbers', 'verification_status')
    op.drop_column('numbers', 'provider_number_id')
