"""Add budget fields to workspaces and create billing_ledger table

Revision ID: 0017
Revises: 0016
Create Date: 2025-01-27 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade():
    # Add budget fields to workspaces table
    op.add_column("workspaces", sa.Column("monthly_budget_cents", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("workspaces", sa.Column("budget_currency", sa.String(length=3), nullable=False, server_default="USD"))
    op.add_column("workspaces", sa.Column("budget_resets_day", sa.SmallInteger(), nullable=False, server_default="1"))
    op.add_column("workspaces", sa.Column("budget_hard_stop", sa.Boolean(), nullable=False, server_default=sa.true()))
    
    # Use JSON for Postgres, Text for SQLite
    try:
        op.add_column("workspaces", sa.Column("budget_thresholds", sa.JSON(), nullable=False, server_default='[0.8,1.0]'))
    except:
        # Fallback for SQLite
        op.add_column("workspaces", sa.Column("budget_thresholds", sa.Text(), nullable=False, server_default='[0.8,1.0]'))

    # Create billing_ledger table
    op.create_table(
        "billing_ledger",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("provider", sa.String(length=32), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    
    # Create indexes
    op.create_index("ix_ledger_ws_created", "billing_ledger", ["workspace_id", "created_at"])
    op.create_index("ix_ledger_idempotency", "billing_ledger", ["idempotency_key"], unique=True)


def downgrade():
    # Drop indexes
    op.drop_index("ix_ledger_idempotency", "billing_ledger")
    op.drop_index("ix_ledger_ws_created", "billing_ledger")
    
    # Drop billing_ledger table
    op.drop_table("billing_ledger")
    
    # Drop budget columns from workspaces
    op.drop_column("workspaces", "budget_thresholds")
    op.drop_column("workspaces", "budget_hard_stop")
    op.drop_column("workspaces", "budget_resets_day")
    op.drop_column("workspaces", "budget_currency")
    op.drop_column("workspaces", "monthly_budget_cents")
