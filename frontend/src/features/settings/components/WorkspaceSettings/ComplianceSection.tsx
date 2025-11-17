import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Switch } from '@/shared/ui/switch'
import { useWorkspaceCompliance, useUpdateWorkspaceCompliance } from '../../hooks'
import { Loader2, Save } from 'lucide-react'

const complianceSchema = z.object({
  require_legal_review: z.boolean().optional(),
  override_country_rules_enabled: z.boolean().optional(),
})

type ComplianceForm = z.infer<typeof complianceSchema>

export function ComplianceSection() {
  const { data, isLoading, error } = useWorkspaceCompliance()
  const updateMutation = useUpdateWorkspaceCompliance()
  const [hasChanges, setHasChanges] = useState(false)

  const {
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm<ComplianceForm>({
    resolver: zodResolver(complianceSchema),
    defaultValues: {
      require_legal_review: true,
      override_country_rules_enabled: false,
    },
  })

  // Sync form with data when it loads
  useEffect(() => {
    if (data) {
      reset({
        require_legal_review: data.require_legal_review ?? true,
        override_country_rules_enabled: data.override_country_rules_enabled ?? false,
      })
      setHasChanges(false)
    }
  }, [data, reset])

  // Watch for changes
  const watchedFields = watch()
  useEffect(() => {
    if (data) {
      const currentValues = {
        require_legal_review: watchedFields.require_legal_review ?? true,
        override_country_rules_enabled: watchedFields.override_country_rules_enabled ?? false,
      }
      const initialValues = {
        require_legal_review: data.require_legal_review ?? true,
        override_country_rules_enabled: data.override_country_rules_enabled ?? false,
      }
      setHasChanges(JSON.stringify(currentValues) !== JSON.stringify(initialValues))
    }
  }, [watchedFields, data])

  const onSubmit = async (formData: ComplianceForm) => {
    try {
      await updateMutation.mutateAsync({
        require_legal_review: formData.require_legal_review,
        override_country_rules_enabled: formData.override_country_rules_enabled,
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
        <CardTitle>Compliance</CardTitle>
        <CardDescription>
          Configure compliance behavior and legal review requirements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Switch
                id="require_legal_review"
                checked={watch('require_legal_review') ?? true}
                onChange={(e) => setValue('require_legal_review', e.target.checked)}
                label="Require legal review before starting campaigns"
              />
              <p className="text-xs text-muted-foreground ml-14">
                When enabled, campaigns must be reviewed before they can be started.
              </p>
            </div>

            <div className="space-y-2">
              <Switch
                id="override_country_rules_enabled"
                checked={watch('override_country_rules_enabled') ?? false}
                onChange={(e) => setValue('override_country_rules_enabled', e.target.checked)}
                label="Allow overriding country-specific compliance rules"
              />
              <p className="text-xs text-muted-foreground ml-14">
                When enabled, users can override default country rules for specific campaigns.
                Use with caution.
              </p>
            </div>
          </div>

          <div className="rounded-md border bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> To manage country rules, DNC lists, and consent records, 
              visit the <a href="/compliance" className="text-primary hover:underline">Compliance</a> page.
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

