/** TanStack Query hooks for settings */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getWorkspaceGeneral,
  updateWorkspaceGeneral,
  uploadWorkspaceLogo,
  getWorkspaceIntegrations,
  updateWorkspaceIntegrations,
  getUserPreferencesUI,
  updateUserPreferencesUI,
  getEffectiveSettings,
} from './api'
import type {
  WorkspaceGeneralUpdate,
  WorkspaceIntegrationsUpdate,
  UserPreferencesUIUpdate,
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

// User Preferences

export function useUserPreferencesUI() {
  return useQuery({
    queryKey: ['settings', 'preferences', 'ui'],
    queryFn: getUserPreferencesUI,
  })
}

export function useUpdateUserPreferencesUI() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateUserPreferencesUI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'preferences', 'ui'] })
      queryClient.invalidateQueries({ queryKey: ['settings', 'effective'] })
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
