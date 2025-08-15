from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_init'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Minimal schema aligned with backend/migrations/0001_init.sql
    op.create_table(
        'calls',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('direction', sa.String(length=16), nullable=False),
        sa.Column('provider', sa.String(length=32), server_default='retell'),
        sa.Column('to_number', sa.String(length=32), nullable=True),
        sa.Column('from_number', sa.String(length=32), nullable=True),
        sa.Column('provider_call_id', sa.String(length=128), nullable=True),
        sa.Column('status', sa.String(length=32), server_default='created'),
        sa.Column('raw_response', sa.Text(), nullable=True),
    )

    op.create_table(
        'call_segments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('call_id', sa.Integer(), sa.ForeignKey('calls.id')),
        sa.Column('provider_call_id', sa.String(length=128), nullable=True),
        sa.Column('turn_index', sa.Integer(), nullable=True),
        sa.Column('speaker', sa.String(length=16), nullable=True),
        sa.Column('start_ms', sa.Integer(), nullable=True),
        sa.Column('end_ms', sa.Integer(), nullable=True),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('ts', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'summaries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('call_id', sa.Integer(), sa.ForeignKey('calls.id')),
        sa.Column('provider_call_id', sa.String(length=128), nullable=True),
        sa.Column('bullets_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'call_structured',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('call_id', sa.Integer(), sa.ForeignKey('calls.id')),
        sa.Column('bant_json', sa.Text(), nullable=True),
        sa.Column('trade_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'call_media',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('call_id', sa.Integer(), sa.ForeignKey('calls.id')),
        sa.Column('audio_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'dispositions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('call_id', sa.Integer(), sa.ForeignKey('calls.id')),
        sa.Column('outcome', sa.String(length=64), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('default_agent_id', sa.String(length=128), nullable=True),
        sa.Column('default_from_number', sa.String(length=32), nullable=True),
        sa.Column('default_spacing_ms', sa.Integer(), server_default=sa.text('1000')),
        sa.Column('require_legal_review', sa.Integer(), server_default=sa.text('1')),
        sa.Column('legal_defaults_json', sa.Text(), nullable=True),
    )

    op.create_table(
        'webhook_events',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('event_id', sa.String(length=128), nullable=True),
        sa.Column('type', sa.String(length=64), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('processed', sa.Integer(), server_default=sa.text('0')),
        sa.Column('raw_json', sa.Text(), nullable=True),
    )

    op.create_table(
        'webhook_dlq',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('event_id', sa.String(length=128), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('raw_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('webhook_dlq')
    op.drop_table('webhook_events')
    op.drop_table('settings')
    op.drop_table('dispositions')
    op.drop_table('call_media')
    op.drop_table('call_structured')
    op.drop_table('summaries')
    op.drop_table('call_segments')
    op.drop_table('calls')


