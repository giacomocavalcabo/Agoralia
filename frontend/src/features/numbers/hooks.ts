import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  fetchNumbers, 
  purchasePhoneNumber, 
  importPhoneNumber, 
  deletePhoneNumber,
  getPhoneNumberDetails,
  updatePhoneNumber,
  type PurchasePhoneNumberRequest,
  type ImportPhoneNumberRequest,
  type UpdatePhoneNumberRequest
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

export function usePhoneNumberDetails(phoneNumber: string | null) {
  return useQuery({
    queryKey: ['phone-number-details', phoneNumber],
    queryFn: () => phoneNumber ? getPhoneNumberDetails(phoneNumber) : null,
    enabled: !!phoneNumber,
  })
}

export function useUpdatePhoneNumber() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ phoneNumber, payload }: { phoneNumber: string; payload: UpdatePhoneNumberRequest }) => 
      updatePhoneNumber(phoneNumber, payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['numbers'] })
      qc.invalidateQueries({ queryKey: ['phone-number-details', variables.phoneNumber] })
    },
  })
}
