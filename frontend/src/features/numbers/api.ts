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
  termination_uri: string  // e.g., "pbx.zadarma.com" (required)
  sip_trunk_auth_username?: string  // SIP trunk authentication username
  sip_trunk_auth_password?: string  // SIP trunk authentication password
  inbound_agent_id?: string
  outbound_agent_id?: string
  inbound_agent_version?: number
  outbound_agent_version?: number
  nickname?: string
  inbound_webhook_url?: string
  // Legacy field names (for backward compatibility)
  sip_trunk_user_name?: string  // DEPRECATED: Use sip_trunk_auth_username
  sip_trunk_password?: string  // DEPRECATED: Use sip_trunk_auth_password
  outbound_transport?: string  // DEPRECATED: Not supported by RetellAI
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

// Get phone number details from RetellAI
export interface PhoneNumberDetails {
  phone_number: string
  phone_number_type: string
  phone_number_pretty?: string
  inbound_agent_id?: string | null
  outbound_agent_id?: string | null
  inbound_agent_version?: number | null
  outbound_agent_version?: number | null
  nickname?: string | null
  inbound_webhook_url?: string | null
  [key: string]: any
}

export async function getPhoneNumberDetails(phoneNumber: string): Promise<PhoneNumberDetails> {
  const { data } = await api.get<PhoneNumberDetails>(`/calls/retell/phone-numbers/${encodeURIComponent(phoneNumber)}`)
  return data
}

// Update phone number configuration (associate agents)
export interface UpdatePhoneNumberRequest {
  inbound_agent_id?: string | null  // null to disable inbound
  outbound_agent_id?: string | null  // null to disable outbound
  inbound_agent_version?: number | null
  outbound_agent_version?: number | null
  nickname?: string | null
  inbound_webhook_url?: string | null
}

export async function updatePhoneNumber(phoneNumber: string, payload: UpdatePhoneNumberRequest): Promise<{ success: boolean }> {
  const { data } = await api.patch<{ success: boolean }>(`/calls/retell/phone-numbers/${encodeURIComponent(phoneNumber)}`, payload)
  return data
}
