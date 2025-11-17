import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useWorkspaceGeneral, useUpdateWorkspaceGeneral } from '../../hooks'
import { Loader2, Save } from 'lucide-react'

const generalSchema = z.object({
  workspace_name: z.string().max(128).optional().or(z.literal('')),
  timezone: z.string().max(64).optional().or(z.literal('')),
  brand_logo_url: z.string().url().optional().or(z.literal('')),
  brand_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (#RRGGBB)')
    .optional()
    .or(z.literal('')),
})

type GeneralForm = z.infer<typeof generalSchema>

export function GeneralSection() {
  const { data, isLoading, error } = useWorkspaceGeneral()
  const updateMutation = useUpdateWorkspaceGeneral()
  const [hasChanges, setHasChanges] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<GeneralForm>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      workspace_name: '',
      timezone: '',
      brand_logo_url: '',
      brand_color: '',
    },
  })

  // Sync form with data when it loads
  useEffect(() => {
    if (data) {
      reset({
        workspace_name: data.workspace_name || '',
        timezone: data.timezone || '',
        brand_logo_url: data.brand_logo_url || '',
        brand_color: data.brand_color || '',
      })
      setHasChanges(false)
    }
  }, [data, reset])

  const onSubmit = async (formData: GeneralForm) => {
    try {
      // Remove empty strings, convert to null
      const updates: Record<string, string | null> = {}
      if (formData.workspace_name !== undefined) {
        updates.workspace_name = formData.workspace_name || null
      }
      if (formData.timezone !== undefined) {
        updates.timezone = formData.timezone || null
      }
      if (formData.brand_logo_url !== undefined) {
        updates.brand_logo_url = formData.brand_logo_url || null
      }
      if (formData.brand_color !== undefined) {
        updates.brand_color = formData.brand_color || null
      }

      await updateMutation.mutateAsync(updates)
      reset(formData)
      setHasChanges(false)
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-destructive">Error loading settings: {error.message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Workspace name, timezone, and branding settings</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="workspace_name">Workspace name</Label>
            <Input
              id="workspace_name"
              {...register('workspace_name')}
              placeholder="My Workspace"
              className="mt-1.5"
              onChange={(e) => {
                register('workspace_name').onChange(e)
                setHasChanges(true)
              }}
            />
            {errors.workspace_name && (
              <p className="mt-1 text-sm text-destructive">{errors.workspace_name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              {...register('timezone')}
              placeholder="Europe/Rome"
              className="mt-1.5"
              onChange={(e) => {
                register('timezone').onChange(e)
                setHasChanges(true)
              }}
            />
            {errors.timezone && (
              <p className="mt-1 text-sm text-destructive">{errors.timezone.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="brand_logo_url">Brand logo URL</Label>
            <Input
              id="brand_logo_url"
              {...register('brand_logo_url')}
              placeholder="https://example.com/logo.png"
              className="mt-1.5"
              onChange={(e) => {
                register('brand_logo_url').onChange(e)
                setHasChanges(true)
              }}
            />
            {errors.brand_logo_url && (
              <p className="mt-1 text-sm text-destructive">{errors.brand_logo_url.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="brand_color">Brand color</Label>
            <Input
              id="brand_color"
              {...register('brand_color')}
              placeholder="#10a37f"
              className="mt-1.5"
              onChange={(e) => {
                register('brand_color').onChange(e)
                setHasChanges(true)
              }}
            />
            {errors.brand_color && (
              <p className="mt-1 text-sm text-destructive">{errors.brand_color.message}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Hex color format: #RRGGBB</p>
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

