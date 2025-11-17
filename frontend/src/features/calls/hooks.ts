import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCalls, fetchLiveCalls, fetchCall, fetchCallSegments, updateCallDisposition, type CallsFilters } from './api'

export function useCalls(filters?: CallsFilters) {
  return useQuery({
    queryKey: ['calls', filters],
    queryFn: () => fetchCalls(filters),
  })
}

export function useLiveCalls(hours: number = 6) {
  return useQuery({
    queryKey: ['calls', 'live', hours],
    queryFn: () => fetchLiveCalls(hours),
    refetchInterval: 5000, // Refetch every 5 seconds for live calls
  })
}

export function useCall(id: number | null) {
  return useQuery({
    queryKey: ['calls', id],
    queryFn: () => fetchCall(id!),
    enabled: !!id,
  })
}

export function useCallSegments(callId: number | null) {
  return useQuery({
    queryKey: ['calls', callId, 'segments'],
    queryFn: () => fetchCallSegments(callId!),
    enabled: !!callId,
  })
}

export function useUpdateCallDisposition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ callId, outcome, note }: { callId: number; outcome: string; note?: string }) =>
      updateCallDisposition(callId, outcome, note),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['calls', variables.callId] })
      qc.invalidateQueries({ queryKey: ['calls'] })
    },
  })
}

