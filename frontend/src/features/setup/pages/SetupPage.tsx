import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { CheckCircle2, Circle, ArrowRight, Phone, BookOpen, Bot, Users } from 'lucide-react'
import { useAgents } from '@/features/agents/hooks'
import { useNumbers } from '@/features/numbers/hooks'
import { useKnowledgeBases } from '@/features/knowledge/hooks'
import { useLeads } from '@/features/leads/hooks'

const steps = [
  { id: 'agent', label: 'Agent', route: '/agents', icon: Bot },
  { id: 'numbers', label: 'Phone Numbers', route: '/numbers', icon: Phone },
  { id: 'knowledge', label: 'Knowledge Base', route: '/knowledge', icon: BookOpen },
  { id: 'leads', label: 'Leads', route: '/leads', icon: Users },
]

export function SetupPage() {
  const navigate = useNavigate()
  const { data: numbers } = useNumbers()
  const { data: kbs } = useKnowledgeBases()
  const { data: agents } = useAgents()
  const { data: leadsData } = useLeads({ limit: 1 })

  const completed = {
    numbers: (numbers?.length || 0) > 0,
    knowledge: (kbs?.length || 0) > 0,
    agent: (agents?.length || 0) > 0,
    leads: (leadsData?.total || 0) > 0,
  }

  const totalCompleted = Object.values(completed).filter(Boolean).length
  const isComplete = totalCompleted === steps.length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete these steps to get started with your first campaign
        </p>
      </div>

      {isComplete && (
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Setup complete</p>
              <p className="text-xs text-muted-foreground">
                You're ready to create your first campaign.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {steps.map((step) => {
          const isCompleted = completed[step.id as keyof typeof completed]
          const Icon = step.icon

          return (
            <Card
              key={step.id}
              className={`transition-colors ${
                isCompleted
                  ? 'border-border bg-muted/30'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`rounded-md p-2 ${
                        isCompleted
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{step.label}</h3>
                        {isCompleted && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {isCompleted
                          ? 'Completed'
                          : `Set up your ${step.label.toLowerCase()} to continue`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={isCompleted ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => navigate(step.route)}
                  >
                    {isCompleted ? 'View' : 'Setup'}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {isComplete && (
        <div className="flex justify-end">
          <Button size="lg" onClick={() => navigate('/campaigns/new')}>
            Create your first campaign
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
