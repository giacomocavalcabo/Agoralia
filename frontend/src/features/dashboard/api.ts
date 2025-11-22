import { api } from '@/shared/api/client'

export interface LiveCall {
  id: number
  to_number: string
  from_number: string
  status: string
  created_at: string
  duration_seconds?: number
}

export interface DashboardKPIs {
  active_calls: number
  cost_today: number
  total_calls: number
  calls_successful: number
}

export interface RenewalAlert {
  phone_number: string
  phone_number_id: number
  days_until_renewal: number
  renewal_date: string
  monthly_cost_cents: number
  monthly_cost_usd: number
  purchased_at: string | null
  next_renewal_at: string | null
}

export async function fetchLiveCalls(): Promise<LiveCall[]> {
  const { data } = await api.get('/calls/live', { params: { hours: 6 } })
  return Array.isArray(data) ? data : []
}

export async function fetchDashboardKPIs(): Promise<DashboardKPIs> {
  // TODO: Aggregare da endpoints esistenti
  return {
    active_calls: 0,
    cost_today: 0,
    total_calls: 0,
    calls_successful: 0,
  }
}

export async function fetchRenewalAlerts(): Promise<RenewalAlert[]> {
  const { data } = await api.get('/numbers/renewal-alerts')
  return Array.isArray(data) ? data : []
}

