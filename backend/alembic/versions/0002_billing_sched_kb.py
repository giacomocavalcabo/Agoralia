from alembic import op
import sqlalchemy as sa

revision = '0002_billing_sched_kb'
down_revision = '0001_init'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # calls: audio_url
    with op.batch_alter_table('calls') as b:
        b.add_column(sa.Column('audio_url', sa.Text(), nullable=True))

    # settings: budget fields
    with op.batch_alter_table('settings') as b:
        b.add_column(sa.Column('budget_monthly_cents', sa.Integer(), nullable=True))
        b.add_column(sa.Column('budget_warn_percent', sa.Integer(), server_default=sa.text('80')))
        b.add_column(sa.Column('budget_stop_enabled', sa.Integer(), server_default=sa.text('1')))

    # kb_sections
    op.create_table(
        'kb_sections',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('kb_id', sa.Integer(), sa.ForeignKey('kbs.id')),
        sa.Column('kind', sa.String(length=16), nullable=False),
        sa.Column('content_text', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # scheduled_calls
    op.create_table(
        'scheduled_calls',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('lead_id', sa.Integer(), nullable=True),
        sa.Column('to_number', sa.String(length=32), nullable=False),
        sa.Column('from_number', sa.String(length=32), nullable=True),
        sa.Column('agent_id', sa.String(length=128), nullable=True),
        sa.Column('kb_id', sa.Integer(), nullable=True),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('campaign_id', sa.Integer(), nullable=True),
        sa.Column('timezone', sa.String(length=64), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=16), server_default='scheduled'),
        sa.Column('provider_call_id', sa.String(length=128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # billing tables
    op.create_table(
        'plans',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(length=32), nullable=False),
        sa.Column('monthly_fee_cents', sa.Integer(), server_default=sa.text('0')),
        sa.Column('minute_price_cents', sa.Integer(), server_default=sa.text('0')),
        sa.Column('features_json', sa.Text(), nullable=True),
    )

    op.create_table(
        'subscriptions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('stripe_customer_id', sa.String(length=128), nullable=True),
        sa.Column('stripe_subscription_id', sa.String(length=128), nullable=True),
        sa.Column('plan_code', sa.String(length=32), server_default='free'),
        sa.Column('status', sa.String(length=32), server_default='trialing'),
        sa.Column('renews_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancel_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'usage_events',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('call_id', sa.Integer(), sa.ForeignKey('calls.id'), nullable=True),
        sa.Column('minutes_billed', sa.Integer(), server_default=sa.text('0')),
        sa.Column('ts', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('synced_to_stripe', sa.Integer(), server_default=sa.text('0')),
    )

    op.create_table(
        'addons',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=32), nullable=False),
        sa.Column('qty', sa.Integer(), server_default=sa.text('0')),
        sa.Column('unit_price_cents', sa.Integer(), server_default=sa.text('0')),
        sa.Column('active', sa.Integer(), server_default=sa.text('1')),
    )

    op.create_table(
        'entitlements',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=64), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('source', sa.String(length=16), server_default='plan'),
    )

    op.create_table(
        'user_plan_overrides',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=64), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('user_plan_overrides')
    op.drop_table('entitlements')
    op.drop_table('addons')
    op.drop_table('usage_events')
    op.drop_table('subscriptions')
    op.drop_table('plans')
    op.drop_table('scheduled_calls')
    op.drop_table('kb_sections')
    with op.batch_alter_table('settings') as b:
        b.drop_column('budget_stop_enabled')
        b.drop_column('budget_warn_percent')
        b.drop_column('budget_monthly_cents')
    with op.batch_alter_table('calls') as b:
        b.drop_column('audio_url')


