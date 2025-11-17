"""Workspace settings service functions (race-safe)"""
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, ProgrammingError, InternalError
from sqlalchemy import inspect, text
from config.database import engine
from models.workspace_settings import WorkspaceSettings
from utils.encryption import encrypt_value, decrypt_value


def get_workspace_settings(tenant_id: int, session: Optional[Session] = None) -> WorkspaceSettings:
    """
    Get workspace settings for a tenant, create if not exists (race-safe)
    
    Args:
        tenant_id: Logical tenant ID (not FK)
        session: Optional session (creates new if not provided)
    
    Returns:
        WorkspaceSettings instance
    """
    if session:
        return _get_or_create_settings(tenant_id, session)
    
    with Session(engine) as session:
        return _get_or_create_settings(tenant_id, session)


def _get_or_create_settings(tenant_id: int, session: Session) -> WorkspaceSettings:
    """Internal helper: get or create settings (race-safe)"""
    # Check if notification columns exist BEFORE trying ORM query
    inspector = inspect(session.bind)
    table_columns = []
    if 'workspace_settings' in inspector.get_table_names():
        try:
            table_columns = [col['name'] for col in inspector.get_columns('workspace_settings')]
        except Exception:
            pass  # If inspect fails, we'll try ORM query anyway
    
    has_notification_columns = 'email_notifications_enabled' in table_columns
    
    # If notification columns don't exist, use raw SQL directly
    if not has_notification_columns:
        result = session.execute(
            text("""
                SELECT id, tenant_id, default_agent_id, default_from_number, default_spacing_ms,
                       budget_monthly_cents, budget_warn_percent, budget_stop_enabled,
                       quiet_hours_enabled, quiet_hours_weekdays, quiet_hours_saturday,
                       quiet_hours_sunday, quiet_hours_timezone,
                       require_legal_review, override_country_rules_enabled,
                       default_lang, supported_langs_json, prefer_detect_language,
                       kb_version_outbound, kb_version_inbound,
                       workspace_name, timezone, brand_logo_url, brand_color,
                       retell_api_key_encrypted, retell_webhook_secret_encrypted,
                       created_at, updated_at
                FROM workspace_settings
                WHERE tenant_id = :tid
                LIMIT 1
"""),
            {"tid": tenant_id}
        ).first()
        
        if result:
            # Create a minimal WorkspaceSettings object with available fields
            settings = WorkspaceSettings()
            settings.id = result[0]
            settings.tenant_id = result[1]
            settings.default_agent_id = result[2]
            settings.default_from_number = result[3]
            settings.default_spacing_ms = result[4] or 1000
            settings.budget_monthly_cents = result[5]
            settings.budget_warn_percent = result[6] or 80
            settings.budget_stop_enabled = result[7] or 1
            settings.quiet_hours_enabled = result[8] or 0
            settings.quiet_hours_weekdays = result[9]
            settings.quiet_hours_saturday = result[10]
            settings.quiet_hours_sunday = result[11]
            settings.quiet_hours_timezone = result[12]
            settings.require_legal_review = result[13] or 1
            settings.override_country_rules_enabled = result[14] or 0
            settings.default_lang = result[15]
            settings.supported_langs_json = result[16]
            settings.prefer_detect_language = result[17] or 0
            settings.kb_version_outbound = result[18] or 0
            settings.kb_version_inbound = result[19] or 0
            settings.workspace_name = result[20]
            settings.timezone = result[21]
            settings.brand_logo_url = result[22]
            settings.brand_color = result[23]
            settings.retell_api_key_encrypted = result[24]
            settings.retell_webhook_secret_encrypted = result[25]
            settings.created_at = result[26]
            settings.updated_at = result[27]
            # Notification fields will be None (use defaults in routes)
            settings.email_notifications_enabled = None
            settings.email_campaign_started = None
            settings.email_campaign_paused = None
            settings.email_budget_warning = None
            settings.email_compliance_alert = None
            return settings
    else:
        # Notification columns exist - include them in query
        result = session.execute(
            text("""
                SELECT id, tenant_id, default_agent_id, default_from_number, default_spacing_ms,
                       budget_monthly_cents, budget_warn_percent, budget_stop_enabled,
                       quiet_hours_enabled, quiet_hours_weekdays, quiet_hours_saturday,
                       quiet_hours_sunday, quiet_hours_timezone,
                       require_legal_review, override_country_rules_enabled,
                       default_lang, supported_langs_json, prefer_detect_language,
                       kb_version_outbound, kb_version_inbound,
                       workspace_name, timezone, brand_logo_url, brand_color,
                       retell_api_key_encrypted, retell_webhook_secret_encrypted,
                       email_notifications_enabled, email_campaign_started,
                       email_campaign_paused, email_budget_warning, email_compliance_alert,
                       created_at, updated_at
                FROM workspace_settings
                WHERE tenant_id = :tid
                LIMIT 1
"""),
            {"tid": tenant_id}
        ).first()
        
        if result:
            # Create WorkspaceSettings object with all fields including notifications
            settings = WorkspaceSettings()
            settings.id = result[0]
            settings.tenant_id = result[1]
            settings.default_agent_id = result[2]
            settings.default_from_number = result[3]
            settings.default_spacing_ms = result[4] or 1000
            settings.budget_monthly_cents = result[5]
            settings.budget_warn_percent = result[6] or 80
            settings.budget_stop_enabled = result[7] or 1
            settings.quiet_hours_enabled = result[8] or 0
            settings.quiet_hours_weekdays = result[9]
            settings.quiet_hours_saturday = result[10]
            settings.quiet_hours_sunday = result[11]
            settings.quiet_hours_timezone = result[12]
            settings.require_legal_review = result[13] or 1
            settings.override_country_rules_enabled = result[14] or 0
            settings.default_lang = result[15]
            settings.supported_langs_json = result[16]
            settings.prefer_detect_language = result[17] or 0
            settings.kb_version_outbound = result[18] or 0
            settings.kb_version_inbound = result[19] or 0
            settings.workspace_name = result[20]
            settings.timezone = result[21]
            settings.brand_logo_url = result[22]
            settings.brand_color = result[23]
            settings.retell_api_key_encrypted = result[24]
            settings.retell_webhook_secret_encrypted = result[25]
            # Notification fields (with defaults if NULL)
            settings.email_notifications_enabled = result[26] if result[26] is not None else 1
            settings.email_campaign_started = result[27] if result[27] is not None else 1
            settings.email_campaign_paused = result[28] if result[28] is not None else 1
            settings.email_budget_warning = result[29] if result[29] is not None else 1
            settings.email_compliance_alert = result[30] if result[30] is not None else 1
            settings.created_at = result[31]
            settings.updated_at = result[32]
            return settings
    
    # Try ORM query (notification columns exist or we couldn't check)
    try:
        settings = session.query(WorkspaceSettings).filter_by(tenant_id=tenant_id).first()
        if settings:
            # Ensure notification fields have defaults if None
            if has_notification_columns:
                if getattr(settings, 'email_notifications_enabled', None) is None:
                    settings.email_notifications_enabled = 1
                if getattr(settings, 'email_campaign_started', None) is None:
                    settings.email_campaign_started = 1
                if getattr(settings, 'email_campaign_paused', None) is None:
                    settings.email_campaign_paused = 1
                if getattr(settings, 'email_budget_warning', None) is None:
                    settings.email_budget_warning = 1
                if getattr(settings, 'email_compliance_alert', None) is None:
                    settings.email_compliance_alert = 1
            return settings
    except (ProgrammingError, InternalError) as e:
        # Column doesn't exist yet or transaction aborted - rollback and use raw SQL
        session.rollback()
        if 'email_notifications_enabled' in str(e) or 'does not exist' in str(e) or 'transaction is aborted' in str(e):
            # Query without notification columns
            result = session.execute(
                text("""
                    SELECT id, tenant_id, default_agent_id, default_from_number, default_spacing_ms,
                           budget_monthly_cents, budget_warn_percent, budget_stop_enabled,
                           quiet_hours_enabled, quiet_hours_weekdays, quiet_hours_saturday,
                           quiet_hours_sunday, quiet_hours_timezone,
                           require_legal_review, override_country_rules_enabled,
                           default_lang, supported_langs_json, prefer_detect_language,
                           kb_version_outbound, kb_version_inbound,
                           workspace_name, timezone, brand_logo_url, brand_color,
                           retell_api_key_encrypted, retell_webhook_secret_encrypted,
                           created_at, updated_at
                    FROM workspace_settings
                    WHERE tenant_id = :tid
                    LIMIT 1
                """),
                {"tid": tenant_id}
            ).first()
            
            if result:
                # Create a minimal WorkspaceSettings object with available fields
                settings = WorkspaceSettings()
                settings.id = result[0]
                settings.tenant_id = result[1]
                settings.default_agent_id = result[2]
                settings.default_from_number = result[3]
                settings.default_spacing_ms = result[4] or 1000
                settings.budget_monthly_cents = result[5]
                settings.budget_warn_percent = result[6] or 80
                settings.budget_stop_enabled = result[7] or 1
                settings.quiet_hours_enabled = result[8] or 0
                settings.quiet_hours_weekdays = result[9]
                settings.quiet_hours_saturday = result[10]
                settings.quiet_hours_sunday = result[11]
                settings.quiet_hours_timezone = result[12]
                settings.require_legal_review = result[13] or 1
                settings.override_country_rules_enabled = result[14] or 0
                settings.default_lang = result[15]
                settings.supported_langs_json = result[16]
                settings.prefer_detect_language = result[17] or 0
                settings.kb_version_outbound = result[18] or 0
                settings.kb_version_inbound = result[19] or 0
                settings.workspace_name = result[20]
                settings.timezone = result[21]
                settings.brand_logo_url = result[22]
                settings.brand_color = result[23]
                settings.retell_api_key_encrypted = result[24]
                settings.retell_webhook_secret_encrypted = result[25]
                settings.created_at = result[26]
                settings.updated_at = result[27]
                # Notification fields will be None (handled by getattr in routes)
                return settings
        else:
            raise
    
    # Try to create
    settings = WorkspaceSettings(tenant_id=tenant_id)
    session.add(settings)
    try:
        session.commit()
        session.refresh(settings)
        return settings
    except IntegrityError:
        # Race condition: someone else created it first
        session.rollback()
        # Re-read - check if notification columns exist first
        inspector = inspect(session.bind)
        table_columns = []
        if 'workspace_settings' in inspector.get_table_names():
            try:
                table_columns = [col['name'] for col in inspector.get_columns('workspace_settings')]
            except Exception:
                pass
        
        has_notification_columns = 'email_notifications_enabled' in table_columns
        
        if not has_notification_columns:
            # Use raw SQL
            result = session.execute(
                text("SELECT id, tenant_id FROM workspace_settings WHERE tenant_id = :tid LIMIT 1"),
                {"tid": tenant_id}
            ).first()
            if result:
                settings = WorkspaceSettings()
                settings.id = result[0]
                settings.tenant_id = result[1]
            else:
                raise RuntimeError(f"Failed to get or create workspace settings for tenant {tenant_id}")
        else:
            # Try ORM query
            try:
                settings = session.query(WorkspaceSettings).filter_by(tenant_id=tenant_id).first()
            except (ProgrammingError, InternalError):
                # If query fails, rollback and use raw SQL
                session.rollback()
                result = session.execute(
                    text("SELECT id, tenant_id FROM workspace_settings WHERE tenant_id = :tid LIMIT 1"),
                    {"tid": tenant_id}
                ).first()
                if result:
                    settings = WorkspaceSettings()
                    settings.id = result[0]
                    settings.tenant_id = result[1]
                else:
                    raise RuntimeError(f"Failed to get or create workspace settings for tenant {tenant_id}")
        
        if not settings:
            raise RuntimeError(f"Failed to get or create workspace settings for tenant {tenant_id}")
        return settings


