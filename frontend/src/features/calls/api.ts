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

// RetellAI Call interface based on their API response
export interface RetellCall {
  call_id: string
  session_id?: string
  start_timestamp?: number
  end_timestamp?: number
  duration?: number
  channel_type?: string
  cost?: number
  call_status?: string
  end_reason?: string
  user_sentiment?: string
  from_number?: string
  to_number?: string
  direction?: 'inbound' | 'outbound'
  call_successful?: boolean
  end_to_end_latency_ms?: number
  agent_id?: string
}

export interface RetellCallsResponse {
  calls?: RetellCall[]
  pagination_key?: string
  total_calls?: number
}

export interface RetellCallsFilters {
  filter_criteria?: {
    agent_id?: string[]
    call_status?: string[]
    call_type?: string[]
    direction?: string[]
    user_sentiment?: string[]
    call_successful?: boolean[]
    start_timestamp?: {
      upper_threshold?: number
      lower_threshold?: number
    }
  }
  sort_order?: 'ascending' | 'descending'
  limit?: number
  pagination_key?: string
}

export async function fetchCalls(filters?: CallsFilters): Promise<Call[]> {
  const { data } = await api.get<Call[]>('/calls', { params: filters })
  return Array.isArray(data) ? data : []
}

export async function fetchRetellCalls(filters?: RetellCallsFilters): Promise<RetellCallsResponse> {
  const { data } = await api.post<RetellCallsResponse>('/retell/calls/list', filters || {})
  return data
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

