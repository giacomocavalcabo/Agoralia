import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useIsDemo } from './useDemoData';
import { useAuth } from './useAuth';

export const qk = {
  list: (params) => ['kb:list', params],
  detail: (id) => ['kb:detail', id],
  imports: (jobId) => ['kb:import', jobId],
  assignments: ['kb:assignments']
};

function haltOnAuthOrDemo() {
  const { user, workspace } = useAuth?.() ?? {};
  const isDemo = useIsDemo?.() ?? false;
  return { isAuthed: !!user?.id, isDemo, workspaceId: workspace?.id };
}

export function useKbList(params = {}) {
  const { isAuthed, isDemo, workspaceId } = haltOnAuthOrDemo();
  return useQuery({ 
    queryKey: qk.list(params), 
    enabled: isAuthed && !isDemo && !!workspaceId,            // ❗ non chiamare l'API se non authed, demo, o senza workspace
    queryFn: async () => {
      try {
        const r = await api.get('/kb', { 
          params: { ...params, workspace_id: workspaceId }
        });
        return r.data || { items: [] };
      } catch (e) {
        // 401/422 → torna array vuoto, gestiamo a livello UI
        if (import.meta.env.DEV) console.warn('[KB] list fallback due to error', e);
        return { items: [] };
      }
    },
    staleTime: 30_000,
  });
}

export function useKbDetail(id) {
  const { isAuthed, isDemo, workspaceId } = haltOnAuthOrDemo();
  return useQuery({ 
    enabled: !!id && isAuthed && !isDemo && !!workspaceId, 
    queryKey: qk.detail(id), 
    queryFn: async () => {
      try {
        const r = await api.get(`/kb/${id}`, {
          params: { workspace_id: workspaceId }
        });
        return r.data || null;
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[KB] detail fallback due to error', e);
        return null;
      }
    },
    staleTime: 30_000,
  });
}

export function useCreateKb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/kb', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.list({}) })
  });
}

export function useUpdateKb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/kb/${id}`, payload),
    onSuccess: (data, { id }) => {
      qc.invalidateQueries({ queryKey: qk.detail(id) });
      qc.invalidateQueries({ queryKey: qk.list({}) });
    }
  });
}

export function useImportJob(jobId) {
  return useQuery({
    enabled: !!jobId,
    refetchInterval: (data) => {
      if (!data?.status) return false;
      // Stop polling quando il job è in uno stato finale
      return ['completed', 'failed', 'canceled', 'committed'].includes(data.status) ? false : 2000;
    },
    refetchIntervalInBackground: false, // Solo quando la tab è attiva
    queryKey: qk.imports(jobId),
    queryFn: () => api.get(`/kb/import/${jobId}`),
    retry: (failureCount, error) => {
      // Non riprovare su errori 4xx
      if (error?.status >= 400 && error?.status < 500) return false;
      return failureCount < 3;
    }
  });
}

export function useStartImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/kb/import', payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['kb:imports'] });
      // Invalida anche la lista KB per aggiornare i progress
      qc.invalidateQueries({ queryKey: qk.list({}) });
    },
    onError: (error) => {
      if (import.meta.env.DEV) {
        console.error('Import start failed:', error);
      }
    }
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, payload }) => api.post(`/kb/import/${jobId}/commit`, payload),
    onSuccess: (data, { jobId }) => {
      qc.invalidateQueries({ queryKey: qk.imports(jobId) });
      qc.invalidateQueries({ queryKey: ['kb:imports'] });
      qc.invalidateQueries({ queryKey: qk.list({}) });
    },
    onError: (error) => {
      if (import.meta.env.DEV) {
        console.error('Import commit failed:', error);
      }
    }
  });
}

export function useCancelImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId }) => api.post(`/kb/import/${jobId}/cancel`),
    onSuccess: (data, { jobId }) => {
      qc.invalidateQueries({ queryKey: qk.imports(jobId) });
      qc.invalidateQueries({ queryKey: ['kb:imports'] });
    },
    onError: (error) => {
      console.error('Import cancel failed:', error);
    }
  });
}

export function useAssignments() {
  return useQuery({ 
    queryKey: qk.assignments, 
    queryFn: () => api.get('/kb/assignments') 
  });
}

export function useAssignKb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/kb/assign', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.assignments })
  });
}
