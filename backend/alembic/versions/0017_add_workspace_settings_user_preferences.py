"""Add workspace_settings and user_preferences tables

Revision ID: 0017_add_workspace_settings_user_preferences
Revises: 0016_add_retell_kb_id_to_kbs
Create Date: 2025-01-16 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '0017_add_workspace_settings_user_preferences'
down_revision: Union[str, None] = '0016_add_retell_kb_id_to_kbs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Create workspace_settings table
    if 'workspace_settings' not in inspector.get_table_names():
        op.create_table(
            'workspace_settings',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('tenant_id', sa.Integer(), nullable=False),
            
            # Operative
            sa.Column('default_agent_id', sa.String(length=128), nullable=True),
            sa.Column('default_from_number', sa.String(length=32), nullable=True),
            sa.Column('default_spacing_ms', sa.Integer(), server_default=sa.text('1000')),
            
            # Budget
            sa.Column('budget_monthly_cents', sa.Integer(), nullable=True),
            sa.Column('budget_warn_percent', sa.Integer(), server_default=sa.text('80')),
            sa.Column('budget_stop_enabled', sa.Integer(), server_default=sa.text('1')),
            
            # Quiet Hours Default
            sa.Column('quiet_hours_enabled', sa.Integer(), server_default=sa.text('0')),
            sa.Column('quiet_hours_weekdays', sa.String(length=32), nullable=True),
            sa.Column('quiet_hours_saturday', sa.String(length=32), nullable=True),
            sa.Column('quiet_hours_sunday', sa.String(length=32), nullable=True),
            sa.Column('quiet_hours_timezone', sa.String(length=64), nullable=True),
            
            # Compliance Configuration
            sa.Column('require_legal_review', sa.Integer(), server_default=sa.text('1')),
            sa.Column('override_country_rules_enabled', sa.Integer(), server_default=sa.text('0')),
            
            # Language/Agent
            sa.Column('default_lang', sa.String(length=16), nullable=True),
            sa.Column('supported_langs_json', sa.Text(), nullable=True),  # JSONB in Postgres
            sa.Column('prefer_detect_language', sa.Integer(), server_default=sa.text('0')),
            sa.Column('kb_version_outbound', sa.Integer(), server_default=sa.text('0')),
            sa.Column('kb_version_inbound', sa.Integer(), server_default=sa.text('0')),
            
            # Branding
            sa.Column('workspace_name', sa.String(length=128), nullable=True),
            sa.Column('timezone', sa.String(length=64), nullable=True),
            sa.Column('brand_logo_url', sa.Text(), nullable=True),
            sa.Column('brand_color', sa.String(length=16), nullable=True),
            
            # Integrations (encrypted)
            sa.Column('retell_api_key_encrypted', sa.Text(), nullable=True),
            sa.Column('retell_webhook_secret_encrypted', sa.Text(), nullable=True),
            
            # Metadata
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            
            # Constraints
            sa.UniqueConstraint('tenant_id', name='uq_workspace_settings_tenant_id'),
        )
        
        # Create index
        op.create_index('idx_workspace_settings_tenant_id', 'workspace_settings', ['tenant_id'])
    
    # Create user_preferences table
    if 'user_preferences' not in inspector.get_table_names():
        op.create_table(
            'user_preferences',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('tenant_id', sa.Integer(), nullable=False),  # Logical value for isolation
            
            # UI/UX
            sa.Column('theme', sa.String(length=16), server_default='system'),
            sa.Column('ui_locale', sa.String(length=16), nullable=True),
            
            # Notifications
            sa.Column('email_notifications_enabled', sa.Integer(), server_default=sa.text('1')),
            sa.Column('email_campaign_started', sa.Integer(), server_default=sa.text('1')),
            sa.Column('email_campaign_paused', sa.Integer(), server_default=sa.text('1')),
            sa.Column('email_budget_warning', sa.Integer(), server_default=sa.text('1')),
            sa.Column('email_compliance_alert', sa.Integer(), server_default=sa.text('1')),
            
            # Dashboard
            sa.Column('dashboard_layout', sa.Text(), nullable=True),  # JSONB in Postgres
            sa.Column('default_view', sa.String(length=32), nullable=True),
            
            # Table Preferences
            sa.Column('table_page_size', sa.Integer(), server_default=sa.text('50')),
            sa.Column('table_sort_preferences', sa.Text(), nullable=True),  # JSONB in Postgres
            
            # Date/Time
            sa.Column('date_format', sa.String(length=16), nullable=True),
            sa.Column('time_format', sa.String(length=8), nullable=True),
            sa.Column('timezone', sa.String(length=64), nullable=True),
            
            # Metadata
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            
            # Constraints
            sa.UniqueConstraint('user_id', name='uq_user_preferences_user_id'),
        )
        
        # Create indexes
        op.create_index('idx_user_preferences_user_id', 'user_preferences', ['user_id'])
        op.create_index('idx_user_preferences_tenant_id', 'user_preferences', ['tenant_id'])
    
    # Migrate data from old tables (if they exist)
    if 'settings' in inspector.get_table_names() and 'app_meta' in inspector.get_table_names():
        # Get all unique tenant_ids from users table
        result = conn.execute(sa.text("SELECT DISTINCT tenant_id FROM users WHERE tenant_id IS NOT NULL"))
        tenant_ids = [row[0] for row in result]
        
        for tenant_id in tenant_ids:
            # Check if workspace_settings already exists for this tenant
            existing = conn.execute(
                sa.text("SELECT id FROM workspace_settings WHERE tenant_id = :tid"),
                {"tid": tenant_id}
            ).first()
            
            if existing:
                continue  # Skip if already exists
            
            # Get old settings (first record, tenant_id might be NULL)
            old_settings = conn.execute(
                sa.text("SELECT * FROM settings ORDER BY id ASC LIMIT 1")
            ).first()
            
            # Get old app_meta (first record)
            old_meta = conn.execute(
                sa.text("SELECT * FROM app_meta ORDER BY id ASC LIMIT 1")
            ).first()
            
            # Insert into workspace_settings (include created_at and updated_at)
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            conn.execute(
                sa.text("""
                    INSERT INTO workspace_settings (
                        tenant_id,
                        default_agent_id, default_from_number, default_spacing_ms,
                        budget_monthly_cents, budget_warn_percent, budget_stop_enabled,
                        quiet_hours_enabled, quiet_hours_weekdays, quiet_hours_saturday,
                        quiet_hours_sunday, quiet_hours_timezone,
                        require_legal_review, override_country_rules_enabled,
                        default_lang, supported_langs_json, prefer_detect_language,
                        kb_version_outbound, kb_version_inbound,
                        workspace_name, timezone, brand_logo_url, brand_color,
                        created_at, updated_at
                    ) VALUES (
                        :tid,
                        :agent_id, :from_number, :spacing_ms,
                        :budget_cents, :warn_percent, :stop_enabled,
                        :qh_enabled, :qh_weekdays, :qh_saturday,
                        :qh_sunday, :qh_tz,
                        :legal_review, 0,
                        :lang, :supported_langs, :prefer_detect,
                        :kb_out, :kb_in,
                        :ws_name, :tz, :logo_url, :brand_color,
                        :created_at, :updated_at
                    )
                """),
                {
                    "tid": tenant_id,
                    "agent_id": old_settings.default_agent_id if old_settings else None,
                    "from_number": old_settings.default_from_number if old_settings else None,
                    "spacing_ms": old_settings.default_spacing_ms if old_settings else 1000,
                    "budget_cents": old_settings.budget_monthly_cents if old_settings else None,
                    "warn_percent": old_settings.budget_warn_percent if old_settings else 80,
                    "stop_enabled": old_settings.budget_stop_enabled if old_settings else 1,
                    "qh_enabled": old_settings.quiet_hours_enabled if old_settings else 0,
                    "qh_weekdays": old_settings.quiet_hours_weekdays if old_settings else None,
                    "qh_saturday": old_settings.quiet_hours_saturday if old_settings else None,
                    "qh_sunday": old_settings.quiet_hours_sunday if old_settings else None,
                    "qh_tz": old_settings.quiet_hours_timezone if old_settings else None,
                    "legal_review": old_settings.require_legal_review if old_settings else 1,
                    "lang": old_settings.default_lang if old_settings else None,
                    "supported_langs": old_settings.supported_langs_json if old_settings else None,
                    "prefer_detect": old_settings.prefer_detect_language if old_settings else 0,
                    "kb_out": old_settings.kb_version_outbound if old_settings else 0,
                    "kb_in": old_settings.kb_version_inbound if old_settings else 0,
                    "ws_name": old_meta.workspace_name if old_meta else None,
                    "tz": old_meta.timezone if old_meta else None,
                    "logo_url": old_meta.brand_logo_url if old_meta else None,
                    "brand_color": old_meta.brand_color if old_meta else None,
                    "created_at": now,
                    "updated_at": now,
                }
            )
        
        conn.commit()


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('idx_user_preferences_tenant_id', table_name='user_preferences')
    op.drop_index('idx_user_preferences_user_id', table_name='user_preferences')
    op.drop_index('idx_workspace_settings_tenant_id', table_name='workspace_settings')
    
    # Drop tables
    op.drop_table('user_preferences')
    op.drop_table('workspace_settings')

