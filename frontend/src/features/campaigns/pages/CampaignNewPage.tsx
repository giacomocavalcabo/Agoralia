import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { useCreateCampaign } from '../hooks'
import { useAgents } from '@/features/agents/hooks'
import { useNumbers } from '@/features/numbers/hooks'
import { useKnowledgeBases } from '@/features/knowledge/hooks'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  agent_id: z.string().optional(),
  from_number_id: z.number().optional(),
  kb_id: z.number().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  timezone: z.string().optional(),
  max_calls_per_day: z.number().optional(),
  budget_cents: z.number().optional(),
}).refine((data) => {
  // At least one resource must be selected in step 2
  return true // Validation happens in canProceed()
}, {
  message: 'Please select all required resources',
})

type CampaignFormInputs = z.infer<typeof campaignSchema>

const steps = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'resources', label: 'Resources' },
  { id: 'settings', label: 'Settings' },
]

export function CampaignNewPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const { data: agents } = useAgents()
  const { data: numbers } = useNumbers()
  const { data: kbs } = useKnowledgeBases()
  const createMutation = useCreateCampaign()

  const { register, handleSubmit, formState: { errors }, watch } = useForm<CampaignFormInputs>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      timezone: 'UTC',
    },
  })

  const watchedAgentId = watch('agent_id')
  const watchedNumberId = watch('from_number_id')
  const watchedKbId = watch('kb_id')

  const onSubmit = async (data: CampaignFormInputs) => {
    try {
      const result = await createMutation.mutateAsync({
        ...data,
        status: 'draft',
        budget_cents: data.budget_cents ? Math.round(data.budget_cents * 100) : undefined,
      })
      // Backend returns { ok: true, id: ... } but we need the full campaign
      // Navigate to campaigns list for now, detail page will fetch it
      navigate(`/campaigns/${result.id}`)
    } catch (error: any) {
      alert(`Failed to create campaign: ${error.message}`)
    }
  }

  const canProceed = () => {
    if (currentStep === 0) {
      return watch('name') && watch('name').length > 0
    }
    if (currentStep === 1) {
      return watchedAgentId && watchedNumberId && watchedKbId
    }
    return true
  }

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Create Campaign" subtitle="Set up a new calling campaign" />

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  index < currentStep
                    ? 'bg-green-500 text-white'
                    : index === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span className="ml-2 text-sm font-medium">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-4 ${
                  index < currentStep ? 'bg-green-500' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Basic Info */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Give your campaign a name and set the schedule</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="My Campaign"
                  error={errors.name?.message}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    {...register('start_date')}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    {...register('end_date')}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  {...register('timezone')}
                  placeholder="UTC"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Resources */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
              <CardDescription>Select agent, phone number, and knowledge base</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="agent_id">Agent *</Label>
                <select
                  id="agent_id"
                  {...register('agent_id')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select an agent</option>
                  {agents?.map((agent) => (
                    <option key={agent.id} value={String(agent.id)}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                {!watchedAgentId && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No agents? <a href="/agents" className="text-primary">Create one</a>
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="from_number_id">Phone Number *</Label>
                <select
                  id="from_number_id"
                  {...register('from_number_id', { valueAsNumber: true })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a phone number</option>
                  {numbers?.map((number) => (
                    <option key={number.id} value={number.id}>
                      {number.e164}
                    </option>
                  ))}
                </select>
                {!watchedNumberId && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No numbers? <a href="/numbers" className="text-primary">Add one</a>
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="kb_id">Knowledge Base *</Label>
                <select
                  id="kb_id"
                  {...register('kb_id', { valueAsNumber: true })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a knowledge base</option>
                  {kbs?.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      KB #{kb.id} {kb.lang && `(${kb.lang})`}
                    </option>
                  ))}
                </select>
                {!watchedKbId && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No knowledge bases? <a href="/knowledge" className="text-primary">Create one</a>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Settings */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Configure limits and budget</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="max_calls_per_day">Max Calls Per Day</Label>
                <Input
                  id="max_calls_per_day"
                  type="number"
                  {...register('max_calls_per_day', { valueAsNumber: true })}
                  placeholder="100"
                />
              </div>
              <div>
                <Label htmlFor="budget_cents">Budget (€)</Label>
                <Input
                  id="budget_cents"
                  type="number"
                  step="0.01"
                  {...register('budget_cents', { valueAsNumber: true })}
                  placeholder="100.00"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0}>
            Previous
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button type="button" onClick={nextStep} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button type="submit" disabled={createMutation.isPending || !canProceed()}>
              {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

