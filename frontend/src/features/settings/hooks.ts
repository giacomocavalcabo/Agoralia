/** TanStack Query hooks for settings */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getWorkspaceGeneral,
  updateWorkspaceGeneral,
  uploadWorkspaceLogo,
  deleteWorkspaceLogo,
  getWorkspaceNotifications,
  updateWorkspaceNotifications,
  getWorkspaceTelephony,
  updateWorkspaceTelephony,
  getWorkspaceBudget,
  updateWorkspaceBudget,
  getWorkspaceCompliance,
  updateWorkspaceCompliance,
  getWorkspaceQuietHours,
  updateWorkspaceQuietHours,
  getWorkspaceIntegrations,
  updateWorkspaceIntegrations,
  getEffectiveSettings,
} from './api'
import type {
  WorkspaceGeneralUpdate,
  WorkspaceNotificationsUpdate,
  WorkspaceTelephonyUpdate,
  WorkspaceBudgetUpdate,
  WorkspaceComplianceUpdate,
  WorkspaceQuietHoursUpdate,
  WorkspaceIntegrationsUpdate,
} from './types'

// Workspace Settings

export function useWorkspaceGeneral() {
  return useQuery({
    queryKey: ['settings', 'workspace', 'general'],
    queryFn: getWorkspaceGeneral,
  })
}

export function useUpdateWorkspaceGeneral() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateWorkspaceGeneral,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'workspace', 'general'] })
      queryClient.invalidateQueries({ queryKey: ['settings', 'effective'] })
    },
  })
}

export function useUploadWorkspaceLogo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadWorkspaceLogo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'workspace', 'general'] })
      queryClient.invalidateQueries({ queryKey: ['settings', 'effective'] })
    },
  })
}

export function useDeleteWorkspaceLogo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteWorkspaceLogo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'workspace', 'general'] })
      queryClient.invalidateQueries({ queryKey: ['settings', 'effective'] })
    },
  })
}

export function useWorkspaceNotifications() {
  return useQuery({
    queryKey: ['settings', 'workspace', 'notifications'],
    queryFn: getWorkspaceNotifications,
  })
}

export function useUpdateWorkspaceNotifications() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateWorkspaceNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'workspace', 'notifications'] })
    },
  })
}

export function useWorkspaceTelephony() {
  return useQuery({
    queryKey: ['settings', 'workspace', 'telephony'],
    queryFn: getWorkspaceTelephony,
  })
}

export function useUpdateWorkspaceTelephony() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateWorkspaceTelephony,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'workspace', 'telephony'] })
    },
  })
}

export function useWorkspaceBudget() {
  return useQuery({
    queryKey: ['settings', 'workspace', 'budget'],
    queryFn: getWorkspaceBudget,
  })
}

export function useUpdateWorkspaceBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateWorkspaceBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'workspace', 'budget'] })
    },
  })
}

export function useWorkspaceCompliance() {
  return useQuery({
    queryKey: ['settings', 'workspace', 'compliance'],
    queryFn: getWorkspaceCompliance,
  })
}

export function useUpdateWorkspaceCompliance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateWorkspaceCompliance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'workspace', 'compliance'] })
    },
  })
}

export function useWorkspaceQuietHours() {
  return useQuery({
    queryKey: ['settings', 'workspace', 'quiet-hours'],
    queryFn: getWorkspaceQuietHours,
  })
}

export function useUpdateWorkspaceQuietHours() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateWorkspaceQuietHours,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'workspace', 'quiet-hours'] })
    },
  })
}

export function useWorkspaceIntegrations() {
  return useQuery({
    queryKey: ['settings', 'workspace', 'integrations'],
    queryFn: getWorkspaceIntegrations,
  })
}

export function useUpdateWorkspaceIntegrations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateWorkspaceIntegrations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'workspace', 'integrations'] })
    },
  })
}

// Effective Settings

export function useEffectiveSettings() {
  return useQuery({
    queryKey: ['settings', 'effective'],
    queryFn: getEffectiveSettings,
  })
}
