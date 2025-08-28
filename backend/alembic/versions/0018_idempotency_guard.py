"""Add idempotency constraints to prevent race conditions

Revision ID: 0018
Revises: 0017
Create Date: 2025-01-27 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0018'
down_revision = '0017'
branch_labels = None
depends_on = None


def upgrade():
    """Add idempotency constraints to prevent race conditions"""
    
    # BillingLedger: unique constraint on (workspace_id, idempotency_key)
    # This prevents duplicate transactions across workspace boundaries
    op.create_index(
        "ix_ledger_ws_idem",
        "billing_ledger",
        ["workspace_id", "idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL")
    )
    
    # NumberOrder: unique constraint on (workspace_id, idempotency_key)
    # This prevents duplicate number orders within the same workspace
    try:
        op.create_unique_constraint(
            "uq_number_orders_ws_idem",
            "number_orders",
            ["workspace_id", "idempotency_key"],
        )
    except Exception:
        # Skip if idempotency_key column doesn't exist yet
        pass


def downgrade():
    """Remove idempotency constraints"""
    
    # Drop BillingLedger index
    op.drop_index("ix_ledger_ws_idem", "billing_ledger")
    
    # Drop NumberOrder constraint (if it exists)
    try:
        op.drop_constraint("uq_number_orders_ws_idem", "number_orders", type_="unique")
    except Exception:
        # Skip if constraint doesn't exist
        pass
