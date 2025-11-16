import { useState } from 'react'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { useAgents, useDeleteAgent } from '../hooks'
import { CreateAgentModal } from '../components/CreateAgentModal'
import { Plus, Trash2 } from 'lucide-react'

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
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        subtitle="Manage your AI voice agents"
        action={
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        }
      />

      {isLoading ? (
        <div>Loading agents...</div>
      ) : error ? (
        <div className="text-destructive">Error loading agents: {error.message}</div>
      ) : !agents || agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No agents yet. Create your first agent to get started.</p>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{agent.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(agent.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Language:</span> {agent.lang || 'N/A'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Voice:</span> {agent.voice_id || 'N/A'}
                  </div>
                  {agent.retell_agent_id && (
                    <div className="text-xs text-muted-foreground">
                      Retell ID: {agent.retell_agent_id.substring(0, 8)}...
                    </div>
                  )}
                </div>
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

