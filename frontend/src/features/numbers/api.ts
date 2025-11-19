import { api } from '@/shared/api/client'

export interface PhoneNumber {
  id: number
  e164: string
  type: string
  verified: boolean
  country: string | null
}

// Purchase phone number from RetellAI
export interface PurchasePhoneNumberRequest {
  phone_number?: string  // E.164 format (optional, if not provided use area_code)
  area_code?: number  // 3-digit US area code (e.g., 415)
  country_code?: string  // US or CA only (default: US)
  number_provider?: string  // twilio or telnyx (default: twilio)
  inbound_agent_id?: string
  outbound_agent_id?: string
  inbound_agent_version?: number
  outbound_agent_version?: number
  nickname?: string
  inbound_webhook_url?: string
  toll_free?: boolean
}

// Import phone number via SIP (Custom Telephony)
export interface ImportPhoneNumberRequest {
  phone_number: string  // E.164 format (required)
  termination_uri: string  // e.g., "pbx.zadarma.com"
  sip_trunk_user_name?: string
  sip_trunk_password?: string
  inbound_agent_id?: string
  outbound_agent_id?: string
  inbound_agent_version?: number
  outbound_agent_version?: number
  nickname?: string
  inbound_webhook_url?: string
}

export interface PhoneNumberResponse {
  success: boolean
  phone_number: string
  phone_number_type?: string
  sip_inbound_uri?: string
  response?: any
  error?: any
}

export async function fetchNumbers(): Promise<PhoneNumber[]> {
  const { data } = await api.get<PhoneNumber[]>('/numbers')
  return Array.isArray(data) ? data : []
}

export async function purchasePhoneNumber(payload: PurchasePhoneNumberRequest): Promise<PhoneNumberResponse> {
  const { data } = await api.post<PhoneNumberResponse>('/calls/retell/phone-numbers/create', payload)
  return data
}

export async function importPhoneNumber(payload: ImportPhoneNumberRequest): Promise<PhoneNumberResponse> {
  const { data } = await api.post<PhoneNumberResponse>('/calls/retell/phone-numbers/import', payload)
  return data
}

export async function deletePhoneNumber(phoneNumber: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/calls/retell/phone-numbers/${encodeURIComponent(phoneNumber)}`)
  return data
}
