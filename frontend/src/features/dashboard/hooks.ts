import { useQuery } from '@tanstack/react-query'
import { fetchLiveCalls, fetchDashboardKPIs } from './api'

export function useLiveCalls() {
  return useQuery({
    queryKey: ['dashboard', 'live-calls'],
    queryFn: fetchLiveCalls,
    refetchInterval: 5000, // Refresh ogni 5 secondi
  })
}

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: fetchDashboardKPIs,
    refetchInterval: 30000, // Refresh ogni 30 secondi
  })
}