def update_workspace_settings(
    tenant_id: int,
    updates: Dict[str, Any],
    session: Optional[Session] = None
) -> WorkspaceSettings:
    """
    Update workspace settings (partial update)
    
    Args:
        tenant_id: Logical tenant ID
        updates: Dictionary of fields to update
        session: Optional session
    
    Returns:
        Updated WorkspaceSettings instance
    """
    if session:
        return _update_settings(tenant_id, updates, session)
    
    with Session(engine) as s:
        return _update_settings(tenant_id, updates, s)


def _update_settings(tenant_id: int, updates: Dict[str, Any], session: Session) -> WorkspaceSettings:
    """Internal helper: update settings"""
    # Check if notification columns exist
    inspector = inspect(session.bind)
    table_columns = []
    if 'workspace_settings' in inspector.get_table_names():
        try:
            table_columns = [col['name'] for col in inspector.get_columns('workspace_settings')]
        except Exception:
            pass
    
    has_notification_columns = 'email_notifications_enabled' in table_columns
    
    settings = get_workspace_settings(tenant_id, session)
    
    # Check if settings object is in session (was created via ORM) or manually (raw SQL)
    is_in_session = hasattr(settings, '_sa_instance_state') and settings._sa_instance_state.session is not None
    
    # Handle encryption for sensitive fields
    if "retell_api_key" in updates:
        value = updates.pop("retell_api_key")
        if value:
            updates["retell_api_key_encrypted"] = encrypt_value(value)
        else:
            updates["retell_api_key_encrypted"] = None
    
    if "retell_webhook_secret" in updates:
        value = updates.pop("retell_webhook_secret")
        if value:
            updates["retell_webhook_secret_encrypted"] = encrypt_value(value)
        else:
            updates["retell_webhook_secret_encrypted"] = None
    
    # Filter out notification fields if columns don't exist
    updates_to_apply = {}
    for key, value in updates.items():
        # Skip notification fields if columns don't exist
        if not has_notification_columns and key in [
            'email_notifications_enabled', 'email_campaign_started', 
            'email_campaign_paused', 'email_budget_warning', 'email_compliance_alert'
        ]:
            continue  # Skip these fields if columns don't exist
        updates_to_apply[key] = value
    
    # If object is not in session (created manually with raw SQL), use raw SQL UPDATE
    if not is_in_session:
        # Use raw SQL UPDATE
        # Validate column names to prevent SQL injection
        valid_columns = {
            'default_agent_id', 'default_from_number', 'default_spacing_ms',
            'budget_monthly_cents', 'budget_warn_percent', 'budget_stop_enabled',
            'quiet_hours_enabled', 'quiet_hours_weekdays', 'quiet_hours_saturday',
            'quiet_hours_sunday', 'quiet_hours_timezone',
            'require_legal_review', 'override_country_rules_enabled',
            'default_lang', 'supported_langs_json', 'prefer_detect_language',
            'kb_version_outbound', 'kb_version_inbound',
            'workspace_name', 'timezone', 'brand_logo_url', 'brand_color',
            'retell_api_key_encrypted', 'retell_webhook_secret_encrypted',
        }
        # Add notification columns if they exist
        if has_notification_columns:
            valid_columns.update({
                'email_notifications_enabled', 'email_campaign_started',
                'email_campaign_paused', 'email_budget_warning', 'email_compliance_alert',
            })
        
        set_clauses = []
        params = {"tid": tenant_id}
        
        for key, value in updates_to_apply.items():
            # Only update valid columns
            if key not in valid_columns:
                continue
            # Use parameterized query to prevent SQL injection
            param_name = f"val_{key}"  # Use unique param name
            if value is None:
                # For None values, explicitly set to NULL
                set_clauses.append(f"{key} = NULL")
            else:
                set_clauses.append(f"{key} = :{param_name}")
                # Convert value to appropriate type
                if isinstance(value, str):
                    params[param_name] = value
                elif isinstance(value, bool):
                    params[param_name] = 1 if value else 0
                elif isinstance(value, (int, float)):
                    params[param_name] = value
                else:
                    params[param_name] = str(value) if value is not None else None
        
        if set_clauses:
            try:
                sql_query = f"""
                    UPDATE workspace_settings
                    SET {', '.join(set_clauses)}, updated_at = now()
                    WHERE tenant_id = :tid
                """
                session.execute(
                    text(sql_query),
                    params
                )
                session.commit()
                # Re-read using safe method
                return get_workspace_settings(tenant_id, session)
            except Exception as e:
                session.rollback()
                import traceback
                error_detail = f"Error in raw SQL UPDATE: {str(e)}\n{traceback.format_exc()}"
                print(f"[ERROR] {error_detail}", flush=True)
                raise
        else:
            # No updates to apply
            return settings
    
    # Object is in session, use ORM update
    # Ensure settings object is in session (merge if needed)
    if settings not in session:
        settings = session.merge(settings)
    
    # Update fields
    for key, value in updates_to_apply.items():
        # Handle None values explicitly
        if value is None:
            setattr(settings, key, None)
        else:
            setattr(settings, key, value)
    
    try:
        session.commit()
        # Only refresh if notification columns exist, otherwise refresh will fail
        if has_notification_columns:
            try:
                session.refresh(settings)
            except (ProgrammingError, InternalError):
                # If refresh fails, re-read using safe method
                session.rollback()
                settings = get_workspace_settings(tenant_id, session)
        else:
            # Re-read using safe method (raw SQL) to get updated values
            result = session.execute(
                text("""
                    SELECT id, tenant_id, default_agent_id, default_from_number, default_spacing_ms,
                           budget_monthly_cents, budget_warn_percent, budget_stop_enabled,
                           quiet_hours_enabled, quiet_hours_weekdays, quiet_hours_saturday,
                           quiet_hours_sunday, quiet_hours_timezone,
                           require_legal_review, override_country_rules_enabled,
                           default_lang, supported_langs_json, prefer_detect_language,
                           kb_version_outbound, kb_version_inbound,
                           workspace_name, timezone, brand_logo_url, brand_color,
                           retell_api_key_encrypted, retell_webhook_secret_encrypted,
                           created_at, updated_at
                    FROM workspace_settings
                    WHERE tenant_id = :tid
                    LIMIT 1
                """),
                {"tid": tenant_id}
            ).first()
            
            if result:
                # Update the settings object with fresh data
                settings.id = result[0]
                settings.tenant_id = result[1]
                settings.default_agent_id = result[2]
                settings.default_from_number = result[3]
                settings.default_spacing_ms = result[4] or 1000
                settings.budget_monthly_cents = result[5]
                settings.budget_warn_percent = result[6] or 80
                settings.budget_stop_enabled = result[7] or 1
                settings.quiet_hours_enabled = result[8] or 0
                settings.quiet_hours_weekdays = result[9]
                settings.quiet_hours_saturday = result[10]
                settings.quiet_hours_sunday = result[11]
                settings.quiet_hours_timezone = result[12]
                settings.require_legal_review = result[13] or 1
                settings.override_country_rules_enabled = result[14] or 0
                settings.default_lang = result[15]
                settings.supported_langs_json = result[16]
                settings.prefer_detect_language = result[17] or 0
                settings.kb_version_outbound = result[18] or 0
                settings.kb_version_inbound = result[19] or 0
                settings.workspace_name = result[20]
                settings.timezone = result[21]
                settings.brand_logo_url = result[22]
                settings.brand_color = result[23]
                settings.retell_api_key_encrypted = result[24]
                settings.retell_webhook_secret_encrypted = result[25]
                settings.created_at = result[26]
                settings.updated_at = result[27]
    except (ProgrammingError, InternalError) as e:
        session.rollback()
        # If commit fails due to missing columns, try raw SQL update
        if 'email_notifications_enabled' in str(e) or 'does not exist' in str(e) or 'transaction is aborted' in str(e):
            # Build UPDATE query with only existing columns
            set_clauses = []
            params = {"tid": tenant_id}
            
            for key, value in updates_to_apply.items():
                if key not in ['email_notifications_enabled', 'email_campaign_started', 
                              'email_campaign_paused', 'email_budget_warning', 'email_compliance_alert']:
                    set_clauses.append(f"{key} = :{key}")
                    params[key] = value
            
            if set_clauses:
                session.execute(
                    text(f"""
                        UPDATE workspace_settings
                        SET {', '.join(set_clauses)}, updated_at = now()
                        WHERE tenant_id = :tid
                    """),
                    params
                )
                session.commit()
                # Re-read using safe method
                settings = get_workspace_settings(tenant_id, session)
            else:
                raise
        else:
            raise
    
    return settings


def get_retell_api_key_set(tenant_id: int) -> bool:
    """Check if Retell API key is set (without decrypting)"""
    settings = get_workspace_settings(tenant_id)
    return bool(settings.retell_api_key_encrypted)


def get_retell_webhook_secret_set(tenant_id: int) -> bool:
    """Check if Retell webhook secret is set (without decrypting)"""
    settings = get_workspace_settings(tenant_id)
    return bool(settings.retell_webhook_secret_encrypted)


def decrypt_retell_api_key(tenant_id: int) -> Optional[str]:
    """Decrypt Retell API key (for internal use only)"""
    settings = get_workspace_settings(tenant_id)
    if not settings.retell_api_key_encrypted:
        return None
    return decrypt_value(settings.retell_api_key_encrypted)


def decrypt_retell_webhook_secret(tenant_id: int) -> Optional[str]:
    """Decrypt Retell webhook secret (for internal use only)"""
    settings = get_workspace_settings(tenant_id)
    if not settings.retell_webhook_secret_encrypted:
        return None
    return decrypt_value(settings.retell_webhook_secret_encrypted)

