import { useQuery } from '@tanstack/react-query'
import { fetchLiveCalls, fetchDashboardKPIs, fetchRenewalAlerts } from './api'

export function useLiveCalls() {
  return useQuery({
    queryKey: ['calls', 'live', 6],
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

export function useRenewalAlerts() {
  return useQuery({
    queryKey: ['numbers', 'renewal-alerts'],
    queryFn: fetchRenewalAlerts,
    refetchInterval: 60000, // Refresh ogni minuto
  })
}

