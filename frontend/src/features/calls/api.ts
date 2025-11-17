import { api } from '@/shared/api/client'

export interface Call {
  id: number
  created_at: string
  direction: 'inbound' | 'outbound'
  provider: string
  to: string
  from: string
  provider_call_id: string | null
  status: string
  audio_url: string | null
  country_iso: string | null
}

export interface CallDetail extends Call {
  updated_at: string
  raw_response: string | null
  disposition: string | null
  disposition_note: string | null
  audio_urls: string[]
}

export interface CallSegment {
  id: number
  call_id: number
  start_time_ms: number
  end_time_ms: number
  speaker: 'agent' | 'user'
  text: string
  created_at: string
}

export interface CallsFilters {
  status?: string
  direction?: 'inbound' | 'outbound'
  created_gte?: string
  created_lte?: string
  limit?: number
  offset?: number
}

export async function fetchCalls(filters?: CallsFilters): Promise<Call[]> {
  const { data } = await api.get<Call[]>('/calls', { params: filters })
  return Array.isArray(data) ? data : []
}

export async function fetchLiveCalls(hours: number = 6): Promise<Call[]> {
  const { data } = await api.get<Call[]>('/calls/live', { params: { hours } })
  return Array.isArray(data) ? data : []
}

export async function fetchCall(id: number): Promise<CallDetail> {
  const { data } = await api.get<CallDetail>(`/calls/${id}`)
  return data
}

export async function fetchCallSegments(callId: number): Promise<CallSegment[]> {
  const { data } = await api.get<CallSegment[]>(`/calls/${callId}/segments`)
  return Array.isArray(data) ? data : []
}

export async function updateCallDisposition(callId: number, outcome: string, note?: string): Promise<{ ok: boolean }> {
  const { data } = await api.post(`/calls/${callId}/disposition`, { outcome, note })
  return data
}

