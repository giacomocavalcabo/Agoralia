import { api } from '@/shared/api/client'

export interface KnowledgeBaseSource {
  type: 'document' | 'text' | 'url'
  source_id?: string
  filename?: string
  file_url?: string
  file_size?: number
  title?: string
  content_url?: string
  url?: string
}

export interface KnowledgeBase {
  id: number
  tenant_id: number | null
  name: string | null
  lang: string | null
  scope: string | null
  retell_kb_id: string | null
  status: 'in_progress' | 'complete' | 'error' | null
  knowledge_base_sources: KnowledgeBaseSource[] | null
  enable_auto_refresh: boolean | null
  last_refreshed_timestamp: number | null
  created_by_user_id: number | null
  created_by_user_name: string | null
  created_at: string | null
  updated_at: string | null
  synced: boolean
}

export interface KbTextEntry {
  title: string
  text: string
}

export interface KbCreate {
  name: string
  lang?: string
  scope?: string
  knowledge_base_texts?: KbTextEntry[]
  knowledge_base_urls?: string[]
  enable_auto_refresh?: boolean
}

export async function fetchKnowledgeBases(): Promise<KnowledgeBase[]> {
  const { data } = await api.get<KnowledgeBase[]>('/kbs')
  return Array.isArray(data) ? data : []
}

export async function fetchKnowledgeBase(kbId: number): Promise<KnowledgeBase> {
  const { data } = await api.get<KnowledgeBase>(`/kbs/${kbId}`)
  return data
}

export async function createKnowledgeBase(payload: KbCreate): Promise<{ ok: boolean; id: number; retell_kb_id?: string; status?: string; name?: string }> {
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

export interface KbUpdate {
  name?: string
  lang?: string
  scope?: string
  enable_auto_refresh?: boolean
}

export async function updateKnowledgeBase(kbId: number, payload: KbUpdate): Promise<{ ok: boolean }> {
  const { data } = await api.patch(`/kbs/${kbId}`, payload)
  return data
}

export interface AddSourcesRequest {
  knowledge_base_texts?: KbTextEntry[]
  knowledge_base_urls?: string[]
}

export async function addKbSources(kbId: number, payload: AddSourcesRequest): Promise<{ ok: boolean }> {
  const { data } = await api.post(`/kbs/${kbId}/sources`, payload)
  return data
}

export async function deleteKbSource(kbId: number, sourceId: string): Promise<{ ok: boolean }> {
  const { data } = await api.delete(`/kbs/${kbId}/sources/${sourceId}`)
  return data
}

