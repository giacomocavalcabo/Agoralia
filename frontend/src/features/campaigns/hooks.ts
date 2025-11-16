import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCampaigns, fetchCampaign, createCampaign, updateCampaign, startCampaign, pauseCampaign, deleteCampaign, type CampaignCreate, type CampaignUpdate } from './api'

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
  })
}

export function useCampaign(id: number | null) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: () => fetchCampaign(id!),
    enabled: !!id,
  })
}

export function useCreateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CampaignCreate) => createCampaign(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useUpdateCampaign(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CampaignUpdate) => updateCampaign(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['campaigns', id] })
    },
  })
}

export function useStartCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => startCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function usePauseCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => pauseCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useDeleteCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

