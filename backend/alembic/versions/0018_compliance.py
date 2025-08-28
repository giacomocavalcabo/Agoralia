from alembic import op
import sqlalchemy as sa

revision = "0018_compliance"
down_revision = "0017_budget_and_ledger"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "regulatory_submissions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("workspace_id", sa.String(), nullable=False, index=True),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("country", sa.String(), nullable=False),
        sa.Column("number_type", sa.String(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="draft"),
        sa.Column("required_fields", sa.JSON(), server_default=sa.text("'{}'")),
        sa.Column("provided_fields", sa.JSON(), server_default=sa.text("'{}'")),
        sa.Column("files", sa.JSON(), server_default=sa.text("'[]'")),
        sa.Column("notes", sa.Text(), server_default=""),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_regsub_ws", "regulatory_submissions", ["workspace_id"])

def downgrade():
    op.drop_index("ix_regsub_ws", table_name="regulatory_submissions")
    op.drop_table("regulatory_submissions")
