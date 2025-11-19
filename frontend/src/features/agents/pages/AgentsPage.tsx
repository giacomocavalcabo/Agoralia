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

// Agent creation schema with essential fields
const agentSchema = z.object({
  agent_name: z.string().min(1, 'Agent name is required'),
  voice_id: z.string().min(1, 'Voice ID is required'),
  language: z.string().default('en-US'),
  // Response engine - simplified, will create retell-llm
  model: z.string().default('gpt-4o-mini'),
  begin_message: z.string().optional(),
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
      // First, we need to create a Retell LLM (response engine)
      // For simplicity, we'll create it inline in the response_engine
      const payload = {
        response_engine: {
          type: 'retell-llm' as const,
          model: data.model,
          begin_message: data.begin_message || `Hello, I'm ${data.agent_name}. How can I help you?`,
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
              <Input
                id="voice_id"
                {...agentForm.register('voice_id')}
                error={agentForm.formState.errors.voice_id?.message}
                placeholder="11labs-Adrian"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Find available voices in the RetellAI dashboard
              </p>
            </div>

            <div>
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                {...agentForm.register('language')}
                error={agentForm.formState.errors.language?.message}
                placeholder="en-US"
              />
            </div>

            <div>
              <Label htmlFor="model">LLM Model</Label>
              <Input
                id="model"
                {...agentForm.register('model')}
                error={agentForm.formState.errors.model?.message}
                placeholder="gpt-4o-mini"
              />
            </div>

            <div>
              <Label htmlFor="begin_message">Begin Message (Optional)</Label>
              <Input
                id="begin_message"
                {...agentForm.register('begin_message')}
                error={agentForm.formState.errors.begin_message?.message}
                placeholder="Hello, how can I help you?"
              />
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
