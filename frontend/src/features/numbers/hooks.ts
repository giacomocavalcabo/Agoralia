import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchNumbers, createNumber, deleteNumber, type NumberCreate } from './api'

export function useNumbers() {
  return useQuery({
    queryKey: ['numbers'],
    queryFn: fetchNumbers,
  })
}

export function useCreateNumber() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NumberCreate) => createNumber(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numbers'] })
    },
  })
}

export function useDeleteNumber() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteNumber(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numbers'] })
    },
  })
}

