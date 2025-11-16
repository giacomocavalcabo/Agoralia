import { api } from '@/shared/api/client'

export interface Campaign {
  id: number
  name: string
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
  agent_id: string | null
  from_number_id: number | null
  kb_id: number | null
  start_date: string | null
  end_date: string | null
  timezone: string | null
  max_calls_per_day: number | null
  budget_cents: number | null
  cost_per_call_cents: number | null
  total_cost_cents: number | null
  calls_made: number | null
  metadata: Record<string, any> | null
  quiet_hours_enabled: boolean | null
  quiet_hours_weekdays: string | null
  quiet_hours_saturday: string | null
  quiet_hours_sunday: string | null
  quiet_hours_timezone: string | null
  created_at: string
  updated_at: string
}

export interface CampaignCreate {
  name: string
  status?: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
  agent_id?: string
  from_number_id?: number
  kb_id?: number
  start_date?: string
  end_date?: string
  timezone?: string
  max_calls_per_day?: number
  budget_cents?: number
  cost_per_call_cents?: number
  metadata?: Record<string, any>
  quiet_hours_enabled?: boolean
  quiet_hours_weekdays?: string
  quiet_hours_saturday?: string
  quiet_hours_sunday?: string
  quiet_hours_timezone?: string
}

export interface CampaignUpdate {
  name?: string
  status?: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
  agent_id?: string
  from_number_id?: number
  kb_id?: number
  start_date?: string
  end_date?: string
  timezone?: string
  max_calls_per_day?: number
  budget_cents?: number
  cost_per_call_cents?: number
  metadata?: Record<string, any>
  quiet_hours_enabled?: boolean
  quiet_hours_weekdays?: string
  quiet_hours_saturday?: string
  quiet_hours_sunday?: string
  quiet_hours_timezone?: string
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data } = await api.get<Campaign[]>('/campaigns')
  return Array.isArray(data) ? data : []
}

export async function fetchCampaign(id: number): Promise<Campaign> {
  const { data } = await api.get<Campaign>(`/campaigns/${id}`)
  return data
}

export async function createCampaign(payload: CampaignCreate): Promise<Campaign> {
  const { data } = await api.post<Campaign>('/campaigns', payload)
  return data
}

export async function updateCampaign(id: number, payload: CampaignUpdate): Promise<Campaign> {
  const { data } = await api.patch<Campaign>(`/campaigns/${id}`, payload)
  return data
}

export async function startCampaign(id: number): Promise<{ ok: boolean }> {
  const { data } = await api.post(`/campaigns/${id}/start`)
  return data
}

export async function pauseCampaign(id: number): Promise<{ ok: boolean }> {
  const { data } = await api.post(`/campaigns/${id}/pause`)
  return data
}

export async function deleteCampaign(id: number): Promise<{ ok: boolean }> {
  const { data } = await api.delete(`/campaigns/${id}`)
  return data
}

