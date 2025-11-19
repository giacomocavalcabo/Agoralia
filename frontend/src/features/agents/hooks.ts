import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  fetchAgents, 
  fetchRetellAgents,
  fetchAgent, 
  getRetellAgent,
  createAgent, 
  createAgentFull,
  updateAgent, 
  deleteAgent,
  deleteRetellAgent,
  testAgentCall,
  type AgentCreate, 
  type AgentCreateFull,
  type AgentUpdate,
  type AgentTestCallRequest
} from './api'

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  })
}

export function useRetellAgents(limit?: number, pagination_key?: string, pagination_key_version?: number) {
  return useQuery({
    queryKey: ['retell-agents', limit, pagination_key, pagination_key_version],
    queryFn: () => fetchRetellAgents(limit, pagination_key, pagination_key_version),
  })
}

export function useAgent(id: number | null) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => fetchAgent(id!),
    enabled: !!id,
  })
}

export function useRetellAgent(agentId: string | null, version?: number) {
  return useQuery({
    queryKey: ['retell-agents', agentId, version],
    queryFn: () => getRetellAgent(agentId!, version),
    enabled: !!agentId,
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

export function useCreateAgentFull() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AgentCreateFull) => createAgentFull(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['retell-agents'] })
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

export function useDeleteRetellAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (agentId: string) => deleteRetellAgent(agentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retell-agents'] })
      qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useTestAgentCall() {
  return useMutation({
    mutationFn: ({ agentId, payload }: { agentId: string; payload: AgentTestCallRequest }) => 
      testAgentCall(agentId, payload),
  })
}

