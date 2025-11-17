/** TypeScript types for settings */

export interface WorkspaceGeneral {
  workspace_name: string | null
  timezone: string | null
  brand_logo_url: string | null
  brand_color: string | null
}

export interface WorkspaceGeneralUpdate {
  workspace_name?: string
  timezone?: string
  brand_logo_url?: string
  brand_color?: string
}

export interface WorkspaceIntegrations {
  retell_api_key_set: boolean
  retell_webhook_secret_set: boolean
}

export interface WorkspaceIntegrationsUpdate {
  retell_api_key?: string
  retell_webhook_secret?: string
}

export interface UserPreferencesUI {
  theme: string
  ui_locale: string | null
  date_format: string | null
  time_format: string | null
  timezone: string | null
}

export interface UserPreferencesUIUpdate {
  theme?: string
  ui_locale?: string
  date_format?: string
  time_format?: string
  timezone?: string
}

export interface EffectiveSettings {
  timezone: string
  locale: string
  date_format: string
  time_format: string
  theme: string
  workspace_name: string | null
  brand_color: string | null
}

