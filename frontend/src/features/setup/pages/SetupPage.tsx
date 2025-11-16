import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { useAgents } from '@/features/agents/hooks'
import { useNumbers } from '@/features/numbers/hooks'
import { useKnowledgeBases } from '@/features/knowledge/hooks'
import { useLeads } from '@/features/leads/hooks'

const steps = [
  { id: 'numbers', label: 'Phone Numbers', route: '/numbers' },
  { id: 'knowledge', label: 'Knowledge Base', route: '/knowledge' },
  { id: 'agent', label: 'Agent', route: '/agents' },
  { id: 'leads', label: 'Leads', route: '/leads' },
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
    <div className="space-y-6">
      <PageHeader
        title="Setup"
        subtitle="Complete these steps to get started with your first campaign"
      />

      {isComplete && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-6">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-semibold text-green-900 dark:text-green-100">
                  Setup Complete!
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  You're ready to create your first campaign.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {steps.map((step, index) => {
          const isCompleted = completed[step.id as keyof typeof completed]
          const nextStep = steps[index + 1]

          return (
            <Card key={step.id} className={isCompleted ? 'border-green-500' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 mt-0.5" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground mt-0.5" />
                    )}
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <span>{step.label}</span>
                      </CardTitle>
                      <CardDescription>
                        {isCompleted
                          ? 'Completed'
                          : `Set up your ${step.label.toLowerCase()} to continue`}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant={isCompleted ? 'outline' : 'default'}
                    onClick={() => navigate(step.route)}
                  >
                    {isCompleted ? 'View' : 'Setup'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      {isComplete && (
        <div className="flex justify-end">
          <Button size="lg" onClick={() => navigate('/campaigns/new')}>
            Create Your First Campaign
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}

