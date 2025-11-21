import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog'
import { useAgents, useCreateAgentFull, useDeleteAgent, useTestAgentCall } from '../hooks'
import { api } from '@/shared/api/client'
import { useQueryClient } from '@tanstack/react-query'
import type { Agent } from '../api'
import { useKnowledgeBases } from '@/features/knowledge/hooks'
import { Plus, Trash2, Bot, Globe, Mic, Phone, Loader2, ChevronRight, ChevronLeft, Pencil } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

// Available voice IDs (common RetellAI voices)
const VOICE_IDS = [
  // ElevenLabs voices ($0.10/min)
  { value: '11labs-Adrian', label: '11labs-Adrian (ElevenLabs)' },
  { value: '11labs-Antoni', label: '11labs-Antoni (ElevenLabs)' },
  { value: '11labs-Arnold', label: '11labs-Arnold (ElevenLabs)' },
  { value: '11labs-Adam', label: '11labs-Adam (ElevenLabs)' },
  { value: '11labs-Sam', label: '11labs-Sam (ElevenLabs)' },
  { value: '11labs-George', label: '11labs-George (ElevenLabs)' },
  { value: '11labs-Domi', label: '11labs-Domi (ElevenLabs)' },
  { value: '11labs-Bella', label: '11labs-Bella (ElevenLabs)' },
  { value: '11labs-Rachel', label: '11labs-Rachel (ElevenLabs)' },
  { value: '11labs-Josh', label: '11labs-Josh (ElevenLabs)' },
  // OpenAI voices ($0.08/min)
  { value: 'openai-Alloy', label: 'openai-Alloy (OpenAI)' },
  { value: 'openai-Echo', label: 'openai-Echo (OpenAI)' },
  { value: 'openai-Fable', label: 'openai-Fable (OpenAI)' },
  { value: 'openai-Onyx', label: 'openai-Onyx (OpenAI)' },
  { value: 'openai-Nova', label: 'openai-Nova (OpenAI)' },
  { value: 'openai-Shimmer', label: 'openai-Shimmer (OpenAI)' },
  // Deepgram voices ($0.08/min)
  { value: 'deepgram-Angus', label: 'deepgram-Angus (Deepgram)' },
  { value: 'deepgram-Asteria', label: 'deepgram-Asteria (Deepgram)' },
  { value: 'deepgram-Athena', label: 'deepgram-Athena (Deepgram)' },
  { value: 'deepgram-Cora', label: 'deepgram-Cora (Deepgram)' },
  { value: 'deepgram-Demetri', label: 'deepgram-Demetri (Deepgram)' },
  { value: 'deepgram-Gemma', label: 'deepgram-Gemma (Deepgram)' },
  { value: 'deepgram-Hera', label: 'deepgram-Hera (Deepgram)' },
  { value: 'deepgram-Jasper', label: 'deepgram-Jasper (Deepgram)' },
  { value: 'deepgram-Luna', label: 'deepgram-Luna (Deepgram)' },
  { value: 'deepgram-Nova', label: 'deepgram-Nova (Deepgram)' },
  { value: 'deepgram-Orion', label: 'deepgram-Orion (Deepgram)' },
  { value: 'deepgram-Phoebe', label: 'deepgram-Phoebe (Deepgram)' },
  { value: 'deepgram-Sage', label: 'deepgram-Sage (Deepgram)' },
  { value: 'deepgram-Titan', label: 'deepgram-Titan (Deepgram)' },
  { value: 'deepgram-Vesper', label: 'deepgram-Vesper (Deepgram)' },
]

// Available languages
const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'en-NZ', label: 'English (New Zealand)' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-419', label: 'Spanish (Latin America)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'fr-CA', label: 'French (Canada)' },
  { value: 'de-DE', label: 'German' },
  { value: 'pt-PT', label: 'Portuguese (Portugal)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'ko-KR', label: 'Korean' },
  { value: 'ru-RU', label: 'Russian' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'nl-NL', label: 'Dutch (Netherlands)' },
  { value: 'nl-BE', label: 'Dutch (Belgium)' },
  { value: 'pl-PL', label: 'Polish' },
  { value: 'tr-TR', label: 'Turkish' },
  { value: 'th-TH', label: 'Thai' },
  { value: 'vi-VN', label: 'Vietnamese' },
  { value: 'ro-RO', label: 'Romanian' },
  { value: 'bg-BG', label: 'Bulgarian' },
  { value: 'ca-ES', label: 'Catalan' },
  { value: 'da-DK', label: 'Danish' },
  { value: 'fi-FI', label: 'Finnish' },
  { value: 'el-GR', label: 'Greek' },
  { value: 'hu-HU', label: 'Hungarian' },
  { value: 'id-ID', label: 'Indonesian' },
  { value: 'no-NO', label: 'Norwegian' },
  { value: 'sk-SK', label: 'Slovak' },
  { value: 'sv-SE', label: 'Swedish' },
  { value: 'multi', label: 'Multilingual (Spanish & English)' },
]

// Available LLM models
const LLM_MODELS = [
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'gpt-5-nano', label: 'GPT-5 Nano' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'claude-4.5-sonnet', label: 'Claude 4.5 Sonnet' },
  { value: 'claude-4.0-sonnet', label: 'Claude 4.0 Sonnet' },
  { value: 'claude-3.7-sonnet', label: 'Claude 3.7 Sonnet' },
  { value: 'claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
]

// Agent creation schema with all RetellAI fields
const agentSchema = z.object({
  // Step 1: Base configuration
  agent_name: z.string().min(1, 'Agent name is required'),
  voice_id: z.string().min(1, 'Voice ID is required'),
  language: z.string().default('en-US'),
  model: z.string().default('gpt-4o-mini'),
  
  // Step 2: Character & Welcome
  role: z.enum(['inbound', 'outbound', 'both']).default('both'),
  mission: z.string().min(1, 'Mission is required'),
  custom_prompt: z.string().optional(),
  welcome_message: z.string().optional(),
  start_speaker: z.enum(['agent', 'user']).default('agent'),
  begin_message_delay_ms: z.number().min(0).max(5000).default(0),
  
  // Step 3: Voice & Behavior
  voice_model: z.string().optional(),
  voice_temperature: z.number().min(0).max(2).optional(),
  voice_speed: z.number().min(0.5).max(2).optional(),
  volume: z.number().min(0).max(2).optional(),
  fallback_voice_ids: z.array(z.string()).optional(),
  responsiveness: z.number().min(0).max(1).optional(),
  interruption_sensitivity: z.number().min(0).max(1).optional(),
  enable_backchannel: z.boolean().optional(),
  backchannel_frequency: z.number().min(0).max(1).optional(),
  backchannel_words: z.array(z.string()).optional(),
  reminder_trigger_ms: z.number().min(1).optional(),
  reminder_max_count: z.number().min(0).optional(),
  ambient_sound: z.enum(['coffee-shop', 'convention-hall', 'summer-outdoor', 'mountain-outdoor', 'static-noise', 'call-center']).optional().or(z.literal('')),
  ambient_sound_volume: z.number().min(0).max(2).optional(),
  
  // Step 4: Transcription & Call Settings
  stt_mode: z.enum(['fast', 'accurate']).optional(),
  vocab_specialization: z.enum(['general', 'medical']).optional(),
  denoising_mode: z.enum(['noise-cancellation', 'noise-and-background-speech-cancellation']).optional(),
  boosted_keywords: z.array(z.string()).optional().or(z.literal(undefined)),
  normalize_for_speech: z.boolean().optional(),
  // These are stored in seconds in the form, converted to ms on submit
  end_call_after_silence_seconds: z.number().min(10).optional(), // min 10s = 10000ms
  max_call_duration_seconds: z.number().min(60).max(7200).optional(), // min 60s = 60000ms, max 7200s = 7200000ms
  ring_duration_seconds: z.number().min(5).max(90).optional(), // min 5s = 5000ms, max 90s = 90000ms
  allow_user_dtmf: z.boolean().optional(),
  voicemail_detect: z.boolean().optional(),
  voicemail_message: z.string().optional(),
  
  // Step 5: Advanced & Knowledge Base
  data_storage_setting: z.enum(['everything', 'everything_except_pii', 'basic_attributes_only']).optional(),
  opt_in_signed_url: z.boolean().optional(),
  webhook_url: z.string().optional().refine(
    (val) => {
      if (!val || val.trim() === '') return true // Empty is OK
      try {
        new URL(val.trim())
        return true
      } catch {
        return false
      }
    },
    { message: 'Must be a valid URL if provided' }
  ).or(z.literal('')).or(z.literal(null)),
  webhook_timeout_ms: z.union([
    z.number().min(1000).max(30000),
    z.nan(),
    z.undefined(),
  ]).optional().transform((val) => isNaN(val) ? undefined : val),
  post_call_analysis_model: z.string().optional(),
  knowledge_base_ids: z.array(z.number()).default([]),
})

