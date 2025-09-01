"""Sprint 9: Provider Account Integrations

Extend ProviderAccount to support CRM integrations beyond telephony.
Adds category, auth_type, secrets_encrypted, scopes, status fields.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0020_provider_account_integrations"
down_revision = "0019_compliance"  # aggiorna al tuo head attuale

def upgrade():
    with op.batch_alter_table("provider_accounts") as batch:
        batch.add_column(sa.Column("category", sa.String(length=32), nullable=True))
        batch.add_column(sa.Column("auth_type", sa.String(length=16), nullable=True))
        batch.add_column(sa.Column("secrets_encrypted", sa.Text(), nullable=True))
        batch.add_column(sa.Column("scopes", sa.Text(), nullable=True))
        batch.add_column(sa.Column("status", sa.String(length=16), nullable=True))
    
    # Backfill existing telephony accounts
    op.execute("""
        UPDATE provider_accounts
        SET category = COALESCE(category, 'telephony'),
            auth_type = COALESCE(auth_type, 'api_key'),
            status = COALESCE(status, 'connected')
        WHERE category IS NULL
    """)

def downgrade():
    with op.batch_alter_table("provider_accounts") as batch:
        batch.drop_column("status")
        batch.drop_column("scopes")
        batch.drop_column("secrets_encrypted")
        batch.drop_column("auth_type")
        batch.drop_column("category")
