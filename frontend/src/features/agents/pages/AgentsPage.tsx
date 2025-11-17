import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { useAgents, useDeleteAgent } from '../hooks'
import { CreateAgentModal } from '../components/CreateAgentModal'
import { Plus, Trash2, Bot, Globe, Mic } from 'lucide-react'

export function AgentsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const { data: agents, isLoading, error } = useAgents()
  const deleteMutation = useDeleteAgent()

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error: any) {
        alert(`Failed to delete agent: ${error.message}`)
      }
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your AI voice agents
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Create agent
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
              Create agent
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateAgentModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => setCreateModalOpen(false)}
      />
    </div>
  )
}
