import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Switch } from '@/shared/ui/switch'
import { useWorkspaceNotifications, useUpdateWorkspaceNotifications } from '../../hooks'
import { Loader2, Save } from 'lucide-react'

const notificationsSchema = z.object({
  email_notifications_enabled: z.boolean().optional(),
  email_campaign_started: z.boolean().optional(),
  email_campaign_paused: z.boolean().optional(),
  email_budget_warning: z.boolean().optional(),
  email_compliance_alert: z.boolean().optional(),
})

type NotificationsForm = z.infer<typeof notificationsSchema>

export function NotificationsSection() {
  const { data, isLoading, error } = useWorkspaceNotifications()
  const updateMutation = useUpdateWorkspaceNotifications()
  const [hasChanges, setHasChanges] = useState(false)

  const {
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm<NotificationsForm>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: {
      email_notifications_enabled: true,
      email_campaign_started: true,
      email_campaign_paused: true,
      email_budget_warning: true,
      email_compliance_alert: true,
    },
  })

  // Sync form with data when it loads
  useEffect(() => {
    if (data) {
      reset({
        email_notifications_enabled: data.email_notifications_enabled ?? true,
        email_campaign_started: data.email_campaign_started ?? true,
        email_campaign_paused: data.email_campaign_paused ?? true,
        email_budget_warning: data.email_budget_warning ?? true,
        email_compliance_alert: data.email_compliance_alert ?? true,
      })
      setHasChanges(false)
    }
  }, [data, reset])

  // Watch for changes
  const watchedFields = watch()
  useEffect(() => {
    if (data) {
      const currentValues = {
        email_notifications_enabled: watchedFields.email_notifications_enabled ?? true,
        email_campaign_started: watchedFields.email_campaign_started ?? true,
        email_campaign_paused: watchedFields.email_campaign_paused ?? true,
        email_budget_warning: watchedFields.email_budget_warning ?? true,
        email_compliance_alert: watchedFields.email_compliance_alert ?? true,
      }
      const initialValues = {
        email_notifications_enabled: data.email_notifications_enabled ?? true,
        email_campaign_started: data.email_campaign_started ?? true,
        email_campaign_paused: data.email_campaign_paused ?? true,
        email_budget_warning: data.email_budget_warning ?? true,
        email_compliance_alert: data.email_compliance_alert ?? true,
      }
      setHasChanges(JSON.stringify(currentValues) !== JSON.stringify(initialValues))
    }
  }, [watchedFields, data])

  const onSubmit = async (formData: NotificationsForm) => {
    try {
      await updateMutation.mutateAsync({
        email_notifications_enabled: formData.email_notifications_enabled,
        email_campaign_started: formData.email_campaign_started,
        email_campaign_paused: formData.email_campaign_paused,
        email_budget_warning: formData.email_budget_warning,
        email_compliance_alert: formData.email_compliance_alert,
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

  const notificationsEnabled = watch('email_notifications_enabled') ?? true

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Configure email notification preferences for your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Switch
              id="email_notifications_enabled"
              checked={notificationsEnabled}
              onChange={(e) => setValue('email_notifications_enabled', e.target.checked)}
              label="Enable email notifications"
            />
            <p className="text-xs text-muted-foreground ml-14">
              Master switch for all email notifications. When disabled, no emails will be sent.
            </p>
          </div>

          {notificationsEnabled && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Switch
                  id="email_campaign_started"
                  checked={watch('email_campaign_started') ?? true}
                  onChange={(e) => setValue('email_campaign_started', e.target.checked)}
                  label="Campaign started"
                />
                <p className="text-xs text-muted-foreground ml-14">
                  Receive email when a campaign starts
                </p>
              </div>

              <div className="space-y-2">
                <Switch
                  id="email_campaign_paused"
                  checked={watch('email_campaign_paused') ?? true}
                  onChange={(e) => setValue('email_campaign_paused', e.target.checked)}
                  label="Campaign paused"
                />
                <p className="text-xs text-muted-foreground ml-14">
                  Receive email when a campaign is paused
                </p>
              </div>

              <div className="space-y-2">
                <Switch
                  id="email_budget_warning"
                  checked={watch('email_budget_warning') ?? true}
                  onChange={(e) => setValue('email_budget_warning', e.target.checked)}
                  label="Budget warning"
                />
                <p className="text-xs text-muted-foreground ml-14">
                  Receive email when budget warning threshold is reached
                </p>
              </div>

              <div className="space-y-2">
                <Switch
                  id="email_compliance_alert"
                  checked={watch('email_compliance_alert') ?? true}
                  onChange={(e) => setValue('email_compliance_alert', e.target.checked)}
                  label="Compliance alerts"
                />
                <p className="text-xs text-muted-foreground ml-14">
                  Receive email for compliance-related alerts
                </p>
              </div>
            </div>
          )}

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

