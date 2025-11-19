import { api } from '@/shared/api/client'

export interface Agent {
  id: number
  name: string
  lang: string | null
  voice_id: string | null
  retell_agent_id: string | null
}

export interface AgentCreate {
  name: string
  lang?: string
  voice_id?: string
}

export interface AgentUpdate {
  name?: string
  lang?: string
  voice_id?: string
}

// Complete agent creation with all RetellAI fields
export interface AgentCreateFull {
  response_engine: {
    type: 'retell-llm' | 'conversation-flow'
    llm_id?: string
    [key: string]: any
  }
  agent_name?: string
  voice_id: string
  voice_model?: string
  fallback_voice_ids?: string[]
  voice_temperature?: number
  voice_speed?: number
  volume?: number
  responsiveness?: number
  interruption_sensitivity?: number
  enable_backchannel?: boolean
  backchannel_frequency?: number
  backchannel_words?: string[]
  reminder_trigger_ms?: number
  reminder_max_count?: number
  ambient_sound?: string
  ambient_sound_volume?: number
  language?: string
  webhook_url?: string
  webhook_timeout_ms?: number
  boosted_keywords?: string[]
  stt_mode?: 'fast' | 'accurate'
  vocab_specialization?: 'general' | 'medical'
  denoising_mode?: 'noise-cancellation' | 'noise-and-background-speech-cancellation'
  data_storage_setting?: 'everything' | 'everything_except_pii' | 'basic_attributes_only'
  opt_in_signed_url?: boolean
  pronunciation_dictionary?: Array<{ word: string; alphabet: string; phoneme: string }>
  normalize_for_speech?: boolean
  end_call_after_silence_ms?: number
  max_call_duration_ms?: number
  begin_message_delay_ms?: number
  ring_duration_ms?: number
  voicemail_option?: any
  post_call_analysis_data?: any[]
  post_call_analysis_model?: string
  allow_user_dtmf?: boolean
  user_dtmf_options?: any
  pii_config?: any
  save_to_agoralia?: boolean
  connect_to_general_kb?: boolean
}

export interface AgentTestCallRequest {
  to_number: string
  from_number?: string
}

export interface AgentTestCallResponse {
  success: boolean
  call_id?: string
  response?: any
}

// Fetch agents from Agoralia database
export async function fetchAgents(): Promise<Agent[]> {
  const { data } = await api.get<Agent[]>('/agents')
  return Array.isArray(data) ? data : []
}

// Fetch agents from RetellAI
export async function fetchRetellAgents(limit?: number, pagination_key?: string, pagination_key_version?: number): Promise<any[]> {
  const params = new URLSearchParams()
  if (limit) params.append('limit', limit.toString())
  if (pagination_key) params.append('pagination_key', pagination_key)
  if (pagination_key_version) params.append('pagination_key_version', pagination_key_version.toString())
  
  const { data } = await api.get(`/calls/retell/agents?${params.toString()}`)
  return Array.isArray(data) ? data : []
}

export async function fetchAgent(id: number): Promise<Agent> {
  const { data } = await api.get<Agent>(`/agents/${id}`)
  return data
}

// Get agent details from RetellAI
export async function getRetellAgent(agentId: string, version?: number): Promise<any> {
  const params = version ? `?version=${version}` : ''
  const { data } = await api.get(`/calls/retell/agents/${encodeURIComponent(agentId)}${params}`)
  return data
}

// Create agent (legacy - simple)
export async function createAgent(payload: AgentCreate): Promise<{ ok: boolean; id: number; name: string; retell_agent_id: string | null; retell_created: boolean }> {
  const { data } = await api.post('/agents', payload)
  return data
}

// Create agent with full RetellAI support
export async function createAgentFull(payload: AgentCreateFull): Promise<{ success: boolean; agent_id: string; agoralia_agent_id?: number; response: any }> {
  const { data } = await api.post('/calls/retell/agents/create', payload)
  return data
}

export async function updateAgent(id: number, payload: AgentUpdate): Promise<{ ok: boolean; retell_updated: boolean }> {
  const { data } = await api.patch(`/agents/${id}`, payload)
  return data
}

export async function deleteAgent(id: number): Promise<{ ok: boolean; retell_deleted: boolean }> {
  const { data } = await api.delete(`/agents/${id}`)
  return data
}

// Delete agent from RetellAI
export async function deleteRetellAgent(agentId: string): Promise<{ success: boolean; agent_id: string }> {
  const { data } = await api.delete(`/calls/retell/agents/${encodeURIComponent(agentId)}`)
  return data
}

// Test call to an agent
export async function testAgentCall(agentId: string, payload: AgentTestCallRequest): Promise<AgentTestCallResponse> {
  const { data } = await api.post(`/calls/retell/agents/${encodeURIComponent(agentId)}/test-call`, payload)
  return data
}

