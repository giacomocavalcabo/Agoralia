"""Sprint 9: CRM Core Integrations

Revision ID: 0008
Revises: 0003_numbers_outcomes
Create Date: 2025-01-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0008'
down_revision = '0003_numbers_outcomes'
branch_labels = None
depends_on = None


def upgrade():
    # Create enum types safely (only if they don't exist)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_provider') THEN
                CREATE TYPE crm_provider AS ENUM ('hubspot', 'zoho', 'odoo');
            END IF;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_connection_status') THEN
                CREATE TYPE crm_connection_status AS ENUM ('connected', 'error', 'disconnected');
            END IF;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_object_type') THEN
                CREATE TYPE crm_object_type AS ENUM ('contact', 'company', 'deal', 'activity');
            END IF;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_sync_direction') THEN
                CREATE TYPE crm_sync_direction AS ENUM ('push', 'pull');
            END IF;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_log_level') THEN
                CREATE TYPE crm_log_level AS ENUM ('info', 'warn', 'error');
            END IF;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_webhook_status') THEN
                CREATE TYPE crm_webhook_status AS ENUM ('pending', 'processed', 'error');
            END IF;
        END $$;
    """)
    
    # Drop old tables if they exist to avoid conflicts
    op.execute("DROP TABLE IF EXISTS hubspot_connections CASCADE;")
    op.execute("DROP TABLE IF EXISTS crm_field_mappings CASCADE;")
    # Create crm_connections table
    op.create_table('crm_connections',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('provider', sa.Enum('hubspot', 'zoho', 'odoo', name='crm_provider'), nullable=False),
        sa.Column('status', sa.Enum('connected', 'error', 'disconnected', name='crm_connection_status'), nullable=False),
        sa.Column('access_token_enc', sa.Text(), nullable=False),
        sa.Column('refresh_token_enc', sa.Text(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('base_url', sa.String(), nullable=True),
        sa.Column('account_id', sa.String(), nullable=True),
        sa.Column('dc_region', sa.String(), nullable=True),
        sa.Column('scopes', sa.String(), nullable=True),
        sa.Column('webhook_secret_enc', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create crm_entity_links table
    op.create_table('crm_entity_links',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('provider', sa.Enum('hubspot', 'zoho', 'odoo', name='crm_provider'), nullable=False),
        sa.Column('object', sa.Enum('contact', 'company', 'deal', 'activity', name='crm_object_type'), nullable=False),
        sa.Column('local_id', sa.String(), nullable=False),
        sa.Column('remote_id', sa.String(), nullable=False),
        sa.Column('remote_etag', sa.String(), nullable=True),
        sa.Column('last_sync_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create crm_field_mappings table
    op.create_table('crm_field_mappings',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('provider', sa.Enum('hubspot', 'zoho', 'odoo', name='crm_provider'), nullable=False),
        sa.Column('object', sa.Enum('contact', 'company', 'deal', 'activity', name='crm_object_type'), nullable=False),
        sa.Column('mapping_json', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('picklists_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create crm_sync_cursors table
    op.create_table('crm_sync_cursors',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('provider', sa.Enum('hubspot', 'zoho', 'odoo', name='crm_provider'), nullable=False),
        sa.Column('object', sa.Enum('contact', 'company', 'deal', 'activity', name='crm_object_type'), nullable=False),
        sa.Column('since_ts', sa.DateTime(), nullable=True),
        sa.Column('cursor_token', sa.String(), nullable=True),
        sa.Column('page_after', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create crm_sync_logs table
    op.create_table('crm_sync_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('provider', sa.Enum('hubspot', 'zoho', 'odoo', name='crm_provider'), nullable=False),
        sa.Column('level', sa.Enum('info', 'warn', 'error', name='crm_log_level'), nullable=False),
        sa.Column('object', sa.Enum('contact', 'company', 'deal', 'activity', name='crm_object_type'), nullable=False),
        sa.Column('direction', sa.Enum('push', 'pull', name='crm_sync_direction'), nullable=False),
        sa.Column('correlation_id', sa.String(), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('payload_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create crm_webhook_events table
    op.create_table('crm_webhook_events',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('provider', sa.Enum('hubspot', 'zoho', 'odoo', name='crm_provider'), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('event_id', sa.String(), nullable=False),
        sa.Column('object', sa.Enum('contact', 'company', 'deal', 'activity', name='crm_object_type'), nullable=False),
        sa.Column('payload_json', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('status', sa.Enum('pending', 'processed', 'error', name='crm_webhook_status'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for performance
    op.create_index('ix_crm_connections_workspace_provider', 'crm_connections', ['workspace_id', 'provider'])
    op.create_index('ix_crm_entity_links_workspace_provider', 'crm_entity_links', ['workspace_id', 'provider'])
    op.create_index('ix_crm_entity_links_remote_id', 'crm_entity_links', ['provider', 'remote_id'])
    op.create_index('ix_crm_field_mappings_workspace_provider', 'crm_field_mappings', ['workspace_id', 'provider'])
    op.create_index('ix_crm_sync_cursors_workspace_provider', 'crm_sync_cursors', ['workspace_id', 'provider'])
    op.create_index('ix_crm_sync_logs_workspace_provider', 'crm_sync_logs', ['workspace_id', 'provider'])
    op.create_index('ix_crm_sync_logs_created_at', 'crm_sync_logs', ['created_at'])
    op.create_index('ix_crm_webhook_events_provider_workspace', 'crm_webhook_events', ['provider', 'workspace_id'])
    op.create_index('ix_crm_webhook_events_status', 'crm_webhook_events', ['status'])
    
    # Create unique constraints
    op.create_unique_constraint('uq_crm_entity_links_local', 'crm_entity_links', ['workspace_id', 'provider', 'object', 'local_id'])
    op.create_unique_constraint('uq_crm_entity_links_remote', 'crm_entity_links', ['provider', 'remote_id'])
    op.create_unique_constraint('uq_crm_field_mappings_workspace', 'crm_field_mappings', ['workspace_id', 'provider', 'object'])
    op.create_unique_constraint('uq_crm_sync_cursors_workspace', 'crm_sync_cursors', ['workspace_id', 'provider', 'object'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_crm_webhook_events_status')
    op.drop_index('ix_crm_webhook_events_provider_workspace')
    op.drop_index('ix_crm_sync_logs_created_at')
    op.drop_index('ix_crm_sync_logs_workspace_provider')
    op.drop_index('ix_crm_sync_cursors_workspace_provider')
    op.drop_index('ix_crm_field_mappings_workspace_provider')
    op.drop_index('ix_crm_entity_links_remote_id')
    op.drop_index('ix_crm_entity_links_workspace_provider')
    op.drop_index('ix_crm_connections_workspace_provider')
    
    # Drop tables
    op.drop_table('crm_webhook_events')
    op.drop_table('crm_sync_logs')
    op.drop_table('crm_sync_cursors')
    op.drop_table('crm_field_mappings')
    op.drop_table('crm_entity_links')
    op.drop_table('crm_connections')
    
    # Drop enum types
    op.execute("DROP TYPE crm_webhook_status")
    op.execute("DROP TYPE crm_log_level")
    op.execute("DROP TYPE crm_sync_direction")
    op.execute("DROP TYPE crm_object_type")
    op.execute("DROP TYPE crm_connection_status")
    op.execute("DROP TYPE crm_provider")
