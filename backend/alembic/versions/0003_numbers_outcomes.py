"""numbers and outcomes

Revision ID: 0003_numbers_outcomes
Revises: 0002_admin_auth
Create Date: 2025-08-18 02:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '0003_numbers_outcomes'
down_revision = '0002_admin_auth'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('workspaces') as b:
        b.add_column(sa.Column('default_from_number_e164', sa.String()))
    with op.batch_alter_table('campaigns') as b:
        b.add_column(sa.Column('from_number_e164', sa.String()))

    op.create_table(
        'numbers',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('e164', sa.String(), nullable=False),
        sa.Column('country_iso', sa.String()),
        sa.Column('source', sa.String(), server_default='byo'),
        sa.Column('capabilities', sa.JSON()),
        sa.Column('verified', sa.Boolean(), server_default=sa.text('0')),
        sa.Column('verification_method', sa.String(), server_default='none'),
        sa.Column('verified_at', sa.DateTime()),
        sa.Column('provider', sa.String()),
        sa.Column('provider_ref', sa.String()),
        sa.Column('can_inbound', sa.Boolean(), server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table(
        'number_verifications',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('number_id', sa.String(), sa.ForeignKey('numbers.id')),
        sa.Column('method', sa.String()),
        sa.Column('code', sa.String()),
        sa.Column('status', sa.String(), server_default='sent'),
        sa.Column('attempts', sa.Integer(), server_default='0'),
        sa.Column('last_sent_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table(
        'inbound_routes',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('number_id', sa.String(), sa.ForeignKey('numbers.id')),
        sa.Column('agent_id', sa.String()),
        sa.Column('hours_json', sa.JSON()),
        sa.Column('voicemail', sa.Boolean(), server_default=sa.text('0')),
        sa.Column('transcript', sa.Boolean(), server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table(
        'call_outcomes',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('call_id', sa.String(), sa.ForeignKey('calls.id')),
        sa.Column('campaign_id', sa.String(), sa.ForeignKey('campaigns.id')),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id')),
        sa.Column('template_name', sa.String()),
        sa.Column('fields_json', sa.JSON()),
        sa.Column('ai_summary_short', sa.Text()),
        sa.Column('ai_summary_long', sa.Text()),
        sa.Column('action_items_json', sa.JSON()),
        sa.Column('sentiment', sa.Integer()),
        sa.Column('score_lead', sa.Integer()),
        sa.Column('next_step', sa.String()),
        sa.Column('synced_crm_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
    )

    op.create_table(
        'templates',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id')),
        sa.Column('name', sa.String()),
        sa.Column('fields_json', sa.JSON()),
        sa.Column('crm_mapping_json', sa.JSON()),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table(
        'crm_connections',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id')),
        sa.Column('provider', sa.String()),
        sa.Column('oauth_tokens_json', sa.JSON()),
        sa.Column('created_at', sa.DateTime()),
    )


def downgrade() -> None:
    op.drop_table('crm_connections')
    op.drop_table('templates')
    op.drop_table('call_outcomes')
    op.drop_table('inbound_routes')
    op.drop_table('number_verifications')
    op.drop_table('numbers')
    with op.batch_alter_table('campaigns') as b:
        b.drop_column('from_number_e164')
    with op.batch_alter_table('workspaces') as b:
        b.drop_column('default_from_number_e164')