type AgentFormInputs = z.infer<typeof agentSchema>

// Helper function to format duration in seconds to human-readable format
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} secondi`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${minutes} minuti e ${secs} secondi` : `${minutes} minuti`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    const parts: string[] = [`${hours} ${hours === 1 ? 'ora' : 'ore'}`]
    if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minuti'}`)
    if (secs > 0) parts.push(`${secs} ${secs === 1 ? 'secondo' : 'secondi'}`)
    return parts.join(' e ')
  }
}

// Test call schema
const testCallSchema = z.object({
  to_number: z.string().min(1, 'Phone number is required'),
  from_number: z.string().optional(),
})

type TestCallFormInputs = z.infer<typeof testCallSchema>

export function AgentsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [testCallModalOpen, setTestCallModalOpen] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const qc = useQueryClient()
  const { data: agents, isLoading, error } = useAgents()
  const { data: kbs } = useKnowledgeBases()
  const createMutation = useCreateAgentFull()
  const deleteMutation = useDeleteAgent()
  const testCallMutation = useTestAgentCall()
  const [isUpdating, setIsUpdating] = useState(false)

  const agentForm = useForm<AgentFormInputs>({
    resolver: zodResolver(agentSchema) as any,
    defaultValues: {
      language: 'en-US',
      model: 'gpt-4o-mini',
      voice_id: '11labs-Adrian',
      role: 'both',
      mission: '',
      custom_prompt: '',
      welcome_message: '',
      start_speaker: 'agent',
      begin_message_delay_ms: 0,
      knowledge_base_ids: [],
    },
  })

  const testCallForm = useForm<TestCallFormInputs>({
    resolver: zodResolver(testCallSchema),
  })

  // Build custom prompt from role, mission, and custom prompt
  // Follows RetellAI best practices: structured sections for better understanding
  const buildCustomPrompt = (data: AgentFormInputs): string => {
    // Determine language for prompt based on agent language
    const isItalian = data.language?.startsWith('it')
    
    // Build structured prompt following RetellAI best practices
    let prompt = ''
    
    // ## Identità (Identity)
    if (isItalian) {
      prompt += '## Identità\n'
      prompt += `Sei un assistente AI professionale per Agoralia.\n`
      
      if (data.role === 'inbound') {
        prompt += 'Il tuo ruolo principale è ricevere e gestire chiamate in arrivo.\n'
      } else if (data.role === 'outbound') {
        prompt += 'Il tuo ruolo principale è effettuare chiamate in uscita per contattare potenziali clienti.\n'
      } else {
        prompt += 'Il tuo ruolo è gestire sia chiamate in arrivo che in uscita.\n'
      }
    } else {
      prompt += '## Identity\n'
      prompt += `You are a professional AI assistant for Agoralia.\n`
      
      if (data.role === 'inbound') {
        prompt += 'Your primary role is to receive and handle inbound calls.\n'
      } else if (data.role === 'outbound') {
        prompt += 'Your primary role is to make outbound calls to contact potential customers.\n'
      } else {
        prompt += 'Your role is to handle both inbound and outbound calls.\n'
      }
    }
    
    // ## Stile e Linee Guida (Style and Guidelines)
    if (isItalian) {
      prompt += '\n## Stile e Linee Guida\n'
      prompt += 'Sii conciso: mantieni le risposte sotto le 2 frasi, a meno che non stia spiegando argomenti complessi.\n'
      prompt += 'Sii conversazionale: usa un linguaggio naturale, contrazioni e riconosci ciò che dice l\'interlocutore.\n'
      prompt += 'Sii empatico: mostra comprensione per la situazione dell\'interlocutore.\n'
    } else {
      prompt += '\n## Style and Guidelines\n'
      prompt += 'Be concise: keep responses under 2 sentences, unless explaining complex topics.\n'
      prompt += 'Be conversational: use natural language, contractions, and acknowledge what the caller says.\n'
      prompt += 'Be empathetic: show understanding for the caller\'s situation.\n'
    }
    
    // ## Istruzioni per le Risposte (Response Guidelines)
    if (isItalian) {
      prompt += '\n## Istruzioni per le Risposte\n'
      prompt += 'Restituisci le date in forma parlata: dì "quindici gennaio" invece di "15/01".\n'
      prompt += 'Fai una domanda alla volta: evita di sovraccaricare l\'interlocutore con domande multiple.\n'
      prompt += 'Conferma la comprensione: parafrasa le informazioni importanti all\'interlocutore.\n'
    } else {
      prompt += '\n## Response Guidelines\n'
      prompt += 'Return dates in spoken form: say "fifteenth of January" instead of "01/15".\n'
      prompt += 'Ask one question at a time: avoid overloading the caller with multiple questions.\n'
      prompt += 'Confirm understanding: paraphrase important information to the caller.\n'
    }
    
    // ## Istruzioni per le Attività (Activity Instructions / Mission)
    if (isItalian) {
      prompt += '\n## Istruzioni per le Attività\n'
    } else {
      prompt += '\n## Activity Instructions\n'
    }
    
    if (data.mission) {
      prompt += data.mission
      if (!data.mission.endsWith('.') && !data.mission.endsWith('\n')) {
        prompt += '.'
      }
      prompt += '\n'
    }
    
    // ## Istruzioni Aggiuntive (Additional Instructions)
    if (data.custom_prompt && data.custom_prompt.trim()) {
      if (isItalian) {
        prompt += '\n## Istruzioni Aggiuntive\n'
      } else {
        prompt += '\n## Additional Instructions\n'
      }
      prompt += data.custom_prompt.trim() + '\n'
    }
    
    return prompt.trim()
  }

  const onSubmit = async (data: AgentFormInputs) => {
    console.log('[AgentForm] onSubmit called with data:', data)
    try {
      // Build custom prompt
      const customPrompt = buildCustomPrompt(data)
      console.log('[AgentForm] Custom prompt built:', customPrompt.substring(0, 100) + '...')
      
      // Get knowledge base IDs (general KB is always included, plus selected ones)
      const kbIds: string[] = []
      
      // Add general KB (always connected)
      if (kbs) {
        const generalKb = kbs.find(kb => kb.scope === 'general')
        if (generalKb?.retell_kb_id) {
          kbIds.push(generalKb.retell_kb_id)
        }
      }
      
      // Add selected KBs
      if (data.knowledge_base_ids && kbs) {
        for (const kbId of data.knowledge_base_ids) {
          const kb = kbs.find(k => k.id === kbId)
          if (kb?.retell_kb_id && !kbIds.includes(kb.retell_kb_id)) {
            kbIds.push(kb.retell_kb_id)
          }
        }
      }
      
      // Create Retell LLM (response engine) with custom prompt
      // Always ensure response_engine has at least type and model
      const responseEngine: any = {
        type: 'retell-llm' as const,
        model: data.model || 'gpt-4o-mini',
        start_speaker: data.start_speaker || 'agent',
      }
      
      // Add welcome message (begin_message) - this is separate from the structured prompt
      // If welcome_message is provided, use it; otherwise use the structured prompt
      const beginMessage = (data.welcome_message && data.welcome_message.trim()) 
        ? data.welcome_message.trim() 
        : (customPrompt ? customPrompt : 'Hello! How can I help you today?')
      
      // Always set begin_message to ensure response_engine is valid
      if (beginMessage) {
        responseEngine.begin_message = beginMessage
      }
      
      // Add knowledge bases if any
      if (kbIds.length > 0) {
        responseEngine.knowledge_base_ids = kbIds
      }
      
      console.log('[AgentForm] Built responseEngine:', responseEngine)
      
      // Build complete payload with all RetellAI fields
      const payload: any = {
        response_engine: responseEngine, // Use responseEngine variable (camelCase)
        agent_name: data.agent_name,
        voice_id: data.voice_id,
        language: data.language,
        connect_to_general_kb: true, // Always true
        save_to_agoralia: true, // Always true
        
        // Welcome & Speaking
        begin_message_delay_ms: data.begin_message_delay_ms ?? 0,
        
        // Voice Settings
        ...(data.voice_model && data.voice_model.trim() !== '' && { voice_model: data.voice_model.trim() }),
        ...(data.voice_temperature !== undefined && !isNaN(data.voice_temperature) && isFinite(data.voice_temperature) && { 
          voice_temperature: Math.max(0, Math.min(2, data.voice_temperature)) 
        }),
        ...(data.voice_speed !== undefined && !isNaN(data.voice_speed) && isFinite(data.voice_speed) && { 
          voice_speed: Math.max(0.5, Math.min(2, data.voice_speed)) 
        }),
        ...(data.volume !== undefined && !isNaN(data.volume) && isFinite(data.volume) && { 
          volume: Math.max(0, Math.min(2, data.volume)) 
        }),
        ...(Array.isArray(data.fallback_voice_ids) && data.fallback_voice_ids.length > 0 && { 
          fallback_voice_ids: data.fallback_voice_ids.filter(v => v && typeof v === 'string' && v.trim().length > 0) 
        }),
        
        // Agent Behavior
        ...(data.responsiveness !== undefined && !isNaN(data.responsiveness) && isFinite(data.responsiveness) && { 
          responsiveness: Math.max(0, Math.min(1, data.responsiveness)) 
        }),
        ...(data.interruption_sensitivity !== undefined && !isNaN(data.interruption_sensitivity) && isFinite(data.interruption_sensitivity) && { 
          interruption_sensitivity: Math.max(0, Math.min(1, data.interruption_sensitivity)) 
        }),
        ...(data.enable_backchannel !== undefined && typeof data.enable_backchannel === 'boolean' && { 
          enable_backchannel: data.enable_backchannel 
        }),
        ...(data.backchannel_frequency !== undefined && !isNaN(data.backchannel_frequency) && isFinite(data.backchannel_frequency) && { 
          backchannel_frequency: Math.max(0, Math.min(1, data.backchannel_frequency)) 
        }),
        ...(Array.isArray(data.backchannel_words) && data.backchannel_words.length > 0 && { 
          backchannel_words: data.backchannel_words.filter(w => w && typeof w === 'string' && w.trim().length > 0) 
        }),
        ...(data.reminder_trigger_ms !== undefined && !isNaN(data.reminder_trigger_ms) && isFinite(data.reminder_trigger_ms) && data.reminder_trigger_ms > 0 && { 
          reminder_trigger_ms: Math.round(data.reminder_trigger_ms) 
        }),
        ...(data.reminder_max_count !== undefined && !isNaN(data.reminder_max_count) && isFinite(data.reminder_max_count) && data.reminder_max_count >= 0 && { 
          reminder_max_count: Math.round(data.reminder_max_count) 
        }),
        
        // Ambient Sound
        ...(data.ambient_sound && typeof data.ambient_sound === 'string' && data.ambient_sound.trim() !== '' && { ambient_sound: data.ambient_sound }),
        ...(data.ambient_sound_volume !== undefined && !isNaN(data.ambient_sound_volume) && isFinite(data.ambient_sound_volume) && { 
          ambient_sound_volume: Math.max(0, Math.min(2, data.ambient_sound_volume)) 
        }),
        
        // Transcription & Keywords
        ...(data.stt_mode && { stt_mode: data.stt_mode }),
        ...(data.vocab_specialization && { vocab_specialization: data.vocab_specialization }),
        ...(data.denoising_mode && { denoising_mode: data.denoising_mode }),
        ...(Array.isArray(data.boosted_keywords) && data.boosted_keywords.length > 0 && { 
          boosted_keywords: data.boosted_keywords.filter(k => k && typeof k === 'string' && k.trim().length > 0) 
        }),
        ...(data.normalize_for_speech !== undefined && typeof data.normalize_for_speech === 'boolean' && { 
          normalize_for_speech: data.normalize_for_speech 
        }),
        
        // Call Settings - convert seconds to milliseconds (ensure valid numbers and ranges)
        ...(data.end_call_after_silence_seconds !== undefined && !isNaN(data.end_call_after_silence_seconds) && isFinite(data.end_call_after_silence_seconds) && data.end_call_after_silence_seconds >= 10 && { 
          end_call_after_silence_ms: Math.round(data.end_call_after_silence_seconds * 1000) 
        }),
        ...(data.max_call_duration_seconds !== undefined && !isNaN(data.max_call_duration_seconds) && isFinite(data.max_call_duration_seconds) && data.max_call_duration_seconds >= 60 && data.max_call_duration_seconds <= 7200 && { 
          max_call_duration_ms: Math.round(data.max_call_duration_seconds * 1000) 
        }),
        ...(data.ring_duration_seconds !== undefined && !isNaN(data.ring_duration_seconds) && isFinite(data.ring_duration_seconds) && data.ring_duration_seconds >= 5 && data.ring_duration_seconds <= 90 && { 
          ring_duration_ms: Math.round(data.ring_duration_seconds * 1000) 
        }),
        ...(data.allow_user_dtmf !== undefined && typeof data.allow_user_dtmf === 'boolean' && { 
          allow_user_dtmf: data.allow_user_dtmf 
        }),
        
        // Voicemail
        ...(data.voicemail_detect && data.voicemail_message && data.voicemail_message.trim() !== '' ? {
          voicemail_option: {
            action: {
              type: 'static_text',
              text: data.voicemail_message.trim(),
            },
          },
        } : {}),
        
        // Data Storage
        ...(data.data_storage_setting && { data_storage_setting: data.data_storage_setting }),
        ...(data.opt_in_signed_url !== undefined && typeof data.opt_in_signed_url === 'boolean' && { 
          opt_in_signed_url: data.opt_in_signed_url 
        }),
        
        // Webhook - only include if not empty
        ...(data.webhook_url && data.webhook_url.trim() !== '' ? { webhook_url: data.webhook_url.trim() } : {}),
        ...(data.webhook_timeout_ms !== undefined && !isNaN(data.webhook_timeout_ms) && isFinite(data.webhook_timeout_ms) && data.webhook_timeout_ms >= 1000 && data.webhook_timeout_ms <= 30000 && { 
          webhook_timeout_ms: Math.round(data.webhook_timeout_ms) 
        }),
        
        // Post-Call Analysis
        ...(data.post_call_analysis_model && data.post_call_analysis_model.trim() !== '' && { 
          post_call_analysis_model: data.post_call_analysis_model.trim() 
        }),
        
        // Additional metadata (for UI/database)
        role: data.role,
        mission: data.mission,
        custom_prompt: data.custom_prompt,
      }

      if (editingAgent) {
        // Update existing agent
        setIsUpdating(true)
        try {
          // Build update payload (only changed fields, but we send all to be safe)
          const updatePayload: any = {
            name: data.agent_name,
            lang: data.language,
            voice_id: data.voice_id,
            response_engine: responseEngine, // Use responseEngine variable defined above
            begin_message: data.welcome_message?.trim() || beginMessage,
            start_speaker: data.start_speaker || 'agent',
            begin_message_delay_ms: data.begin_message_delay_ms ?? 0,
          // Voice Settings
          ...(data.voice_model && data.voice_model.trim() !== '' && { voice_model: data.voice_model.trim() }),
          ...(data.voice_temperature !== undefined && !isNaN(data.voice_temperature) && isFinite(data.voice_temperature) && { 
            voice_temperature: Math.max(0, Math.min(2, data.voice_temperature)) 
          }),
          ...(data.voice_speed !== undefined && !isNaN(data.voice_speed) && isFinite(data.voice_speed) && { 
            voice_speed: Math.max(0.5, Math.min(2, data.voice_speed)) 
          }),
          ...(data.volume !== undefined && !isNaN(data.volume) && isFinite(data.volume) && { 
            volume: Math.max(0, Math.min(2, data.volume)) 
          }),
          ...(Array.isArray(data.fallback_voice_ids) && data.fallback_voice_ids.length > 0 && { 
            fallback_voice_ids: data.fallback_voice_ids.filter(v => v && v.trim().length > 0) 
          }),
          // Agent Behavior
          ...(data.responsiveness !== undefined && !isNaN(data.responsiveness) && isFinite(data.responsiveness) && { 
            responsiveness: Math.max(0, Math.min(1, data.responsiveness)) 
          }),
          ...(data.interruption_sensitivity !== undefined && !isNaN(data.interruption_sensitivity) && isFinite(data.interruption_sensitivity) && { 
            interruption_sensitivity: Math.max(0, Math.min(1, data.interruption_sensitivity)) 
          }),
          ...(data.enable_backchannel !== undefined && typeof data.enable_backchannel === 'boolean' && { 
            enable_backchannel: data.enable_backchannel 
          }),
          ...(data.backchannel_frequency !== undefined && !isNaN(data.backchannel_frequency) && isFinite(data.backchannel_frequency) && { 
            backchannel_frequency: Math.max(0, Math.min(1, data.backchannel_frequency)) 
          }),
          ...(Array.isArray(data.backchannel_words) && data.backchannel_words.length > 0 && { 
            backchannel_words: data.backchannel_words.filter(w => w && w.trim().length > 0) 
          }),
          ...(data.reminder_trigger_ms !== undefined && !isNaN(data.reminder_trigger_ms) && isFinite(data.reminder_trigger_ms) && data.reminder_trigger_ms > 0 && { 
            reminder_trigger_ms: Math.round(data.reminder_trigger_ms) 
          }),
          ...(data.reminder_max_count !== undefined && !isNaN(data.reminder_max_count) && isFinite(data.reminder_max_count) && data.reminder_max_count >= 0 && { 
            reminder_max_count: Math.round(data.reminder_max_count) 
          }),
          // Ambient Sound
          ...(data.ambient_sound && typeof data.ambient_sound === 'string' && data.ambient_sound.trim() !== '' && { ambient_sound: data.ambient_sound }),
          ...(data.ambient_sound_volume !== undefined && !isNaN(data.ambient_sound_volume) && isFinite(data.ambient_sound_volume) && { 
            ambient_sound_volume: Math.max(0, Math.min(2, data.ambient_sound_volume)) 
          }),
          // Transcription & Keywords
          ...(data.stt_mode && { stt_mode: data.stt_mode }),
          ...(data.vocab_specialization && { vocab_specialization: data.vocab_specialization }),
          ...(data.denoising_mode && { denoising_mode: data.denoising_mode }),
          ...(Array.isArray(data.boosted_keywords) && data.boosted_keywords.length > 0 && { 
            boosted_keywords: data.boosted_keywords.filter(k => k && typeof k === 'string' && k.trim().length > 0) 
          }),
          ...(data.normalize_for_speech !== undefined && typeof data.normalize_for_speech === 'boolean' && { 
            normalize_for_speech: data.normalize_for_speech 
          }),
          // Call Settings - convert seconds to milliseconds (ensure valid numbers)
          ...(data.end_call_after_silence_seconds !== undefined && !isNaN(data.end_call_after_silence_seconds) && isFinite(data.end_call_after_silence_seconds) && data.end_call_after_silence_seconds >= 10 && { 
            end_call_after_silence_ms: Math.round(data.end_call_after_silence_seconds * 1000) 
          }),
          ...(data.max_call_duration_seconds !== undefined && !isNaN(data.max_call_duration_seconds) && isFinite(data.max_call_duration_seconds) && data.max_call_duration_seconds >= 60 && data.max_call_duration_seconds <= 7200 && { 
            max_call_duration_ms: Math.round(data.max_call_duration_seconds * 1000) 
          }),
          ...(data.ring_duration_seconds !== undefined && !isNaN(data.ring_duration_seconds) && isFinite(data.ring_duration_seconds) && data.ring_duration_seconds >= 5 && data.ring_duration_seconds <= 90 && { 
            ring_duration_ms: Math.round(data.ring_duration_seconds * 1000) 
          }),
          ...(data.allow_user_dtmf !== undefined && typeof data.allow_user_dtmf === 'boolean' && { 
            allow_user_dtmf: data.allow_user_dtmf 
          }),
          // Voicemail
          ...(data.voicemail_detect && data.voicemail_message && data.voicemail_message.trim() !== '' ? {
            voicemail_option: {
              action: {
                type: 'static_text',
                text: data.voicemail_message.trim(),
              },
            },
          } : {}),
          // Data Storage
          ...(data.data_storage_setting && { data_storage_setting: data.data_storage_setting }),
          ...(data.opt_in_signed_url !== undefined && typeof data.opt_in_signed_url === 'boolean' && { 
            opt_in_signed_url: data.opt_in_signed_url 
          }),
          // Webhook - only include if not empty
          ...(data.webhook_url && data.webhook_url.trim() !== '' ? { webhook_url: data.webhook_url.trim() } : {}),
          ...(data.webhook_timeout_ms !== undefined && !isNaN(data.webhook_timeout_ms) && isFinite(data.webhook_timeout_ms) && data.webhook_timeout_ms >= 1000 && data.webhook_timeout_ms <= 30000 && { 
            webhook_timeout_ms: Math.round(data.webhook_timeout_ms) 
          }),
          // Post-Call Analysis
          ...(data.post_call_analysis_model && { post_call_analysis_model: data.post_call_analysis_model }),
          // Knowledge Base - convert Agoralia KB IDs to Retell KB IDs
          knowledge_base_ids: kbIds.length > 0 ? kbIds : null,
          // Additional metadata
          role: data.role,
          mission: data.mission,
          custom_prompt: data.custom_prompt,
        }

          const result = await api.patch(`/agents/${editingAgent.id}`, updatePayload)
          if (result.data.ok) {
            agentForm.reset()
            setEditModalOpen(false)
            setEditingAgent(null)
            setCurrentStep(1)
            qc.invalidateQueries({ queryKey: ['agents'] })
            qc.invalidateQueries({ queryKey: ['agents', editingAgent.id] })
          } else {
            alert(`Failed to update agent: ${JSON.stringify(result.data)}`)
          }
        } finally {
          setIsUpdating(false)
        }
      } else {
        // Create new agent
        console.log('[AgentForm] Creating new agent with payload:', payload)
        try {
          const result = await createMutation.mutateAsync(payload)
          console.log('[AgentForm] Create result:', result)
          if (result.success) {
            agentForm.reset()
            setCreateModalOpen(false)
            setCurrentStep(1)
            console.log('[AgentForm] Agent created successfully')
          } else {
            console.error('[AgentForm] Create failed:', result)
            alert(`Failed to create agent: ${JSON.stringify(result)}`)
          }
        } catch (createError: any) {
          console.error('[AgentForm] Create mutation error:', createError)
          alert(`Failed to create agent: ${createError.message || createError.toString()}`)
        }
      }
    } catch (error: any) {
      console.error('[AgentForm] onSubmit error:', error)
      alert(`Failed to ${editingAgent ? 'update' : 'create'} agent: ${error.message || error.toString()}`)
    }
  }
  
  const handleNextStep = async () => {
    const step1Fields: (keyof AgentFormInputs)[] = ['agent_name', 'voice_id', 'language', 'model']
    const step2Fields: (keyof AgentFormInputs)[] = ['role', 'mission']
    // Steps 3, 4, 5 don't have required fields - all optional
    
    let fieldsToValidate: (keyof AgentFormInputs)[] = []
    if (currentStep === 1) {
      fieldsToValidate = step1Fields
    } else if (currentStep === 2) {
      fieldsToValidate = step2Fields
    }
    
    const isValid = fieldsToValidate.length === 0 || await agentForm.trigger(fieldsToValidate as any)
    if (isValid && currentStep < 5) {
      setCurrentStep(currentStep + 1)
    }
  }
  
  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }
  
  const handleCreateModalClose = (open: boolean) => {
    setCreateModalOpen(open)
    if (!open) {
      setCurrentStep(1)
      agentForm.reset()
      setEditingAgent(null)
    }
  }

  const handleEditModalClose = (open: boolean) => {
    setEditModalOpen(open)
    if (!open) {
      setCurrentStep(1)
      agentForm.reset()
      setEditingAgent(null)
    }
  }

  const onTestCallSubmit = async (data: TestCallFormInputs) => {
    if (!selectedAgentId) return
    
    try {
      const result = await testCallMutation.mutateAsync({
        agentId: selectedAgentId,
        payload: {
          to_number: data.to_number,
          from_number: data.from_number || undefined,
        },
      })
      
      if (result.success) {
        testCallForm.reset()
        setTestCallModalOpen(false)
        setSelectedAgentId(null)
        alert(`Test call initiated! Call ID: ${result.call_id || 'N/A'}`)
      } else {
        alert(`Failed to make test call: ${JSON.stringify(result)}`)
      }
    } catch (error: any) {
      alert(`Failed to make test call: ${error.message}`)
    }
  }

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setEditModalOpen(true)
    setCurrentStep(1)
    
    // Populate form with agent data
    const responseEngine = agent.response_engine as any
    const model = responseEngine?.model || 'gpt-4o-mini'
    const startSpeaker = responseEngine?.start_speaker || agent.start_speaker || 'agent'
    const beginMessage = responseEngine?.begin_message || agent.begin_message || ''
    
    // Extract knowledge base IDs - need to convert Retell KB IDs to Agoralia KB IDs
    const kbIds: number[] = []
    if (agent.knowledge_base_ids && kbs) {
      // Find Agoralia KB IDs from Retell KB IDs
      for (const retellKbId of agent.knowledge_base_ids) {
        const kb = kbs.find(k => k.retell_kb_id === retellKbId)
        if (kb && kb.scope !== 'general') {
          kbIds.push(kb.id)
        }
      }
    }
    
    // Populate form
    agentForm.reset({
      agent_name: agent.name || '',
      voice_id: agent.voice_id || '11labs-Adrian',
      language: agent.lang || 'en-US',
      model,
      role: (agent.role as any) || 'both',
      mission: agent.mission || '',
      custom_prompt: agent.custom_prompt || '',
      welcome_message: beginMessage || '',
      start_speaker: (startSpeaker as 'agent' | 'user') || 'agent',
      begin_message_delay_ms: agent.begin_message_delay_ms ?? 0,
      knowledge_base_ids: kbIds,
      // Voice Settings
      voice_model: agent.voice_model || undefined,
      voice_temperature: agent.voice_temperature ?? undefined,
      voice_speed: agent.voice_speed ?? undefined,
      volume: agent.volume ?? undefined,
      fallback_voice_ids: agent.fallback_voice_ids || undefined,
      // Agent Behavior
      responsiveness: agent.responsiveness ?? undefined,
      interruption_sensitivity: agent.interruption_sensitivity ?? undefined,
      enable_backchannel: agent.enable_backchannel ?? undefined,
      backchannel_frequency: agent.backchannel_frequency ?? undefined,
      backchannel_words: agent.backchannel_words || undefined,
      reminder_trigger_ms: agent.reminder_trigger_ms ?? undefined,
      reminder_max_count: agent.reminder_max_count ?? undefined,
      // Ambient Sound
      ambient_sound: (agent.ambient_sound as any) || '',
      ambient_sound_volume: agent.ambient_sound_volume ?? undefined,
      // Transcription & Keywords
      stt_mode: (agent.stt_mode as any) || undefined,
      vocab_specialization: (agent.vocab_specialization as any) || undefined,
      denoising_mode: (agent.denoising_mode as any) || undefined,
      boosted_keywords: agent.boosted_keywords || undefined,
      normalize_for_speech: agent.normalize_for_speech ?? undefined,
      // Call Settings - convert milliseconds to seconds
      end_call_after_silence_seconds: agent.end_call_after_silence_ms ? Math.floor(agent.end_call_after_silence_ms / 1000) : undefined,
      max_call_duration_seconds: agent.max_call_duration_ms ? Math.floor(agent.max_call_duration_ms / 1000) : undefined,
      ring_duration_seconds: agent.ring_duration_ms ? Math.floor(agent.ring_duration_ms / 1000) : undefined,
      allow_user_dtmf: agent.allow_user_dtmf ?? undefined,
      // Voicemail
      voicemail_detect: !!agent.voicemail_option,
      voicemail_message: (agent.voicemail_option as any)?.action?.text || undefined,
      // Data Storage
      data_storage_setting: (agent.data_storage_setting as any) || undefined,
      opt_in_signed_url: agent.opt_in_signed_url ?? undefined,
      // Webhook
      webhook_url: agent.webhook_url || '',
      webhook_timeout_ms: agent.webhook_timeout_ms ?? undefined,
      // Post-Call Analysis
      post_call_analysis_model: agent.post_call_analysis_model || undefined,
    })
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error: any) {
        alert(`Failed to delete agent: ${error.message}`)
      }
    }
  }

  const handleTestCall = (retellAgentId: string | null) => {
    if (!retellAgentId) {
      alert('This agent does not have a RetellAI ID. Please recreate it.')
      return
    }
    setSelectedAgentId(retellAgentId)
    setTestCallModalOpen(true)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your AI voice agents and make test calls
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Create Agent
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading agents...</div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-destructive">Error loading agents: {error.message}</p>
          </CardContent>
        </Card>
      ) : !agents || agents.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              No agents yet. Create your first agent to get started.
            </p>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-base font-semibold">{agent.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(agent)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(agent.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span>{agent.lang || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mic className="h-3.5 w-3.5" />
                  <span>{agent.voice_id || 'N/A'}</span>
                </div>
                {agent.retell_agent_id && (
                  <div className="pt-1 text-xs text-muted-foreground">
                    Retell ID: {agent.retell_agent_id.substring(0, 12)}...
                  </div>
                )}
                <div className="pt-2 flex gap-2">
                  {agent.retell_agent_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestCall(agent.retell_agent_id)}
                      className="flex-1"
                    >
                      <Phone className="mr-2 h-3.5 w-3.5" />
                      Test Call
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Agent Modal - Multi-step (for both Create and Edit) */}
      <Dialog open={createModalOpen || editModalOpen} onOpenChange={(open) => {
        if (!open) {
          if (createModalOpen) handleCreateModalClose(false)
          if (editModalOpen) handleEditModalClose(false)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAgent ? 'Edit' : 'Create'} Agent - Step {currentStep} of 5</DialogTitle>
            <DialogDescription>
              {currentStep === 1 && 'Configure basic agent settings (name, voice, language, model)'}
              {currentStep === 2 && 'Define agent character, mission, and welcome message'}
              {currentStep === 3 && 'Configure voice settings and agent behavior'}
              {currentStep === 4 && 'Configure transcription and call settings'}
              {currentStep === 5 && 'Advanced settings, knowledge base, and webhook'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 my-4">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : step < currentStep
                      ? 'bg-primary/50 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step}
                </div>
                {step < 5 && (
                  <div
                    className={`w-12 h-1 mx-1 ${
                      step < currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          
          <form 
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('[AgentForm] Form submit event triggered')
              console.log('[AgentForm] Current step:', currentStep)
              console.log('[AgentForm] Editing agent:', editingAgent)
              
              agentForm.handleSubmit(
                (data) => {
                  console.log('[AgentForm] Validation passed, calling onSubmit')
                  onSubmit(data).catch((err) => {
                    console.error('[AgentForm] onSubmit promise rejection:', err)
                    alert(`Errore durante la creazione/aggiornamento: ${err.message || err.toString()}`)
                  })
                },
                (errors) => {
                  console.error('[AgentForm] Form validation errors:', errors)
                  // Show first error
                  const firstError = Object.keys(errors)[0]
                  if (firstError) {
                    const errorMessage = errors[firstError as keyof typeof errors]?.message
                    alert(`Errore di validazione: ${firstError} - ${errorMessage || 'Campo richiesto'}`)
                  } else {
                    alert('Errore di validazione: controlla i campi del form')
                  }
                }
              )(e)
            }} 
            className="space-y-4 mt-4"
          >
            {/* Step 1: Base Configuration */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="agent_name">Agent Name *</Label>
                  <Input
                    id="agent_name"
                    {...agentForm.register('agent_name')}
                    error={agentForm.formState.errors.agent_name?.message}
                    placeholder="My Assistant"
                  />
                </div>

                <div>
                  <Label htmlFor="voice_id">Voice ID *</Label>
                  <select
                    id="voice_id"
                    {...agentForm.register('voice_id')}
                    className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {VOICE_IDS.map((voice) => (
                      <option key={voice.value} value={voice.value}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                  {agentForm.formState.errors.voice_id && (
                    <p className="mt-1 text-sm text-destructive">
                      {agentForm.formState.errors.voice_id.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="language">Language</Label>
                  <select
                    id="language"
                    {...agentForm.register('language')}
                    className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  {agentForm.formState.errors.language && (
                    <p className="mt-1 text-sm text-destructive">
                      {agentForm.formState.errors.language.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="model">LLM Model</Label>
                  <select
                    id="model"
                    {...agentForm.register('model')}
                    className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {LLM_MODELS.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                  {agentForm.formState.errors.model && (
                    <p className="mt-1 text-sm text-destructive">
                      {agentForm.formState.errors.model.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Character Configuration */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="role">Primary Role *</Label>
                  <select
                    id="role"
                    {...agentForm.register('role')}
                    className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="inbound">Inbound (receives calls)</option>
                    <option value="outbound">Outbound (makes calls)</option>
                    <option value="both">Both (inbound and outbound)</option>
                  </select>
                  {agentForm.formState.errors.role && (
                    <p className="mt-1 text-sm text-destructive">
                      {agentForm.formState.errors.role.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="mission">Mission / Objective *</Label>
                  <Textarea
                    id="mission"
                    {...agentForm.register('mission')}
                    placeholder="Describe what this agent should do. For example: 'Qualify leads according to BANT criteria. Be friendly and professional.'"
                    className="min-h-[100px]"
                  />
                  {agentForm.formState.errors.mission && (
                    <p className="mt-1 text-sm text-destructive">
                      {agentForm.formState.errors.mission.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    This will be used to build the agent's prompt and guide its behavior.
                  </p>
                </div>

                <div>
                  <Label htmlFor="custom_prompt">Additional Instructions (Optional)</Label>
                  <Textarea
                    id="custom_prompt"
                    {...agentForm.register('custom_prompt')}
                    placeholder="Add any specific instructions, tone, or constraints for the agent..."
                    className="min-h-[100px]"
                  />
                  {agentForm.formState.errors.custom_prompt && (
                    <p className="mt-1 text-sm text-destructive">
                      {agentForm.formState.errors.custom_prompt.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    These instructions will be appended to the agent's prompt.
                  </p>
                </div>

                <div>
                  <Label htmlFor="welcome_message">Welcome Message (Optional)</Label>
                  <Textarea
                    id="welcome_message"
                    {...agentForm.register('welcome_message')}
                    placeholder="First message the agent will say. If empty, the structured prompt will be used."
                    className="min-h-[80px]"
                  />
                  {agentForm.formState.errors.welcome_message && (
                    <p className="mt-1 text-sm text-destructive">
                      {agentForm.formState.errors.welcome_message.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_speaker">Who Speaks First?</Label>
                    <select
                      id="start_speaker"
                      {...agentForm.register('start_speaker')}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="agent">Agent (AI speaks first)</option>
                      <option value="user">User (wait for user to speak)</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="begin_message_delay_ms">Pause Before Speaking (ms)</Label>
                    <Input
                      id="begin_message_delay_ms"
                      type="number"
                      min={0}
                      max={5000}
                      {...agentForm.register('begin_message_delay_ms', { valueAsNumber: true })}
                      placeholder="0"
                    />
                    {agentForm.formState.errors.begin_message_delay_ms && (
                      <p className="mt-1 text-sm text-destructive">
                        {agentForm.formState.errors.begin_message_delay_ms.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Voice & Behavior */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-md mb-4">
                  <p className="text-sm text-muted-foreground">
                    Configure voice characteristics and agent behavior during conversations.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="voice_model">Voice Model (Optional)</Label>
                    <Input
                      id="voice_model"
                      {...agentForm.register('voice_model')}
                      placeholder="eleven_turbo_v2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="voice_temperature">Voice Temperature (0-2)</Label>
                    <Input
                      id="voice_temperature"
                      type="number"
                      step="0.1"
                      min={0}
                      max={2}
                      {...agentForm.register('voice_temperature', { valueAsNumber: true })}
                      placeholder="1.0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="voice_speed">Voice Speed (0.5-2)</Label>
                    <Input
                      id="voice_speed"
                      type="number"
                      step="0.1"
                      min={0.5}
                      max={2}
                      {...agentForm.register('voice_speed', { valueAsNumber: true })}
                      placeholder="1.0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="volume">Volume (0-2)</Label>
                    <Input
                      id="volume"
                      type="number"
                      step="0.1"
                      min={0}
                      max={2}
                      {...agentForm.register('volume', { valueAsNumber: true })}
                      placeholder="1.0"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Behavior Settings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="responsiveness">Responsiveness (0-1)</Label>
                      <Input
                        id="responsiveness"
                        type="number"
                        step="0.1"
                        min={0}
                        max={1}
                        {...agentForm.register('responsiveness', { valueAsNumber: true })}
                        placeholder="1.0"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Higher = faster response</p>
                    </div>

                    <div>
                      <Label htmlFor="interruption_sensitivity">Interruption Sensitivity (0-1)</Label>
                      <Input
                        id="interruption_sensitivity"
                        type="number"
                        step="0.1"
                        min={0}
                        max={1}
                        {...agentForm.register('interruption_sensitivity', { valueAsNumber: true })}
                        placeholder="1.0"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Higher = easier to interrupt</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enable_backchannel"
                        {...agentForm.register('enable_backchannel')}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="enable_backchannel" className="font-normal cursor-pointer">
                        Enable Backchanneling (use "yeah", "uh-huh" during conversations)
                      </Label>
                    </div>

                    {agentForm.watch('enable_backchannel') && (
                      <div className="ml-6 grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="backchannel_frequency">Backchannel Frequency (0-1)</Label>
                          <Input
                            id="backchannel_frequency"
                            type="number"
                            step="0.1"
                            min={0}
                            max={1}
                            {...agentForm.register('backchannel_frequency', { valueAsNumber: true })}
                            placeholder="0.8"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="normalize_for_speech"
                        {...agentForm.register('normalize_for_speech')}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="normalize_for_speech" className="font-normal cursor-pointer">
                        Enable Speech Normalization (convert numbers/dates to spoken form)
                      </Label>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ambient_sound">Background Sound (Optional)</Label>
                      <select
                        id="ambient_sound"
                        {...agentForm.register('ambient_sound')}
                        className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">None</option>
                        <option value="coffee-shop">Coffee Shop</option>
                        <option value="convention-hall">Convention Hall</option>
                        <option value="summer-outdoor">Summer Outdoor</option>
                        <option value="mountain-outdoor">Mountain Outdoor</option>
                        <option value="static-noise">Static Noise</option>
                        <option value="call-center">Call Center</option>
                      </select>
                    </div>

                    {agentForm.watch('ambient_sound') && (
                      <div>
                        <Label htmlFor="ambient_sound_volume">Ambient Sound Volume (0-2)</Label>
                        <Input
                          id="ambient_sound_volume"
                          type="number"
                          step="0.1"
                          min={0}
                          max={2}
                          {...agentForm.register('ambient_sound_volume', { valueAsNumber: true })}
                          placeholder="1.0"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Transcription & Call Settings */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-md mb-4">
                  <p className="text-sm text-muted-foreground">
                    Configure transcription accuracy and call behavior settings.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stt_mode">Transcription Mode</Label>
                    <select
                      id="stt_mode"
                      {...agentForm.register('stt_mode')}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="fast">Fast (optimize for speed)</option>
                      <option value="accurate">Accurate (optimize for accuracy)</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="vocab_specialization">Vocabulary Specialization</Label>
                    <select
                      id="vocab_specialization"
                      {...agentForm.register('vocab_specialization')}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="general">General</option>
                      <option value="medical">Medical</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="denoising_mode">Denoising Mode</Label>
                    <select
                      id="denoising_mode"
                      {...agentForm.register('denoising_mode')}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="noise-cancellation">Remove noise</option>
                      <option value="noise-and-background-speech-cancellation">Remove noise + background speech</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="boosted_keywords">Boosted Keywords (comma-separated, optional)</Label>
                  <Input
                    id="boosted_keywords"
                    type="text"
                    placeholder="Agoralia, RetellAI, Mario Rossi"
                    {...agentForm.register('boosted_keywords', {
                      setValueAs: (value: string) => {
                        // Convert string to array, or undefined if empty
                        if (!value || value.trim() === '') {
                          return undefined
                        }
                        return value.split(',').map(k => k.trim()).filter(k => k.length > 0)
                      }
                    })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Keywords to improve transcription accuracy (e.g., company names, people names). Campo opzionale.
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Call Settings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="end_call_after_silence_seconds">End Call After Silence (seconds)</Label>
                      <Input
                        id="end_call_after_silence_seconds"
                        type="number"
                        min={10}
                        step={1}
                        {...agentForm.register('end_call_after_silence_seconds', { valueAsNumber: true })}
                        placeholder="600 (10 minuti)"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {agentForm.watch('end_call_after_silence_seconds') 
                          ? formatDuration(agentForm.watch('end_call_after_silence_seconds') || 0) 
                          : '600 secondi = 10 minuti'}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="max_call_duration_seconds">Max Call Duration (seconds)</Label>
                      <Input
                        id="max_call_duration_seconds"
                        type="number"
                        min={60}
                        max={7200}
                        step={1}
                        {...agentForm.register('max_call_duration_seconds', { valueAsNumber: true })}
                        placeholder="3600 (60 minuti)"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {agentForm.watch('max_call_duration_seconds') 
                          ? formatDuration(agentForm.watch('max_call_duration_seconds') || 0) 
                          : '3600 secondi = 60 minuti'}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="ring_duration_seconds">Ring Duration (seconds)</Label>
                      <Input
                        id="ring_duration_seconds"
                        type="number"
                        min={5}
                        max={90}
                        step={1}
                        {...agentForm.register('ring_duration_seconds', { valueAsNumber: true })}
                        placeholder="30 (30 secondi)"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {agentForm.watch('ring_duration_seconds') 
                          ? formatDuration(agentForm.watch('ring_duration_seconds') || 0) 
                          : '30 secondi'}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <input
                        type="checkbox"
                        id="allow_user_dtmf"
                        {...agentForm.register('allow_user_dtmf')}
                        className="rounded border-gray-300"
                        defaultChecked
                      />
                      <Label htmlFor="allow_user_dtmf" className="font-normal cursor-pointer">
                        Allow User Keypad Input (DTMF)
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Voicemail Detection</h4>
                  <div className="flex items-center space-x-2 mb-3">
                    <input
                      type="checkbox"
                      id="voicemail_detect"
                      {...agentForm.register('voicemail_detect')}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="voicemail_detect" className="font-normal cursor-pointer">
                      Detect voicemail and leave a message
                    </Label>
                  </div>
                  {agentForm.watch('voicemail_detect') && (
                    <div>
                      <Label htmlFor="voicemail_message">Voicemail Message</Label>
                      <Textarea
                        id="voicemail_message"
                        {...agentForm.register('voicemail_message')}
                        placeholder="Please give us a callback tomorrow at 10am."
                        className="min-h-[80px]"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Advanced & Knowledge Base */}
            {currentStep === 5 && (
              <div className="space-y-6">
                {/* Knowledge Base Section */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Knowledge Base</h4>
                  <div className="p-3 bg-muted rounded-md mb-3">
                    <p className="text-sm text-muted-foreground">
                      <strong>General Knowledge Base</strong> is always connected automatically.
                      You can select additional knowledge bases below.
                    </p>
                  </div>
                  
                  {kbs && kbs.length > 0 ? (
                    <div>
                      <Label>Additional Knowledge Bases</Label>
                      <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                        {kbs
                          .filter((kb) => kb.scope !== 'general')
                          .map((kb) => (
                            <div key={kb.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`kb-${kb.id}`}
                                checked={agentForm.watch('knowledge_base_ids')?.includes(kb.id) || false}
                                onChange={(e) => {
                                  const currentIds = agentForm.getValues('knowledge_base_ids') || []
                                  if (e.target.checked) {
                                    agentForm.setValue('knowledge_base_ids', [...currentIds, kb.id])
                                  } else {
                                    agentForm.setValue(
                                      'knowledge_base_ids',
                                      currentIds.filter((id) => id !== kb.id)
                                    )
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                              <Label htmlFor={`kb-${kb.id}`} className="font-normal cursor-pointer">
                                KB #{kb.id} {kb.lang && `(${kb.lang})`} {kb.scope && `[${kb.scope}]`}
                                {kb.retell_kb_id && ' ✓ Synced'}
                              </Label>
                            </div>
                          ))}
                      </div>
                      {kbs.filter((kb) => kb.scope !== 'general').length === 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          No additional knowledge bases available. The general KB will be used.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No knowledge bases available. The general KB will be used.
                    </p>
                  )}
                </div>

                {/* Webhook Settings */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Webhook Settings</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="webhook_url">Webhook URL (Optional)</Label>
                      <Input
                        id="webhook_url"
                        type="text"
                        {...agentForm.register('webhook_url', {
                          validate: (value) => {
                            if (!value || value.trim() === '') return true // Empty is OK
                            try {
                              new URL(value.trim())
                              return true
                            } catch {
                              return 'Inserisci un URL valido (es. https://app.agoralia.app/api/webhooks/retell)'
                            }
                          }
                        })}
                        placeholder="https://app.agoralia.app/api/webhooks/retell"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        URL to receive call events from RetellAI
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="webhook_timeout_ms">Webhook Timeout (ms)</Label>
                      <Input
                        id="webhook_timeout_ms"
                        type="number"
                        min={1000}
                        max={30000}
                        {...agentForm.register('webhook_timeout_ms', { 
                          valueAsNumber: true,
                          setValueAs: (v) => {
                            if (v === '' || v === null || v === undefined) return undefined
                            const num = Number(v)
                            return isNaN(num) ? undefined : num
                          }
                        })}
                        placeholder="10000"
                      />
                    </div>
                  </div>
                </div>

                {/* Data Storage & Security */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Data Storage & Security</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="data_storage_setting">Data Storage Setting</Label>
                      <select
                        id="data_storage_setting"
                        {...agentForm.register('data_storage_setting')}
                        className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="everything">Everything (store all data)</option>
                        <option value="everything_except_pii">Everything except PII</option>
                        <option value="basic_attributes_only">Basic attributes only</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="opt_in_signed_url"
                        {...agentForm.register('opt_in_signed_url')}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="opt_in_signed_url" className="font-normal cursor-pointer">
                        Opt In Secure URLs (URLs expire after 24 hours)
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Post-Call Analysis */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Post-Call Analysis</h4>
                  <div>
                    <Label htmlFor="post_call_analysis_model">Analysis Model</Label>
                    <select
                      id="post_call_analysis_model"
                      {...agentForm.register('post_call_analysis_model')}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4.1">GPT-4.1</option>
                      <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Model used for post-call analysis and data extraction
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between space-x-2 pt-4 border-t">
              <div>
                {currentStep > 1 && (
                  <Button type="button" variant="outline" onClick={handlePrevStep}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                )}
              </div>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (editingAgent) {
                      handleEditModalClose(false)
                    } else {
                      handleCreateModalClose(false)
                    }
                  }}
                >
                  Cancel
                </Button>
                {currentStep < 5 ? (
                  <Button type="button" onClick={handleNextStep}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={createMutation.isPending || isUpdating}>
                    {(createMutation.isPending || isUpdating) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingAgent ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingAgent ? 'Update Agent' : 'Create Agent'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Test Call Modal */}
      <Dialog open={testCallModalOpen} onOpenChange={setTestCallModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Call</DialogTitle>
            <DialogDescription>
              Make a test call to this agent. Enter the phone number to call.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={testCallForm.handleSubmit(onTestCallSubmit)} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="to_number">Phone Number (E.164) *</Label>
              <Input
                id="to_number"
                {...testCallForm.register('to_number')}
                error={testCallForm.formState.errors.to_number?.message}
                placeholder="+393491234567"
              />
            </div>

            <div>
              <Label htmlFor="from_number">From Number (Optional)</Label>
              <Input
                id="from_number"
                {...testCallForm.register('from_number')}
                error={testCallForm.formState.errors.from_number?.message}
                placeholder="Leave empty to use default"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTestCallModalOpen(false)
                  setSelectedAgentId(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={testCallMutation.isPending}>
                {testCallMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calling...
                  </>
                ) : (
                  'Make Test Call'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
