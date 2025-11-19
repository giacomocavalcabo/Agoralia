import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog'
import { useAgents, useCreateAgentFull, useDeleteAgent, useTestAgentCall } from '../hooks'
import { useKnowledgeBases } from '@/features/knowledge/hooks'
import { Plus, Trash2, Bot, Globe, Mic, Phone, Loader2, ChevronRight, ChevronLeft } from 'lucide-react'
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

// Agent creation schema with step-based fields
const agentSchema = z.object({
  // Step 1: Base configuration
  agent_name: z.string().min(1, 'Agent name is required'),
  voice_id: z.string().min(1, 'Voice ID is required'),
  language: z.string().default('en-US'),
  model: z.string().default('gpt-4o-mini'),
  
  // Step 2: Character configuration
  role: z.enum(['inbound', 'outbound', 'both']).default('both'),
  mission: z.string().min(1, 'Mission is required'),
  custom_prompt: z.string().optional(),
  
  // Step 3: Knowledge Base
  knowledge_base_ids: z.array(z.number()).default([]),
  
  // Optional advanced fields
  voice_model: z.string().optional(),
  voice_speed: z.number().min(0.5).max(2).optional(),
  voice_temperature: z.number().min(0).max(2).optional(),
  responsiveness: z.number().min(0).max(1).optional(),
  interruption_sensitivity: z.number().min(0).max(1).optional(),
  webhook_url: z.string().url().optional().or(z.literal('')),
})

type AgentFormInputs = z.infer<typeof agentSchema>

// Test call schema
const testCallSchema = z.object({
  to_number: z.string().min(1, 'Phone number is required'),
  from_number: z.string().optional(),
})

type TestCallFormInputs = z.infer<typeof testCallSchema>

export function AgentsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [testCallModalOpen, setTestCallModalOpen] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const { data: agents, isLoading, error } = useAgents()
  const { data: kbs } = useKnowledgeBases()
  const createMutation = useCreateAgentFull()
  const deleteMutation = useDeleteAgent()
  const testCallMutation = useTestAgentCall()

  const agentForm = useForm<AgentFormInputs>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      language: 'en-US',
      model: 'gpt-4o-mini',
      voice_id: '11labs-Adrian',
      role: 'both',
      mission: '',
      custom_prompt: '',
      knowledge_base_ids: [],
    },
  })

  const testCallForm = useForm<TestCallFormInputs>({
    resolver: zodResolver(testCallSchema),
  })

  // Build custom prompt from role, mission, and custom prompt
  const buildCustomPrompt = (data: AgentFormInputs): string => {
    // Determine language for prompt based on agent language
    const isItalian = data.language?.startsWith('it')
    
    let roleDescription = ''
    if (isItalian) {
      roleDescription = 
        data.role === 'inbound' ? 'Principalmente ricevi chiamate in arrivo. ' :
        data.role === 'outbound' ? 'Principalmente fai chiamate in uscita. ' :
        'Gestisci sia chiamate in arrivo che in uscita. '
    } else {
      roleDescription = 
        data.role === 'inbound' ? 'You primarily receive inbound calls. ' :
        data.role === 'outbound' ? 'You primarily make outbound calls. ' :
        'You handle both inbound and outbound calls. '
    }
    
    const missionText = data.mission || ''
    const customLabel = isItalian ? '\n\nIstruzioni aggiuntive:\n' : '\n\nAdditional Instructions:\n'
    const customText = data.custom_prompt ? `${customLabel}${data.custom_prompt}` : ''
    
    return `${roleDescription}${missionText}${customText}`.trim()
  }

  const onSubmit = async (data: AgentFormInputs) => {
    try {
      // Build custom prompt
      const customPrompt = buildCustomPrompt(data)
      
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
      const responseEngine: any = {
        type: 'retell-llm' as const,
        model: data.model,
      }
      
      // Add prompt as begin_message or instruction
      if (customPrompt) {
        responseEngine.begin_message = customPrompt
      }
      
      // Add knowledge bases if any
      if (kbIds.length > 0) {
        responseEngine.knowledge_base_ids = kbIds
      }
      
      const payload = {
        response_engine,
        agent_name: data.agent_name,
        voice_id: data.voice_id,
        language: data.language,
        connect_to_general_kb: true, // Always true
        save_to_agoralia: true, // Always true
        ...(data.voice_model && { voice_model: data.voice_model }),
        ...(data.voice_speed !== undefined && { voice_speed: data.voice_speed }),
        ...(data.voice_temperature !== undefined && { voice_temperature: data.voice_temperature }),
        ...(data.responsiveness !== undefined && { responsiveness: data.responsiveness }),
        ...(data.interruption_sensitivity !== undefined && { interruption_sensitivity: data.interruption_sensitivity }),
        ...(data.webhook_url && { webhook_url: data.webhook_url }),
      }

      const result = await createMutation.mutateAsync(payload)
      if (result.success) {
        agentForm.reset()
        setCreateModalOpen(false)
        setCurrentStep(1)
      } else {
        alert(`Failed to create agent: ${JSON.stringify(result)}`)
      }
    } catch (error: any) {
      alert(`Failed to create agent: ${error.message}`)
    }
  }
  
  const handleNextStep = async () => {
    const step1Fields: (keyof AgentFormInputs)[] = ['agent_name', 'voice_id', 'language', 'model']
    const step2Fields: (keyof AgentFormInputs)[] = ['role', 'mission']
    
    let fieldsToValidate: (keyof AgentFormInputs)[] = []
    if (currentStep === 1) {
      fieldsToValidate = step1Fields
    } else if (currentStep === 2) {
      fieldsToValidate = step2Fields
    }
    
    const isValid = await agentForm.trigger(fieldsToValidate as any)
    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }
  
  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }
  
  const handleModalClose = (open: boolean) => {
    setCreateModalOpen(open)
    if (!open) {
      setCurrentStep(1)
      agentForm.reset()
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(agent.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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

      {/* Create Agent Modal - Multi-step */}
      <Dialog open={createModalOpen} onOpenChange={handleModalClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Agent - Step {currentStep} of 3</DialogTitle>
            <DialogDescription>
              {currentStep === 1 && 'Configure basic agent settings'}
              {currentStep === 2 && 'Define agent character and mission'}
              {currentStep === 3 && 'Select knowledge bases (general KB is always included)'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 my-4">
            {[1, 2, 3].map((step) => (
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
                {step < 3 && (
                  <div
                    className={`w-12 h-1 mx-1 ${
                      step < currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          
          <form onSubmit={agentForm.handleSubmit(onSubmit)} className="space-y-4 mt-4">
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
              </div>
            )}

            {/* Step 3: Knowledge Base Configuration */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    <strong>General Knowledge Base</strong> is always connected automatically.
                    You can select additional knowledge bases below.
                  </p>
                </div>
                
                {kbs && kbs.length > 0 ? (
                  <div>
                    <Label>Additional Knowledge Bases</Label>
                    <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
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
                  onClick={() => handleModalClose(false)}
                >
                  Cancel
                </Button>
                {currentStep < 3 ? (
                  <Button type="button" onClick={handleNextStep}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Agent'
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
