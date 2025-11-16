import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAgents, fetchAgent, createAgent, updateAgent, deleteAgent, type AgentCreate, type AgentUpdate } from './api'

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  })
}

export function useAgent(id: number | null) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => fetchAgent(id!),
    enabled: !!id,
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AgentCreate) => createAgent(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useUpdateAgent(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AgentUpdate) => updateAgent(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['agents', id] })
    },
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteAgent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

