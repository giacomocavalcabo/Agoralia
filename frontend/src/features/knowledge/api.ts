import { api } from '@/shared/api/client'

export interface KnowledgeBase {
  id: number
  lang: string | null
  scope: string | null
  retell_kb_id: string | null
  synced: boolean
}

export interface KbCreate {
  lang?: string
  scope?: string
}

export async function fetchKnowledgeBases(): Promise<KnowledgeBase[]> {
  const { data } = await api.get<KnowledgeBase[]>('/kbs')
  return Array.isArray(data) ? data : []
}

export async function createKnowledgeBase(payload: KbCreate): Promise<{ ok: boolean; id: number }> {
  const { data } = await api.post('/kbs', payload)
  return data
}

export async function syncKnowledgeBase(kbId: number, force?: boolean): Promise<{ ok: boolean; kb_id: number; retell_kb_id: string; message: string }> {
  const { data } = await api.post(`/kbs/${kbId}/sync`, null, { params: { force: force || false } })
  return data
}

export async function deleteKnowledgeBase(kbId: number): Promise<{ ok: boolean }> {
  const { data } = await api.delete(`/kbs/${kbId}`)
  return data
}

