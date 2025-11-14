"""add country_rules table and lead nature field

Revision ID: 0004_country_rules_lead_nature
Revises: 0003_extend_campaigns
Create Date: 2024-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0004_country_rules_lead_nature'
down_revision = '0003_extend_campaigns'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create country_rules table
    op.create_table(
        'country_rules',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('country_iso', sa.String(length=8), nullable=False),
        sa.Column('regime_b2b', sa.String(length=16), server_default='opt_out'),
        sa.Column('regime_b2c', sa.String(length=16), server_default='opt_out'),
        sa.Column('dnc_registry_enabled', sa.Integer(), server_default=sa.text('0')),
        sa.Column('dnc_registry_name', sa.String(length=128), nullable=True),
        sa.Column('dnc_registry_url', sa.Text(), nullable=True),
        sa.Column('dnc_check_required', sa.Integer(), server_default=sa.text('0')),
        sa.Column('dnc_api_available', sa.Integer(), server_default=sa.text('0')),
        sa.Column('quiet_hours_enabled', sa.Integer(), server_default=sa.text('0')),
        sa.Column('quiet_hours_weekdays', sa.String(length=32), nullable=True),
        sa.Column('quiet_hours_saturday', sa.String(length=32), nullable=True),
        sa.Column('quiet_hours_sunday', sa.String(length=32), nullable=True),
        sa.Column('timezone', sa.String(length=64), nullable=True),
        sa.Column('ai_disclosure_required', sa.Integer(), server_default=sa.text('0')),
        sa.Column('ai_disclosure_note', sa.Text(), nullable=True),
        sa.Column('recording_basis', sa.String(length=32), nullable=True, server_default='consent'),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('tenant_id', 'country_iso', name='uq_country_rules_tenant_country')
    )
    
    # Add nature field to leads table
    with op.batch_alter_table('leads', schema=None) as batch_op:
        batch_op.add_column(sa.Column('nature', sa.String(length=8), nullable=True, server_default='unknown'))


def downgrade() -> None:
    # Remove nature field from leads
    with op.batch_alter_table('leads', schema=None) as batch_op:
        batch_op.drop_column('nature')
    
    # Drop country_rules table
    op.drop_table('country_rules')

