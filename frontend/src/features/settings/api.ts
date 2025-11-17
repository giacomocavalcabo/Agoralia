/** API functions for settings */
import { api } from '@/shared/api/client'
import type {
  WorkspaceGeneral,
  WorkspaceGeneralUpdate,
  WorkspaceNotifications,
  WorkspaceNotificationsUpdate,
  WorkspaceTelephony,
  WorkspaceTelephonyUpdate,
  WorkspaceBudget,
  WorkspaceBudgetUpdate,
  WorkspaceCompliance,
  WorkspaceComplianceUpdate,
  WorkspaceQuietHours,
  WorkspaceQuietHoursUpdate,
  WorkspaceIntegrations,
  WorkspaceIntegrationsUpdate,
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

export async function getWorkspaceNotifications(): Promise<WorkspaceNotifications> {
  const { data } = await api.get<WorkspaceNotifications>('/settings/workspace/notifications')
  return data
}

export async function updateWorkspaceNotifications(
  updates: WorkspaceNotificationsUpdate
): Promise<WorkspaceNotifications> {
  const { data } = await api.patch<WorkspaceNotifications>('/settings/workspace/notifications', updates)
  return data
}

export async function getWorkspaceTelephony(): Promise<WorkspaceTelephony> {
  const { data } = await api.get<WorkspaceTelephony>('/settings/workspace/telephony')
  return data
}

export async function updateWorkspaceTelephony(
  updates: WorkspaceTelephonyUpdate
): Promise<WorkspaceTelephony> {
  const { data } = await api.patch<WorkspaceTelephony>('/settings/workspace/telephony', updates)
  return data
}

export async function getWorkspaceBudget(): Promise<WorkspaceBudget> {
  const { data } = await api.get<WorkspaceBudget>('/settings/workspace/budget')
  return data
}

export async function updateWorkspaceBudget(
  updates: WorkspaceBudgetUpdate
): Promise<WorkspaceBudget> {
  const { data } = await api.patch<WorkspaceBudget>('/settings/workspace/budget', updates)
  return data
}

export async function getWorkspaceCompliance(): Promise<WorkspaceCompliance> {
  const { data } = await api.get<WorkspaceCompliance>('/settings/workspace/compliance')
  return data
}

export async function updateWorkspaceCompliance(
  updates: WorkspaceComplianceUpdate
): Promise<WorkspaceCompliance> {
  const { data } = await api.patch<WorkspaceCompliance>('/settings/workspace/compliance', updates)
  return data
}

export async function getWorkspaceQuietHours(): Promise<WorkspaceQuietHours> {
  const { data } = await api.get<WorkspaceQuietHours>('/settings/workspace/quiet-hours')
  return data
}

export async function updateWorkspaceQuietHours(
  updates: WorkspaceQuietHoursUpdate
): Promise<WorkspaceQuietHours> {
  const { data } = await api.patch<WorkspaceQuietHours>('/settings/workspace/quiet-hours', updates)
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

// Effective Settings

export async function getEffectiveSettings(): Promise<EffectiveSettings> {
  const { data } = await api.get<EffectiveSettings>('/settings/effective')
  return data
}
