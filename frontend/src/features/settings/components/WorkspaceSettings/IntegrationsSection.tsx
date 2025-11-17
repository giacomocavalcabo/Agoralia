import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useWorkspaceIntegrations, useUpdateWorkspaceIntegrations } from '../../hooks'
import { Loader2, Save, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

const integrationsSchema = z.object({
  retell_api_key: z.string().optional().or(z.literal('')),
  retell_webhook_secret: z.string().optional().or(z.literal('')),
})

type IntegrationsForm = z.infer<typeof integrationsSchema>

export function IntegrationsSection() {
  const { data, isLoading, error } = useWorkspaceIntegrations()
  const updateMutation = useUpdateWorkspaceIntegrations()
  const [hasChanges, setHasChanges] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<IntegrationsForm>({
    resolver: zodResolver(integrationsSchema),
    defaultValues: {
      retell_api_key: '',
      retell_webhook_secret: '',
    },
  })

  // Watch for changes
  const watchedFields = watch()
  useEffect(() => {
    const apiKeyChanged = watchedFields.retell_api_key !== ''
    const webhookSecretChanged = watchedFields.retell_webhook_secret !== ''
    setHasChanges(apiKeyChanged || webhookSecretChanged)
  }, [watchedFields])

  const onSubmit = async (formData: IntegrationsForm) => {
    try {
      // Only include defined values (exclude undefined)
      const updates: Record<string, string | null> = {}
      if (formData.retell_api_key !== undefined) {
        updates.retell_api_key = formData.retell_api_key || null
      }
      if (formData.retell_webhook_secret !== undefined) {
        updates.retell_webhook_secret = formData.retell_webhook_secret || null
      }
      await updateMutation.mutateAsync(updates)
      reset({
        retell_api_key: '',
        retell_webhook_secret: '',
      })
      setHasChanges(false)
      alert('Integration settings saved successfully')
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          Configure Retell AI API credentials. Keys are encrypted at rest.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="retell_api_key">Retell API Key</Label>
              {data?.retell_api_key_set && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Key is set</span>
                </div>
              )}
            </div>
            <div className="relative">
              <Input
                id="retell_api_key"
                type={showApiKey ? 'text' : 'password'}
                placeholder={data?.retell_api_key_set ? '••••••••••••' : 'Enter API key'}
                {...register('retell_api_key')}
                error={errors.retell_api_key?.message}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.retell_api_key_set
                ? 'Enter a new key to update the existing one. Leave empty to keep current key.'
                : 'Enter your Retell AI API key to enable integrations.'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="retell_webhook_secret">Retell Webhook Secret</Label>
              {data?.retell_webhook_secret_set && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Secret is set</span>
                </div>
              )}
            </div>
            <div className="relative">
              <Input
                id="retell_webhook_secret"
                type={showWebhookSecret ? 'text' : 'password'}
                placeholder={data?.retell_webhook_secret_set ? '••••••••••••' : 'Enter webhook secret'}
                {...register('retell_webhook_secret')}
                error={errors.retell_webhook_secret?.message}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              >
                {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.retell_webhook_secret_set
                ? 'Enter a new secret to update the existing one. Leave empty to keep current secret.'
                : 'Enter your Retell AI webhook secret for secure webhook validation.'}
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

