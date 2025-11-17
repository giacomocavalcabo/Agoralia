"""Add notifications fields to workspace_settings

Revision ID: 0018_add_notifications_to_workspace_settings
Revises: 0017_add_workspace_settings_user_preferences
Create Date: 2025-01-16 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0018_add_notifications_to_workspace_settings'
down_revision: Union[str, None] = '0017_add_workspace_settings_user_preferences'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use direct SQL to add columns (more reliable than op.add_column)
    from sqlalchemy import inspect, text
    import sys
    
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if workspace_settings table exists
    table_names = inspector.get_table_names()
    print(f"[MIGRATION 0018] Checking tables: {table_names}", file=sys.stderr, flush=True)
    
    if 'workspace_settings' not in table_names:
        print("⚠ workspace_settings table does not exist, skipping notification columns addition", file=sys.stderr, flush=True)
        return
    
    # Check if column already exists
    existing_columns = [col['name'] for col in inspector.get_columns('workspace_settings')]
    print(f"[MIGRATION 0018] Existing columns: {existing_columns}", file=sys.stderr, flush=True)
    
    # Add notification fields using direct SQL (more reliable)
    columns_to_add = [
        ('email_notifications_enabled', 'INTEGER NOT NULL DEFAULT 1'),
        ('email_campaign_started', 'INTEGER NOT NULL DEFAULT 1'),
        ('email_campaign_paused', 'INTEGER NOT NULL DEFAULT 1'),
        ('email_budget_warning', 'INTEGER NOT NULL DEFAULT 1'),
        ('email_compliance_alert', 'INTEGER NOT NULL DEFAULT 1'),
    ]
    
    columns_added = []
    for col_name, col_def in columns_to_add:
        if col_name not in existing_columns:
            print(f"[MIGRATION 0018] Adding {col_name} column using SQL", file=sys.stderr, flush=True)
            try:
                # Use op.execute with raw SQL for reliability
                op.execute(text(f"ALTER TABLE workspace_settings ADD COLUMN {col_name} {col_def}"))
                columns_added.append(col_name)
                print(f"[MIGRATION 0018] Successfully added {col_name}", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"⚠ [MIGRATION 0018] Error adding {col_name}: {e}", file=sys.stderr, flush=True)
                # If column already exists (race condition), that's OK
                if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
                    raise
    
    print(f"[MIGRATION 0018] Added {len(columns_added)} columns: {columns_added}", file=sys.stderr, flush=True)
    
    # Force commit and refresh inspector to verify columns were added
    # Note: Alembic handles commits automatically, but we need to refresh the inspector
    # to see the new columns in the same transaction
    try:
        # Refresh inspector connection to see new columns
        conn = op.get_bind()
        inspector = inspect(conn)
        final_columns = [col['name'] for col in inspector.get_columns('workspace_settings')]
        print(f"[MIGRATION 0018] Final columns after refresh: {final_columns}", file=sys.stderr, flush=True)
        
        # Check which columns were actually added
        missing = []
        for col in columns_added:
            if col not in final_columns:
                missing.append(col)
                print(f"⚠ [MIGRATION 0018] WARNING: Column {col} was not found after addition!", file=sys.stderr, flush=True)
        
        if not missing:
            print(f"[MIGRATION 0018] ✓ All {len(columns_added)} columns verified successfully", file=sys.stderr, flush=True)
        else:
            print(f"⚠ [MIGRATION 0018] {len(missing)} columns missing: {missing}", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"⚠ [MIGRATION 0018] Error verifying columns: {e}", file=sys.stderr, flush=True)
        import traceback
        print(f"[MIGRATION 0018] Traceback: {traceback.format_exc()}", file=sys.stderr, flush=True)


def downgrade() -> None:
    op.drop_column('workspace_settings', 'email_compliance_alert')
    op.drop_column('workspace_settings', 'email_budget_warning')
    op.drop_column('workspace_settings', 'email_campaign_paused')
    op.drop_column('workspace_settings', 'email_campaign_started')
    op.drop_column('workspace_settings', 'email_notifications_enabled')

