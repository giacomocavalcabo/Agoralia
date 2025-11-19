import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  fetchNumbers, 
  purchasePhoneNumber, 
  importPhoneNumber, 
  deletePhoneNumber,
  type PurchasePhoneNumberRequest,
  type ImportPhoneNumberRequest
} from './api'

export function useNumbers() {
  return useQuery({
    queryKey: ['numbers'],
    queryFn: fetchNumbers,
  })
}

export function usePurchasePhoneNumber() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: PurchasePhoneNumberRequest) => purchasePhoneNumber(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numbers'] })
    },
  })
}

export function useImportPhoneNumber() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ImportPhoneNumberRequest) => importPhoneNumber(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numbers'] })
    },
  })
}

export function useDeletePhoneNumber() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (phoneNumber: string) => deletePhoneNumber(phoneNumber),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numbers'] })
    },
  })
}
