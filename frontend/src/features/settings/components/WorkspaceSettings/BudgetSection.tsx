import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import { useWorkspaceBudget, useUpdateWorkspaceBudget } from '../../hooks'
import { Loader2, Save } from 'lucide-react'

const budgetSchema = z.object({
  budget_monthly_cents: z.number().min(0).nullable().optional(),
  budget_warn_percent: z.number().min(1).max(100).optional(),
  budget_stop_enabled: z.boolean().optional(),
})

type BudgetForm = z.infer<typeof budgetSchema>

export function BudgetSection() {
  const { data, isLoading, error } = useWorkspaceBudget()
  const updateMutation = useUpdateWorkspaceBudget()
  const [hasChanges, setHasChanges] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<BudgetForm>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      budget_monthly_cents: null,
      budget_warn_percent: 80,
      budget_stop_enabled: true,
    },
  })

  // Sync form with data when it loads
  useEffect(() => {
    if (data) {
      reset({
        budget_monthly_cents: data.budget_monthly_cents ?? null,
        budget_warn_percent: data.budget_warn_percent ?? 80,
        budget_stop_enabled: data.budget_stop_enabled ?? true,
      })
      setHasChanges(false)
    }
  }, [data, reset])

  // Watch for changes
  const watchedFields = watch()
  useEffect(() => {
    if (data) {
      const currentValues = {
        budget_monthly_cents: watchedFields.budget_monthly_cents ?? null,
        budget_warn_percent: watchedFields.budget_warn_percent ?? 80,
        budget_stop_enabled: watchedFields.budget_stop_enabled ?? true,
      }
      const initialValues = {
        budget_monthly_cents: data.budget_monthly_cents ?? null,
        budget_warn_percent: data.budget_warn_percent ?? 80,
        budget_stop_enabled: data.budget_stop_enabled ?? true,
      }
      setHasChanges(JSON.stringify(currentValues) !== JSON.stringify(initialValues))
    }
  }, [watchedFields, data])

  const onSubmit = async (formData: BudgetForm) => {
    try {
      await updateMutation.mutateAsync({
        budget_monthly_cents: formData.budget_monthly_cents ?? null,
        budget_warn_percent: formData.budget_warn_percent,
        budget_stop_enabled: formData.budget_stop_enabled,
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

  const budgetMonthly = watch('budget_monthly_cents') ?? 0
  const budgetMonthlyEuros = (budgetMonthly / 100).toFixed(2)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget</CardTitle>
        <CardDescription>
          Configure monthly budget limits and warnings for your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="budget_monthly_cents">Monthly Budget (€)</Label>
            <Input
              id="budget_monthly_cents"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              {...register('budget_monthly_cents', {
                valueAsNumber: true,
                setValueAs: (v) => (v === '' ? null : Math.round(parseFloat(v) * 100)),
              })}
              error={errors.budget_monthly_cents?.message}
            />
            {budgetMonthly > 0 && (
              <p className="text-xs text-muted-foreground">
                Current budget: €{budgetMonthlyEuros} per month
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Leave empty for unlimited budget
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget_warn_percent">Warning Threshold (%)</Label>
            <Input
              id="budget_warn_percent"
              type="number"
              min="1"
              max="100"
              {...register('budget_warn_percent', { valueAsNumber: true })}
              error={errors.budget_warn_percent?.message}
            />
            <p className="text-xs text-muted-foreground">
              Send warning when budget reaches this percentage (1-100)
            </p>
          </div>

          <div className="space-y-2">
            <Switch
              id="budget_stop_enabled"
              checked={watch('budget_stop_enabled') ?? true}
              onChange={(e) => setValue('budget_stop_enabled', e.target.checked)}
              label="Automatically stop campaigns when budget is reached"
            />
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

