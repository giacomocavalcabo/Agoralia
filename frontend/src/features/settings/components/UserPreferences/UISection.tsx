import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { useUserPreferencesUI, useUpdateUserPreferencesUI } from '../../hooks'
import { Loader2, Save } from 'lucide-react'

const uiSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  ui_locale: z.string().max(16).nullable().optional(),
  date_format: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).nullable().optional(),
  time_format: z.enum(['24h', '12h']).nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
})

type UIForm = z.infer<typeof uiSchema>

export function UISection() {
  const { data, isLoading, error } = useUserPreferencesUI()
  const updateMutation = useUpdateUserPreferencesUI()
  const [hasChanges, setHasChanges] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<UIForm>({
    resolver: zodResolver(uiSchema),
    defaultValues: {
      theme: 'system',
      ui_locale: null,
      date_format: null,
      time_format: null,
      timezone: null,
    },
  })

  // Sync form with data when it loads
  useEffect(() => {
    if (data) {
      reset({
        theme: (data.theme as 'light' | 'dark' | 'system') || 'system',
        ui_locale: data.ui_locale ?? null,
        date_format: (data.date_format as 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD') ?? null,
        time_format: (data.time_format as '24h' | '12h') ?? null,
        timezone: data.timezone ?? null,
      })
      setHasChanges(false)
    }
  }, [data, reset])

  // Watch for changes
  const watchedFields = watch()
  useEffect(() => {
    if (data) {
      const currentValues = {
        theme: watchedFields.theme ?? 'system',
        ui_locale: watchedFields.ui_locale ?? null,
        date_format: watchedFields.date_format ?? null,
        time_format: watchedFields.time_format ?? null,
        timezone: watchedFields.timezone ?? null,
      }
      const initialValues = {
        theme: (data.theme as 'light' | 'dark' | 'system') || 'system',
        ui_locale: data.ui_locale ?? null,
        date_format: data.date_format ?? null,
        time_format: data.time_format ?? null,
        timezone: data.timezone ?? null,
      }
      setHasChanges(JSON.stringify(currentValues) !== JSON.stringify(initialValues))
    }
  }, [watchedFields, data])

  const onSubmit = async (formData: UIForm) => {
    try {
      await updateMutation.mutateAsync({
        theme: formData.theme,
        ui_locale: formData.ui_locale ?? null,
        date_format: formData.date_format ?? null,
        time_format: formData.time_format ?? null,
        timezone: formData.timezone ?? null,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>UI Preferences</CardTitle>
        <CardDescription>
          Customize your personal interface preferences.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              id="theme"
              {...register('theme')}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose your preferred color theme
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ui_locale">UI Language</Label>
            <Select
              id="ui_locale"
              {...register('ui_locale')}
            >
              <option value="">Use workspace default</option>
              <option value="en-US">English (US)</option>
              <option value="it-IT">Italiano</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              Override workspace default language for your interface
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_format">Date Format</Label>
            <Select
              id="date_format"
              {...register('date_format')}
            >
              <option value="">Use workspace default</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              How dates are displayed throughout the interface
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time_format">Time Format</Label>
            <Select
              id="time_format"
              {...register('time_format')}
            >
              <option value="">Use workspace default</option>
              <option value="24h">24-hour (14:30)</option>
              <option value="12h">12-hour (2:30 PM)</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              How times are displayed throughout the interface
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              id="timezone"
              {...register('timezone')}
            >
              <option value="">Use workspace default</option>
              <option value="Europe/Rome">Europe/Rome</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
              <option value="UTC">UTC</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              Override workspace timezone for your personal view
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

