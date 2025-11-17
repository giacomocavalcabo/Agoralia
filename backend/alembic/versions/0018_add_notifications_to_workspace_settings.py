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
    # Check if table exists and column doesn't exist before adding
    from sqlalchemy import inspect, text
    from sqlalchemy.engine import Connection
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
    
    # Add notification fields to workspace_settings only if they don't exist
    columns_added = []
    if 'email_notifications_enabled' not in existing_columns:
        print("[MIGRATION 0018] Adding email_notifications_enabled column", file=sys.stderr, flush=True)
        op.add_column('workspace_settings', sa.Column('email_notifications_enabled', sa.Integer(), nullable=False, server_default='1'))
        columns_added.append('email_notifications_enabled')
    if 'email_campaign_started' not in existing_columns:
        print("[MIGRATION 0018] Adding email_campaign_started column", file=sys.stderr, flush=True)
        op.add_column('workspace_settings', sa.Column('email_campaign_started', sa.Integer(), nullable=False, server_default='1'))
        columns_added.append('email_campaign_started')
    if 'email_campaign_paused' not in existing_columns:
        print("[MIGRATION 0018] Adding email_campaign_paused column", file=sys.stderr, flush=True)
        op.add_column('workspace_settings', sa.Column('email_campaign_paused', sa.Integer(), nullable=False, server_default='1'))
        columns_added.append('email_campaign_paused')
    if 'email_budget_warning' not in existing_columns:
        print("[MIGRATION 0018] Adding email_budget_warning column", file=sys.stderr, flush=True)
        op.add_column('workspace_settings', sa.Column('email_budget_warning', sa.Integer(), nullable=False, server_default='1'))
        columns_added.append('email_budget_warning')
    if 'email_compliance_alert' not in existing_columns:
        print("[MIGRATION 0018] Adding email_compliance_alert column", file=sys.stderr, flush=True)
        op.add_column('workspace_settings', sa.Column('email_compliance_alert', sa.Integer(), nullable=False, server_default='1'))
        columns_added.append('email_compliance_alert')
    
    print(f"[MIGRATION 0018] Added {len(columns_added)} columns: {columns_added}", file=sys.stderr, flush=True)
    
    # Verify columns were added
    try:
        final_columns = [col['name'] for col in inspector.get_columns('workspace_settings')]
        print(f"[MIGRATION 0018] Final columns: {final_columns}", file=sys.stderr, flush=True)
        for col in columns_added:
            if col not in final_columns:
                print(f"⚠ [MIGRATION 0018] WARNING: Column {col} was not added successfully!", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"⚠ [MIGRATION 0018] Error verifying columns: {e}", file=sys.stderr, flush=True)


def downgrade() -> None:
    op.drop_column('workspace_settings', 'email_compliance_alert')
    op.drop_column('workspace_settings', 'email_budget_warning')
    op.drop_column('workspace_settings', 'email_campaign_paused')
    op.drop_column('workspace_settings', 'email_campaign_started')
    op.drop_column('workspace_settings', 'email_notifications_enabled')

