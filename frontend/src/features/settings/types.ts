/** TypeScript types for settings */

// Workspace Settings

export interface WorkspaceGeneral {
  workspace_name: string | null
  timezone: string | null
  brand_logo_url: string | null
}

export interface WorkspaceGeneralUpdate {
  workspace_name?: string
  timezone?: string
  brand_logo_url?: string
}

export interface WorkspaceNotifications {
  email_notifications_enabled: boolean
  email_campaign_started: boolean
  email_campaign_paused: boolean
  email_budget_warning: boolean
  email_compliance_alert: boolean
}

export interface WorkspaceNotificationsUpdate {
  email_notifications_enabled?: boolean
  email_campaign_started?: boolean
  email_campaign_paused?: boolean
  email_budget_warning?: boolean
  email_compliance_alert?: boolean
}

export interface WorkspaceTelephony {
  default_agent_id: number | null
  default_from_number: string | null
  default_spacing_ms: number
}

export interface WorkspaceTelephonyUpdate {
  default_agent_id?: number | null
  default_from_number?: string | null
  default_spacing_ms?: number
}

export interface WorkspaceBudget {
  budget_monthly_cents: number | null
  budget_warn_percent: number
  budget_stop_enabled: boolean
}

export interface WorkspaceBudgetUpdate {
  budget_monthly_cents?: number | null
  budget_warn_percent?: number
  budget_stop_enabled?: boolean
}

export interface WorkspaceCompliance {
  require_legal_review: boolean
  override_country_rules_enabled: boolean
}

export interface WorkspaceComplianceUpdate {
  require_legal_review?: boolean
  override_country_rules_enabled?: boolean
}

export interface WorkspaceQuietHours {
  quiet_hours_enabled: boolean
  quiet_hours_weekdays: string | null
  quiet_hours_saturday: string | null
  quiet_hours_sunday: string | null
  quiet_hours_timezone: string | null
}

export interface WorkspaceQuietHoursUpdate {
  quiet_hours_enabled?: boolean
  quiet_hours_weekdays?: string | null
  quiet_hours_saturday?: string | null
  quiet_hours_sunday?: string | null
  quiet_hours_timezone?: string | null
}

export interface WorkspaceIntegrations {
  retell_api_key_set: boolean
  retell_webhook_secret_set: boolean
}

export interface WorkspaceIntegrationsUpdate {
  retell_api_key?: string | null
  retell_webhook_secret?: string | null
}

// Effective Settings

export interface EffectiveSettings {
  timezone: string
  locale: string
  date_format: string
  time_format: string
  theme: string
  workspace_name: string | null
  brand_logo_url: string | null
}
