import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import { Select } from '@/shared/ui/select'
import { useWorkspaceQuietHours, useUpdateWorkspaceQuietHours } from '../../hooks'
import { Loader2, Save } from 'lucide-react'

const quietHoursSchema = z.object({
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_weekdays: z.string().max(32).nullable().optional(),
  quiet_hours_saturday: z.string().max(32).nullable().optional(),
  quiet_hours_sunday: z.string().max(32).nullable().optional(),
  quiet_hours_timezone: z.string().max(64).nullable().optional(),
})

type QuietHoursForm = z.infer<typeof quietHoursSchema>

export function QuietHoursSection() {
  const { data, isLoading, error } = useWorkspaceQuietHours()
  const updateMutation = useUpdateWorkspaceQuietHours()
  const [hasChanges, setHasChanges] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<QuietHoursForm>({
    resolver: zodResolver(quietHoursSchema),
    defaultValues: {
      quiet_hours_enabled: false,
      quiet_hours_weekdays: null,
      quiet_hours_saturday: null,
      quiet_hours_sunday: null,
      quiet_hours_timezone: null,
    },
  })

  // Sync form with data when it loads
  useEffect(() => {
    if (data) {
      reset({
        quiet_hours_enabled: data.quiet_hours_enabled ?? false,
        quiet_hours_weekdays: data.quiet_hours_weekdays ?? null,
        quiet_hours_saturday: data.quiet_hours_saturday ?? null,
        quiet_hours_sunday: data.quiet_hours_sunday ?? null,
        quiet_hours_timezone: data.quiet_hours_timezone ?? null,
      })
      setHasChanges(false)
    }
  }, [data, reset])

  // Watch for changes
  const watchedFields = watch()
  useEffect(() => {
    if (data) {
      const currentValues = {
        quiet_hours_enabled: watchedFields.quiet_hours_enabled ?? false,
        quiet_hours_weekdays: watchedFields.quiet_hours_weekdays ?? null,
        quiet_hours_saturday: watchedFields.quiet_hours_saturday ?? null,
        quiet_hours_sunday: watchedFields.quiet_hours_sunday ?? null,
        quiet_hours_timezone: watchedFields.quiet_hours_timezone ?? null,
      }
      const initialValues = {
        quiet_hours_enabled: data.quiet_hours_enabled ?? false,
        quiet_hours_weekdays: data.quiet_hours_weekdays ?? null,
        quiet_hours_saturday: data.quiet_hours_saturday ?? null,
        quiet_hours_sunday: data.quiet_hours_sunday ?? null,
        quiet_hours_timezone: data.quiet_hours_timezone ?? null,
      }
      setHasChanges(JSON.stringify(currentValues) !== JSON.stringify(initialValues))
    }
  }, [watchedFields, data])

  const onSubmit = async (formData: QuietHoursForm) => {
    try {
      // Only include defined values (exclude undefined)
      const updates: Record<string, any> = {}
      if (formData.quiet_hours_enabled !== undefined) {
        updates.quiet_hours_enabled = formData.quiet_hours_enabled
      }
      if (formData.quiet_hours_weekdays !== undefined) {
        updates.quiet_hours_weekdays = formData.quiet_hours_weekdays ?? null
      }
      if (formData.quiet_hours_saturday !== undefined) {
        updates.quiet_hours_saturday = formData.quiet_hours_saturday ?? null
      }
      if (formData.quiet_hours_sunday !== undefined) {
        updates.quiet_hours_sunday = formData.quiet_hours_sunday ?? null
      }
      if (formData.quiet_hours_timezone !== undefined) {
        updates.quiet_hours_timezone = formData.quiet_hours_timezone ?? null
      }
      await updateMutation.mutateAsync(updates)
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

  const isEnabled = watch('quiet_hours_enabled') ?? false

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quiet Hours</CardTitle>
        <CardDescription>
          Configure default quiet hours to respect calling time restrictions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Switch
              id="quiet_hours_enabled"
              checked={isEnabled}
              onChange={(e) => setValue('quiet_hours_enabled', e.target.checked)}
              label="Enable quiet hours"
            />
          </div>

          {isEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="quiet_hours_weekdays">Weekdays (HH:MM-HH:MM)</Label>
                <Input
                  id="quiet_hours_weekdays"
                  placeholder="09:00-21:00"
                  {...register('quiet_hours_weekdays')}
                  error={errors.quiet_hours_weekdays?.message}
                />
                <p className="text-xs text-muted-foreground">
                  Allowed calling hours for Monday-Friday (e.g., "09:00-21:00")
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quiet_hours_saturday">Saturday</Label>
                <Select
                  id="quiet_hours_saturday"
                  {...register('quiet_hours_saturday')}
                >
                  <option value="">Not set</option>
                  <option value="forbidden">Forbidden</option>
                  <option value="09:00-21:00">09:00-21:00</option>
                  <option value="10:00-20:00">10:00-20:00</option>
                  <option value="12:00-18:00">12:00-18:00</option>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select "Forbidden" to block all calls on Saturday, or choose allowed hours
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quiet_hours_sunday">Sunday</Label>
                <Select
                  id="quiet_hours_sunday"
                  {...register('quiet_hours_sunday')}
                >
                  <option value="">Not set</option>
                  <option value="forbidden">Forbidden</option>
                  <option value="09:00-21:00">09:00-21:00</option>
                  <option value="10:00-20:00">10:00-20:00</option>
                  <option value="12:00-18:00">12:00-18:00</option>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select "Forbidden" to block all calls on Sunday, or choose allowed hours
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quiet_hours_timezone">Timezone</Label>
                <Input
                  id="quiet_hours_timezone"
                  placeholder="Europe/Rome"
                  {...register('quiet_hours_timezone')}
                  error={errors.quiet_hours_timezone?.message}
                />
                <p className="text-xs text-muted-foreground">
                  Timezone for quiet hours (e.g., "Europe/Rome", "America/New_York")
                </p>
              </div>
            </>
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

