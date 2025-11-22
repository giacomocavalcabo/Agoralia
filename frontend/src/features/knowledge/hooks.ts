import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchKnowledgeBases, fetchKnowledgeBase, createKnowledgeBase, syncKnowledgeBase, deleteKnowledgeBase, updateKnowledgeBase, addKbSources, deleteKbSource, type KbCreate, type KbUpdate, type AddSourcesRequest } from './api'

export function useKnowledgeBases() {
  return useQuery({
    queryKey: ['kbs'],
    queryFn: fetchKnowledgeBases,
  })
}

export function useKnowledgeBase(kbId: number | null) {
  return useQuery({
    queryKey: ['kbs', kbId],
    queryFn: () => fetchKnowledgeBase(kbId!),
    enabled: kbId !== null,
  })
}

export function useCreateKnowledgeBase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: KbCreate) => createKnowledgeBase(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kbs'] })
    },
  })
}

export function useUpdateKnowledgeBase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, payload }: { kbId: number; payload: KbUpdate }) => updateKnowledgeBase(kbId, payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['kbs'] })
      qc.invalidateQueries({ queryKey: ['kbs', variables.kbId] })
    },
  })
}

export function useAddKbSources() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, payload }: { kbId: number; payload: AddSourcesRequest }) => addKbSources(kbId, payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['kbs'] })
      qc.invalidateQueries({ queryKey: ['kbs', variables.kbId] })
    },
  })
}

export function useDeleteKbSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, sourceId }: { kbId: number; sourceId: string }) => deleteKbSource(kbId, sourceId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['kbs'] })
      qc.invalidateQueries({ queryKey: ['kbs', variables.kbId] })
    },
  })
}

export function useSyncKnowledgeBase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, force }: { kbId: number; force?: boolean }) => syncKnowledgeBase(kbId, force),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kbs'] })
    },
  })
}

export function useDeleteKnowledgeBase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (kbId: number) => deleteKnowledgeBase(kbId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kbs'] })
    },
  })
}

