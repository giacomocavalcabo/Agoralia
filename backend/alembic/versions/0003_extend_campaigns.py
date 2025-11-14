"""extend campaigns table

Revision ID: 0003_extend_campaigns
Revises: 0002_billing_sched_kb
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0003_extend_campaigns'
down_revision = '0002_billing_sched_kb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend campaigns table with new fields
    with op.batch_alter_table('campaigns', schema=None) as batch_op:
        # Agent and phone configuration
        batch_op.add_column(sa.Column('agent_id', sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column('from_number_id', sa.Integer(), sa.ForeignKey('numbers.id'), nullable=True))
        batch_op.add_column(sa.Column('kb_id', sa.Integer(), sa.ForeignKey('kbs.id'), nullable=True))
        
        # Scheduling
        batch_op.add_column(sa.Column('start_date', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('end_date', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('timezone', sa.String(length=64), nullable=True, server_default='UTC'))
        
        # Limits & Budget
        batch_op.add_column(sa.Column('max_calls_per_day', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('budget_cents', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('cost_per_call_cents', sa.Integer(), nullable=True, server_default=sa.text('100')))
        
        # Stats
        batch_op.add_column(sa.Column('calls_made', sa.Integer(), nullable=False, server_default=sa.text('0')))
        batch_op.add_column(sa.Column('calls_successful', sa.Integer(), nullable=False, server_default=sa.text('0')))
        batch_op.add_column(sa.Column('calls_failed', sa.Integer(), nullable=False, server_default=sa.text('0')))
        batch_op.add_column(sa.Column('total_cost_cents', sa.Integer(), nullable=False, server_default=sa.text('0')))
        
        # Metadata
        batch_op.add_column(sa.Column('metadata_json', sa.Text(), nullable=True))
        
        # Updated at
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')))


def downgrade() -> None:
    # Remove added columns
    with op.batch_alter_table('campaigns', schema=None) as batch_op:
        batch_op.drop_column('updated_at')
        batch_op.drop_column('metadata_json')
        batch_op.drop_column('total_cost_cents')
        batch_op.drop_column('calls_failed')
        batch_op.drop_column('calls_successful')
        batch_op.drop_column('calls_made')
        batch_op.drop_column('cost_per_call_cents')
        batch_op.drop_column('budget_cents')
        batch_op.drop_column('max_calls_per_day')
        batch_op.drop_column('timezone')
        batch_op.drop_column('end_date')
        batch_op.drop_column('start_date')
        batch_op.drop_column('kb_id')
        batch_op.drop_column('from_number_id')
        batch_op.drop_column('agent_id')

