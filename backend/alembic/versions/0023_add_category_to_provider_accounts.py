"""Add category to provider_accounts

Revision ID: 0023_add_category_to_provider_accounts
Revises: 0022_add_audit_events_table
Create Date: 2025-09-04 14:40:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0023_add_category_to_provider_accounts'
down_revision = '0022_add_audit_events_table'
branch_labels = None
depends_on = None

def upgrade():
    """Add category column to provider_accounts table"""
    # Add nullable column with default
    op.add_column('provider_accounts', sa.Column('category', sa.String(length=50), nullable=True))
    
    # Backfill existing records - set telephony for existing records
    op.execute("UPDATE provider_accounts SET category = 'telephony' WHERE category IS NULL")
    
    # Make column NOT NULL
    op.alter_column('provider_accounts', 'category', nullable=False)
    
    # Add other missing columns for CRM integrations
    op.add_column('provider_accounts', sa.Column('auth_type', sa.String(length=20), nullable=True))
    op.add_column('provider_accounts', sa.Column('status', sa.String(length=20), nullable=True))
    op.add_column('provider_accounts', sa.Column('access_token_encrypted', sa.String(), nullable=True))
    op.add_column('provider_accounts', sa.Column('refresh_token_encrypted', sa.String(), nullable=True))
    op.add_column('provider_accounts', sa.Column('scopes', sa.String(), nullable=True))
    op.add_column('provider_accounts', sa.Column('external_id', sa.String(), nullable=True))
    op.add_column('provider_accounts', sa.Column('expires_at', sa.DateTime(), nullable=True))
    op.add_column('provider_accounts', sa.Column('metadata_json', sa.JSON(), nullable=True))
    op.add_column('provider_accounts', sa.Column('updated_at', sa.DateTime(), nullable=True))
    
    # Set default values for existing records
    op.execute("UPDATE provider_accounts SET auth_type = 'api_key' WHERE auth_type IS NULL")
    op.execute("UPDATE provider_accounts SET status = 'connected' WHERE status IS NULL")
    op.execute("UPDATE provider_accounts SET updated_at = created_at WHERE updated_at IS NULL")

def downgrade():
    """Remove category and other CRM columns from provider_accounts table"""
    op.drop_column('provider_accounts', 'metadata_json')
    op.drop_column('provider_accounts', 'expires_at')
    op.drop_column('provider_accounts', 'external_id')
    op.drop_column('provider_accounts', 'scopes')
    op.drop_column('provider_accounts', 'refresh_token_encrypted')
    op.drop_column('provider_accounts', 'access_token_encrypted')
    op.drop_column('provider_accounts', 'status')
    op.drop_column('provider_accounts', 'auth_type')
    op.drop_column('provider_accounts', 'category')
