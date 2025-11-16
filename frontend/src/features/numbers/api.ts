import { api } from '@/shared/api/client'

export interface PhoneNumber {
  id: number
  e164: string
  type: string
  verified: boolean
  country: string | null
}

export interface NumberCreate {
  e164: string
  type?: string
}

export async function fetchNumbers(): Promise<PhoneNumber[]> {
  const { data } = await api.get<PhoneNumber[]>('/numbers')
  return Array.isArray(data) ? data : []
}

export async function createNumber(payload: NumberCreate): Promise<{ ok: boolean }> {
  const { data } = await api.post('/numbers', payload)
  return data
}

export async function deleteNumber(id: number): Promise<{ ok: boolean }> {
  const { data } = await api.delete(`/numbers/${id}`)
  return data
}

