import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { useWorkspaceTelephony, useUpdateWorkspaceTelephony } from '../../hooks'
import { useAgents } from '@/features/agents/hooks'
import { useNumbers } from '@/features/numbers/hooks'
import { Loader2, Save, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

const telephonySchema = z.object({
  default_agent_id: z.number().nullable().optional(),
  default_from_number: z.string().nullable().optional(),
  default_spacing_ms: z.number().min(0).max(60000).optional(),
})

type TelephonyForm = z.infer<typeof telephonySchema>

export function TelephonySection() {
  const { data, isLoading, error } = useWorkspaceTelephony()
  const { data: agents } = useAgents()
  const { data: numbers } = useNumbers()
  const updateMutation = useUpdateWorkspaceTelephony()
  const [hasChanges, setHasChanges] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<TelephonyForm>({
    resolver: zodResolver(telephonySchema),
    defaultValues: {
      default_agent_id: null,
      default_from_number: null,
      default_spacing_ms: 1000,
    },
  })

  // Sync form with data when it loads
  useEffect(() => {
    if (data) {
      reset({
        default_agent_id: data.default_agent_id ?? null,
        default_from_number: data.default_from_number ?? null,
        default_spacing_ms: data.default_spacing_ms ?? 1000,
      })
      setHasChanges(false)
    }
  }, [data, reset])

  // Watch for changes
  const watchedFields = watch()
  useEffect(() => {
    if (data) {
      const currentValues = {
        default_agent_id: watchedFields.default_agent_id ?? null,
        default_from_number: watchedFields.default_from_number ?? null,
        default_spacing_ms: watchedFields.default_spacing_ms ?? 1000,
      }
      const initialValues = {
        default_agent_id: data.default_agent_id ?? null,
        default_from_number: data.default_from_number ?? null,
        default_spacing_ms: data.default_spacing_ms ?? 1000,
      }
      setHasChanges(JSON.stringify(currentValues) !== JSON.stringify(initialValues))
    }
  }, [watchedFields, data])

  const onSubmit = async (formData: TelephonyForm) => {
    try {
      await updateMutation.mutateAsync({
        default_agent_id: formData.default_agent_id ?? null,
        default_from_number: formData.default_from_number ?? null,
        default_spacing_ms: formData.default_spacing_ms,
      })
      setHasChanges(false)
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-destructive">
            Error loading settings: {error.message}
          </p>
        </CardContent>
      </Card>
    )
  }

  const verifiedNumbers = numbers?.filter((n: any) => n.verified) || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telephony</CardTitle>
        <CardDescription>
          Configure default agent, phone number, and call spacing for new campaigns.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default_agent_id">Default Agent</Label>
            <div className="flex gap-2">
              <Select
                id="default_agent_id"
                {...register('default_agent_id', { valueAsNumber: true })}
                className="flex-1"
              >
                <option value="">None</option>
                {agents?.map((agent: any) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.lang})
                  </option>
                ))}
              </Select>
              <Link to="/agents">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            {!agents || agents.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No agents available. <Link to="/agents" className="text-primary hover:underline">Create one</Link>
              </p>
            ) : null}
            {errors.default_agent_id && (
              <p className="text-sm text-destructive">{errors.default_agent_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_from_number">Default From Number</Label>
            <div className="flex gap-2">
              <Select
                id="default_from_number"
                {...register('default_from_number')}
                className="flex-1"
              >
                <option value="">None</option>
                {verifiedNumbers.map((number: any) => (
                  <option key={number.id} value={number.e164}>
                    {number.e164} {number.country ? `(${number.country})` : ''}
                  </option>
                ))}
              </Select>
              <Link to="/numbers">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            {verifiedNumbers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No verified numbers available. <Link to="/numbers" className="text-primary hover:underline">Add one</Link>
              </p>
            ) : null}
            {errors.default_from_number && (
              <p className="text-sm text-destructive">{errors.default_from_number.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_spacing_ms">Default Spacing (ms)</Label>
            <Input
              id="default_spacing_ms"
              type="number"
              min="0"
              max="60000"
              {...register('default_spacing_ms', { valueAsNumber: true })}
              error={errors.default_spacing_ms?.message}
            />
            <p className="text-xs text-muted-foreground">
              Time in milliseconds between calls (0-60000)
            </p>
          </div>

          {hasChanges && (
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset()
                  setHasChanges(false)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

