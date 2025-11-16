import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchLeads, createLead, importLeadsCSV, type LeadsFilters, type LeadCreate } from './api'

export function useLeads(filters?: LeadsFilters) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: () => fetchLeads(filters),
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: LeadCreate) => createLead(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useImportLeadsCSV() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ campaignId, file }: { campaignId: number | null; file: File }) => importLeadsCSV(campaignId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

