from alembic import op
import sqlalchemy as sa

revision = "0016_history_indexes"
down_revision = "0015_gamma_calls_storage"

def upgrade():
    # Create indexes for calls table to improve History page performance
    op.create_index("ix_calls_workspace_created", "calls", ["workspace_id","created_at"], unique=False)
    op.create_index("ix_calls_campaign", "calls", ["campaign_id"], unique=False)
    op.create_index("ix_calls_agent", "calls", ["agent_id"], unique=False)
    op.create_index("ix_calls_lang_country", "calls", ["lang","country"], unique=False)
    op.create_index("ix_calls_outcome_score", "calls", ["outcome","score"], unique=False)
    
    # Optional: full-text search index for transcript if using Postgres
    # op.execute("CREATE INDEX IF NOT EXISTS ix_calls_transcript_fts ON calls USING GIN (to_tsvector('simple', coalesce(transcript,'')));")

def downgrade():
    # Drop all created indexes
    for name in [
        "ix_calls_workspace_created",
        "ix_calls_campaign", 
        "ix_calls_agent",
        "ix_calls_lang_country",
        "ix_calls_outcome_score"
    ]:
        op.drop_index(name, table_name="calls")
