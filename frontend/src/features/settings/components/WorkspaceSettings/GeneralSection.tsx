import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useWorkspaceGeneral, useUpdateWorkspaceGeneral, useUploadWorkspaceLogo, useDeleteWorkspaceLogo } from '../../hooks'
import { Loader2, Save, Upload, X } from 'lucide-react'

const generalSchema = z.object({
  workspace_name: z.string().max(128).optional().or(z.literal('')),
  timezone: z.string().max(64).optional().or(z.literal('')),
  brand_logo_url: z.string()
    .refine(
      (val) => {
        if (!val || val === '') return true
        // Accept URLs (http/https) or relative paths starting with /uploads/ or workspace-logos/
        return val.startsWith('http://') || 
               val.startsWith('https://') || 
               val.startsWith('/uploads/') || 
               val.startsWith('workspace-logos/') ||
               z.string().url().safeParse(val).success
      },
      { message: 'Must be a valid URL or file path' }
    )
    .optional()
    .or(z.literal('')),
})

type GeneralForm = z.infer<typeof generalSchema>

export function GeneralSection() {
  const { data, isLoading, error } = useWorkspaceGeneral()
  const updateMutation = useUpdateWorkspaceGeneral()
  const uploadMutation = useUploadWorkspaceLogo()
  const deleteMutation = useDeleteWorkspaceLogo()
  const [hasChanges, setHasChanges] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<GeneralForm>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      workspace_name: '',
      timezone: '',
      brand_logo_url: '',
    },
  })

  const logoUrl = watch('brand_logo_url')

  // Sync form with data when it loads
  useEffect(() => {
    if (data) {
      reset({
        workspace_name: data.workspace_name || '',
        timezone: data.timezone || '',
        brand_logo_url: data.brand_logo_url || '',
      })
      setHasChanges(false)
    }
  }, [data, reset])

  // Watch for changes to detect when user edits fields
  const watchedFields = watch(['workspace_name', 'timezone', 'brand_logo_url'])
  useEffect(() => {
    if (data) {
      const hasChangesNow = 
        watchedFields[0] !== (data.workspace_name || '') ||
        watchedFields[1] !== (data.timezone || '') ||
        watchedFields[2] !== (data.brand_logo_url || '')
      setHasChanges(hasChangesNow)
    }
  }, [watchedFields, data])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large (max 5MB)')
      return
    }

    try {
      const result = await uploadMutation.mutateAsync(file)
      // The backend returns the full URL or relative path
      // Store it as-is in the form (validation will pass now)
      setValue('brand_logo_url', result.brand_logo_url || '', { shouldValidate: false })
      // Logo upload saves automatically, so no need to set hasChanges
      // But if user manually edits the URL field, hasChanges will be set
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: any) {
      alert(`Failed to upload logo: ${error.message}`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveLogo = async () => {
    try {
      await deleteMutation.mutateAsync()
      setValue('brand_logo_url', '', { shouldValidate: false })
      setHasChanges(false)
    } catch (error: any) {
      alert(`Failed to remove logo: ${error.message}`)
    }
  }

  const onSubmit = async (formData: GeneralForm) => {
    try {
      // Simple updates - logo is handled separately via upload/delete endpoints
      const updates: Record<string, string | null> = {}
      if (formData.workspace_name !== undefined) {
        updates.workspace_name = formData.workspace_name || null
      }
      if (formData.timezone !== undefined) {
        updates.timezone = formData.timezone || null
      }
      // If brand_logo_url is empty string, delete the logo
      if (formData.brand_logo_url !== undefined) {
        if (formData.brand_logo_url === '' || formData.brand_logo_url === null) {
          // Empty = delete logo
          updates.brand_logo_url = null
        } else {
          // Extract relative path if needed
          let logoValue = formData.brand_logo_url
          if (logoValue.includes('workspace-logos/')) {
            const match = logoValue.match(/workspace-logos\/[^/]+\/[^/]+$/)
            if (match) {
              logoValue = match[0]
            } else if (logoValue.startsWith('/uploads/')) {
              logoValue = logoValue.replace(/^\/uploads\//, '')
            }
          } else if (logoValue.startsWith('/uploads/')) {
            logoValue = logoValue.replace(/^\/uploads\//, '')
          }
          // Only update if it's a valid workspace-logos path or external URL
          if (logoValue.startsWith('workspace-logos/') || 
              logoValue.startsWith('http://') || 
              logoValue.startsWith('https://')) {
            updates.brand_logo_url = logoValue
          }
        }
      }

      // Only save if there are actual updates
      if (Object.keys(updates).length > 0) {
        await updateMutation.mutateAsync(updates)
      }
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
    const is403 = (error as any)?.response?.status === 403
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-sm text-destructive">
            {is403 
              ? "Access denied. Your admin status may have changed. Please refresh the page or logout/login to update your token."
              : `Error loading settings: ${error.message}`}
          </p>
          {is403 && (
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.clear()
                  window.location.href = '/login'
                }}
              >
                Logout & Login
              </Button>
            </div>
          )}
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
            <Label htmlFor="logo">Logo</Label>
            <div className="mt-1.5 space-y-3">
              {logoUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={
                      logoUrl.startsWith('http://') || logoUrl.startsWith('https://')
                        ? logoUrl
                        : (() => {
                            // For static files, always use the full API URL, not the proxy
                            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.agoralia.app'
                            // If VITE_API_BASE_URL is a relative path like /api, use the full URL instead
                            const fullApiUrl = apiBaseUrl.startsWith('http://') || apiBaseUrl.startsWith('https://')
                              ? apiBaseUrl
                              : 'https://api.agoralia.app'
                            const path = logoUrl.startsWith('/') 
                              ? logoUrl 
                              : `/${logoUrl}`
                            return `${fullApiUrl}${path}`
                          })()
                    }
                    alt="Workspace logo"
                    className="h-16 w-16 rounded-full object-cover border"
                    onError={(e) => {
                      // Silently handle image load errors
                    }}
                  />
                  <div className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadMutation.isPending}
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Change Logo
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={deleteMutation.isPending}
                      className="ml-2"
                    >
                      {deleteMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        <>
                          <X className="mr-2 h-4 w-4" />
                          Remove
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Logo
                      </>
                    )}
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Input
                id="brand_logo_url"
                {...register('brand_logo_url')}
                placeholder="Or enter logo URL"
                className="mt-2"
                onChange={(e) => {
                  register('brand_logo_url').onChange(e)
                  setHasChanges(true)
                }}
              />
              {errors.brand_logo_url && (
                <p className="mt-1 text-sm text-destructive">{errors.brand_logo_url.message}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Upload an image file or enter a URL. Max 5MB.
              </p>
            </div>
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
