/** API functions for settings */
import { api } from '@/shared/api/client'
import type {
  WorkspaceGeneral,
  WorkspaceGeneralUpdate,
  WorkspaceIntegrations,
  WorkspaceIntegrationsUpdate,
  UserPreferencesUI,
  UserPreferencesUIUpdate,
  EffectiveSettings,
} from './types'

// Workspace Settings

export async function getWorkspaceGeneral(): Promise<WorkspaceGeneral> {
  const { data } = await api.get<WorkspaceGeneral>('/settings/workspace/general')
  return data
}

export async function updateWorkspaceGeneral(
  updates: WorkspaceGeneralUpdate
): Promise<WorkspaceGeneral> {
  const { data } = await api.patch<WorkspaceGeneral>('/settings/workspace/general', updates)
  return data
}

export async function uploadWorkspaceLogo(file: File): Promise<WorkspaceGeneral> {
  const formData = new FormData()
  formData.append('file', file)
  
  const { data } = await api.post<WorkspaceGeneral>('/settings/workspace/general/logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export async function getWorkspaceIntegrations(): Promise<WorkspaceIntegrations> {
  const { data } = await api.get<WorkspaceIntegrations>('/settings/workspace/integrations')
  return data
}

export async function updateWorkspaceIntegrations(
  updates: WorkspaceIntegrationsUpdate
): Promise<WorkspaceIntegrations> {
  const { data } = await api.patch<WorkspaceIntegrations>('/settings/workspace/integrations', updates)
  return data
}

// User Preferences

export async function getUserPreferencesUI(): Promise<UserPreferencesUI> {
  const { data } = await api.get<UserPreferencesUI>('/settings/preferences/ui')
  return data
}

export async function updateUserPreferencesUI(
  updates: UserPreferencesUIUpdate
): Promise<UserPreferencesUI> {
  const { data } = await api.patch<UserPreferencesUI>('/settings/preferences/ui', updates)
  return data
}

// Effective Settings

export async function getEffectiveSettings(): Promise<EffectiveSettings> {
  const { data } = await api.get<EffectiveSettings>('/settings/effective')
  return data
}
