import { api } from '@/shared/api/client'

export interface Lead {
  id: number
  name: string
  company: string | null
  phone: string
  country_iso: string | null
  preferred_lang: string | null
  role: string | null
  nature: 'b2b' | 'b2c' | 'unknown' | 'personal' | null
  consent_basis: string | null
  consent_status: string | null
  campaign_id: number | null
  quiet_hours_disabled: boolean | null
  created_at: string
}

export interface LeadsResponse {
  total: number
  limit: number
  offset: number
  items: Lead[]
}

export interface LeadCreate {
  name: string
  phone: string
  company?: string
  preferred_lang?: string
  role?: string
  nature?: 'b2b' | 'b2c' | 'unknown' | 'personal'
  consent_basis?: string
  consent_status?: string
  campaign_id?: number
  quiet_hours_disabled?: boolean
}

export interface LeadsFilters {
  campaign_id?: number
  q?: string
  country_iso?: string
  preferred_lang?: string
  role?: string
  nature?: 'b2b' | 'b2c' | 'unknown' | 'personal'
  consent_status?: string
  created_gte?: string
  created_lte?: string
  limit?: number
  offset?: number
}

export async function fetchLeads(filters?: LeadsFilters): Promise<LeadsResponse> {
  const { data } = await api.get<LeadsResponse>('/leads', { params: filters })
  return data
}

export async function createLead(payload: LeadCreate): Promise<Lead> {
  const { data } = await api.post<Lead>('/leads', payload)
  return data
}

export async function importLeadsCSV(campaignId: number | null, file: File): Promise<{ ok: boolean; imported: number; errors?: string[] }> {
  const formData = new FormData()
  formData.append('file', file)
  if (campaignId) {
    formData.append('campaign_id', String(campaignId))
  }
  const { data } = await api.post('/leads/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

