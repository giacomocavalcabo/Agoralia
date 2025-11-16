import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchKnowledgeBases, createKnowledgeBase, syncKnowledgeBase, deleteKnowledgeBase, type KbCreate } from './api'

export function useKnowledgeBases() {
  return useQuery({
    queryKey: ['kbs'],
    queryFn: fetchKnowledgeBases,
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

