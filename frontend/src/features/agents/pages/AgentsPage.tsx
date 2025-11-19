import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog'
import { useAgents, useCreateAgentFull, useDeleteAgent, useTestAgentCall } from '../hooks'
import { Plus, Trash2, Bot, Globe, Mic, Phone, Loader2 } from 'lucide-react'
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

// Agent creation schema with essential fields
const agentSchema = z.object({
  agent_name: z.string().min(1, 'Agent name is required'),
  voice_id: z.string().min(1, 'Voice ID is required'),
  language: z.string().default('en-US'),
  // Response engine - simplified, will create retell-llm
  model: z.string().default('gpt-4o-mini'),
  // Optional advanced fields
  voice_model: z.string().optional(),
  voice_speed: z.number().min(0.5).max(2).optional(),
  voice_temperature: z.number().min(0).max(2).optional(),
  responsiveness: z.number().min(0).max(1).optional(),
  interruption_sensitivity: z.number().min(0).max(1).optional(),
  webhook_url: z.string().url().optional().or(z.literal('')),
  connect_to_general_kb: z.boolean().default(true),
  save_to_agoralia: z.boolean().default(true),
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
  const { data: agents, isLoading, error } = useAgents()
  const createMutation = useCreateAgentFull()
  const deleteMutation = useDeleteAgent()
  const testCallMutation = useTestAgentCall()

  const agentForm = useForm<AgentFormInputs>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      language: 'en-US',
      model: 'gpt-4o-mini',
      voice_id: '11labs-Adrian',
      connect_to_general_kb: true,
      save_to_agoralia: true,
    },
  })

  const testCallForm = useForm<TestCallFormInputs>({
    resolver: zodResolver(testCallSchema),
  })

  const onSubmit = async (data: AgentFormInputs) => {
    try {
      // Create Retell LLM (response engine) - no begin_message
      const payload = {
        response_engine: {
          type: 'retell-llm' as const,
          model: data.model,
        },
        agent_name: data.agent_name,
        voice_id: data.voice_id,
        language: data.language,
        connect_to_general_kb: data.connect_to_general_kb,
        save_to_agoralia: data.save_to_agoralia,
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
      } else {
        alert(`Failed to create agent: ${JSON.stringify(result)}`)
      }
    } catch (error: any) {
      alert(`Failed to create agent: ${error.message}`)
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

      {/* Create Agent Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Agent</DialogTitle>
            <DialogDescription>
              Create a new AI voice agent with RetellAI. The agent will be connected to your general knowledge base.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={agentForm.handleSubmit(onSubmit)} className="space-y-4 mt-4">
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

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="connect_to_general_kb"
                {...agentForm.register('connect_to_general_kb')}
                className="rounded border-gray-300"
              />
              <Label htmlFor="connect_to_general_kb" className="font-normal">
                Connect to general knowledge base
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="save_to_agoralia"
                {...agentForm.register('save_to_agoralia')}
                className="rounded border-gray-300"
              />
              <Label htmlFor="save_to_agoralia" className="font-normal">
                Save to Agoralia database
              </Label>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
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
