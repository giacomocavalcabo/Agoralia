import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { useUserPreferencesDashboard, useUpdateUserPreferencesDashboard } from '../../hooks'
import { Loader2, Save } from 'lucide-react'

const dashboardSchema = z.object({
  default_view: z.enum(['campaigns', 'calls', 'dashboard']).nullable().optional(),
  table_page_size: z.number().min(10).max(200).optional(),
})

type DashboardForm = z.infer<typeof dashboardSchema>

export function DashboardSection() {
  const { data, isLoading, error } = useUserPreferencesDashboard()
  const updateMutation = useUpdateUserPreferencesDashboard()
  const [hasChanges, setHasChanges] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<DashboardForm>({
    resolver: zodResolver(dashboardSchema),
    defaultValues: {
      default_view: null,
      table_page_size: 50,
    },
  })

  // Sync form with data when it loads
  useEffect(() => {
    if (data) {
      reset({
        default_view: (data.default_view as 'campaigns' | 'calls' | 'dashboard') ?? null,
        table_page_size: data.table_page_size ?? 50,
      })
      setHasChanges(false)
    }
  }, [data, reset])

  // Watch for changes
  const watchedFields = watch()
  useEffect(() => {
    if (data) {
      const currentValues = {
        default_view: watchedFields.default_view ?? null,
        table_page_size: watchedFields.table_page_size ?? 50,
      }
      const initialValues = {
        default_view: data.default_view ?? null,
        table_page_size: data.table_page_size ?? 50,
      }
      setHasChanges(JSON.stringify(currentValues) !== JSON.stringify(initialValues))
    }
  }, [watchedFields, data])

  const onSubmit = async (formData: DashboardForm) => {
    try {
      await updateMutation.mutateAsync({
        default_view: formData.default_view ?? null,
        table_page_size: formData.table_page_size,
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
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>
          Configure your personal dashboard and table preferences.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default_view">Default View</Label>
            <Select
              id="default_view"
              {...register('default_view')}
            >
              <option value="">Use default</option>
              <option value="dashboard">Dashboard</option>
              <option value="campaigns">Campaigns</option>
              <option value="calls">Calls</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose which page to show when you first log in
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="table_page_size">Table Page Size</Label>
            <Input
              id="table_page_size"
              type="number"
              min="10"
              max="200"
              {...register('table_page_size', { valueAsNumber: true })}
              error={errors.table_page_size?.message}
            />
            <p className="text-xs text-muted-foreground">
              Number of rows per page in tables (10-200)
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

