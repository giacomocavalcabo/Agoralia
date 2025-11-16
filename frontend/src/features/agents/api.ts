import { api } from '@/shared/api/client'

export interface Agent {
  id: number
  name: string
  lang: string | null
  voice_id: string | null
  retell_agent_id: string | null
}

export interface AgentCreate {
  name: string
  lang?: string
  voice_id?: string
}

export interface AgentUpdate {
  name?: string
  lang?: string
  voice_id?: string
}

export async function fetchAgents(): Promise<Agent[]> {
  const { data } = await api.get<Agent[]>('/agents')
  return Array.isArray(data) ? data : []
}

export async function fetchAgent(id: number): Promise<Agent> {
  const { data } = await api.get<Agent>(`/agents/${id}`)
  return data
}

export async function createAgent(payload: AgentCreate): Promise<{ ok: boolean; id: number; name: string; retell_agent_id: string | null; retell_created: boolean }> {
  const { data } = await api.post('/agents', payload)
  return data
}

export async function updateAgent(id: number, payload: AgentUpdate): Promise<{ ok: boolean; retell_updated: boolean }> {
  const { data } = await api.patch(`/agents/${id}`, payload)
  return data
}

export async function deleteAgent(id: number): Promise<{ ok: boolean; retell_deleted: boolean }> {
  const { data } = await api.delete(`/agents/${id}`)
  return data
}

