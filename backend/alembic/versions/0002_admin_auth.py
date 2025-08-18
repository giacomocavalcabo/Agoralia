"""admin auth & extensions

Revision ID: 0002_admin_auth
Revises: 0001_init
Create Date: 2025-08-18 01:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0002_admin_auth'
down_revision = '0001_init'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend calls table
    with op.batch_alter_table('calls') as batch_op:
        batch_op.add_column(sa.Column('lead_id', sa.String()))
        batch_op.add_column(sa.Column('agent_id', sa.String()))
        batch_op.add_column(sa.Column('provider', sa.String()))
        batch_op.add_column(sa.Column('started_at', sa.DateTime()))
        batch_op.add_column(sa.Column('ended_at', sa.DateTime()))
        batch_op.add_column(sa.Column('live', sa.Boolean(), server_default=sa.text('0')))
        batch_op.add_column(sa.Column('outcome', sa.String()))
        batch_op.add_column(sa.Column('meta_json', sa.JSON()))

    # New tables
    op.create_table(
        'user_auth',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('provider_id', sa.String()),
        sa.Column('pass_hash', sa.String()),
        sa.Column('passkey_credential_json', sa.JSON()),
        sa.Column('totp_secret', sa.String()),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table(
        'profiles',
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('company', sa.String()),
        sa.Column('country_iso', sa.String()),
        sa.Column('phone_e164', sa.String()),
        sa.Column('newsletter_optin', sa.Boolean(), server_default=sa.text('0')),
    )

    op.create_table(
        'plans',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('code', sa.String(), unique=True),
        sa.Column('name', sa.String()),
        sa.Column('features_json', sa.JSON()),
        sa.Column('concurrency_limit', sa.Integer(), server_default='1'),
        sa.Column('price_cents_m', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table(
        'subscriptions',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('plan_id', sa.String(), sa.ForeignKey('plans.id')),
        sa.Column('status', sa.String()),
        sa.Column('started_at', sa.DateTime()),
        sa.Column('current_period_end', sa.DateTime()),
    )

    op.create_table(
        'usage_counters',
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id'), primary_key=True),
        sa.Column('period_ym', sa.String(), primary_key=True),
        sa.Column('minutes_voice', sa.Integer(), server_default='0'),
        sa.Column('minutes_ai', sa.Integer(), server_default='0'),
        sa.Column('calls_count', sa.Integer(), server_default='0'),
        sa.Column('cost_cents', sa.Integer(), server_default='0'),
        sa.Column('updated_at', sa.DateTime()),
    )

    op.create_table(
        'credits',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('cents', sa.Integer(), server_default='0'),
        sa.Column('reason', sa.Text()),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table(
        'scheduled_calls',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('campaign_id', sa.String(), sa.ForeignKey('campaigns.id')),
        sa.Column('lead_id', sa.String()),
        sa.Column('at', sa.DateTime()),
        sa.Column('tz', sa.String()),
        sa.Column('lang', sa.String()),
        sa.Column('state', sa.String(), server_default='scheduled'),
        sa.Column('reason', sa.String()),
    )

    op.create_table(
        'attestations',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('campaign_id', sa.String(), sa.ForeignKey('campaigns.id')),
        sa.Column('iso', sa.String()),
        sa.Column('notice_version', sa.String()),
        sa.Column('inputs_json', sa.JSON()),
        sa.Column('pdf_url', sa.String()),
        sa.Column('sha256', sa.String()),
        sa.Column('signed_by_user_id', sa.String(), sa.ForeignKey('users.id')),
        sa.Column('signed_at', sa.DateTime()),
    )

    op.create_table(
        'preflight_checks',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('number_hash', sa.String()),
        sa.Column('iso', sa.String()),
        sa.Column('decision', sa.String()),
        sa.Column('reasons_json', sa.JSON()),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table(
        'notifications',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id')),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id')),
        sa.Column('kind', sa.String()),
        sa.Column('locale', sa.String()),
        sa.Column('subject', sa.String()),
        sa.Column('body_md', sa.Text()),
        sa.Column('sent_at', sa.DateTime()),
        sa.Column('stats_json', sa.JSON()),
    )

    op.create_table(
        'notification_targets',
        sa.Column('notification_id', sa.String(), sa.ForeignKey('notifications.id'), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), primary_key=True),
    )

    op.create_table(
        'activity_log',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id')),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id')),
        sa.Column('actor_user_id', sa.String(), sa.ForeignKey('users.id')),
        sa.Column('actor_ip', sa.String()),
        sa.Column('kind', sa.String()),
        sa.Column('entity', sa.String()),
        sa.Column('entity_id', sa.String()),
        sa.Column('diff_json', sa.JSON()),
        sa.Column('created_at', sa.DateTime()),
    )


def downgrade() -> None:
    # Drop in reverse order
    op.drop_table('activity_log')
    op.drop_table('notification_targets')
    op.drop_table('notifications')
    op.drop_table('preflight_checks')
    op.drop_table('attestations')
    op.drop_table('scheduled_calls')
    op.drop_table('credits')
    op.drop_table('usage_counters')
    op.drop_table('subscriptions')
    op.drop_table('plans')
    op.drop_table('profiles')
    op.drop_table('user_auth')

    with op.batch_alter_table('calls') as batch_op:
        batch_op.drop_column('meta_json')
        batch_op.drop_column('outcome')
        batch_op.drop_column('live')
        batch_op.drop_column('ended_at')
        batch_op.drop_column('started_at')
        batch_op.drop_column('provider')
        batch_op.drop_column('agent_id')
        batch_op.drop_column('lead_id')


