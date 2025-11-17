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
  external_logo_url: z.string()
    .refine(
      (val) => {
        if (!val || val === '') return true
        // Only accept external URLs (http/https)
        return val.startsWith('http://') || val.startsWith('https://')
      },
      { message: 'Must be a valid URL (http:// or https://)' }
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
      external_logo_url: '',
    },
  })

  // Get current logo from data (uploaded file or external URL)
  const currentLogoUrl = data?.brand_logo_url || ''
  // Check if logo is uploaded (not external URL) or if it's a presigned URL (temporary)
  const isPresignedUrl = currentLogoUrl.includes('r2.cloudflarestorage.com') || currentLogoUrl.includes('X-Amz-Signature')
  const isUploadedLogo = currentLogoUrl && (currentLogoUrl.startsWith('workspace-logos/') || isPresignedUrl || (!currentLogoUrl.startsWith('http://') && !currentLogoUrl.startsWith('https://')))
  const externalLogoUrl = watch('external_logo_url')

  // Sync form with data when it loads
  useEffect(() => {
    if (data) {
      // Extract external URL if logo is an external URL, otherwise leave empty
      // Don't show presigned URLs (they include r2.cloudflarestorage.com) - those are temporary
      const logoUrl = data.brand_logo_url || ''
      const isExternal = logoUrl.startsWith('http://') || logoUrl.startsWith('https://')
      // Only show permanent external URLs, not presigned URLs (which are temporary)
      // Presigned URLs have X-Amz-Signature in the query string or contain r2.cloudflarestorage.com
      const isPresigned = isExternal && (
        logoUrl.includes('r2.cloudflarestorage.com') || 
        logoUrl.includes('X-Amz-Signature') ||
        logoUrl.includes('X-Amz-Algorithm')
      )
      const shouldShowExternalUrl = isExternal && !isPresigned
      
      reset({
        workspace_name: data.workspace_name || '',
        timezone: data.timezone || '',
        external_logo_url: shouldShowExternalUrl ? logoUrl : '',
      })
      setHasChanges(false)
    }
  }, [data, reset])

  // Watch for changes to detect when user edits fields
  const watchedFields = watch(['workspace_name', 'timezone', 'external_logo_url'])
  useEffect(() => {
    if (data) {
      const logoUrl = data.brand_logo_url || ''
      const isExternal = logoUrl.startsWith('http://') || logoUrl.startsWith('https://')
      // Only compare with permanent external URLs, not presigned URLs
      // Presigned URLs have X-Amz-Signature in the query string or contain r2.cloudflarestorage.com
      const isPresigned = isExternal && (
        logoUrl.includes('r2.cloudflarestorage.com') || 
        logoUrl.includes('X-Amz-Signature') ||
        logoUrl.includes('X-Amz-Algorithm')
      )
      const expectedExternalUrl = (isExternal && !isPresigned) ? logoUrl : ''
      
      const hasChangesNow = 
        watchedFields[0] !== (data.workspace_name || '') ||
        watchedFields[1] !== (data.timezone || '') ||
        watchedFields[2] !== expectedExternalUrl
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
      // Logo upload saves automatically, clear external URL field since we're using uploaded file
      // Don't sync with result.brand_logo_url because it might be a presigned URL (temporary)
      setValue('external_logo_url', '', { shouldValidate: false })
      setHasChanges(false)
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
      setValue('external_logo_url', '', { shouldValidate: false })
      setHasChanges(false)
    } catch (error: any) {
      alert(`Failed to remove logo: ${error.message}`)
    }
  }

  const onSubmit = async (formData: GeneralForm) => {
    try {
      const updates: Record<string, string | null> = {}
      if (formData.workspace_name !== undefined) {
        updates.workspace_name = formData.workspace_name || null
      }
      if (formData.timezone !== undefined) {
        updates.timezone = formData.timezone || null
      }
      // Handle external logo URL
      if (formData.external_logo_url !== undefined) {
        if (formData.external_logo_url === '' || formData.external_logo_url === null) {
          // If external URL is empty and we have an uploaded logo, don't change it
          // If external URL is empty and we don't have an uploaded logo, delete logo
          if (!isUploadedLogo) {
            updates.brand_logo_url = null
          }
        } else {
          // Set external URL as logo
          updates.brand_logo_url = formData.external_logo_url
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
              {/* Show current logo (uploaded or external) */}
              {currentLogoUrl ? (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={
                        currentLogoUrl.startsWith('http://') || currentLogoUrl.startsWith('https://')
                          ? currentLogoUrl
                          : (() => {
                              // For static files, always use the full API URL, not the proxy
                              const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.agoralia.app'
                              // If VITE_API_BASE_URL is a relative path like /api, use the full URL instead
                              const fullApiUrl = apiBaseUrl.startsWith('http://') || apiBaseUrl.startsWith('https://')
                                ? apiBaseUrl
                                : 'https://api.agoralia.app'
                              const path = currentLogoUrl.startsWith('/') 
                                ? currentLogoUrl 
                                : `/${currentLogoUrl}`
                              return `${fullApiUrl}${path}`
                            })()
                      }
                      alt="Workspace logo"
                      className="h-16 w-16 rounded-full object-cover border"
                      onError={(e) => {
                        // Hide broken image and show placeholder
                        const img = e.target as HTMLImageElement
                        img.style.display = 'none'
                        // Show a message that the file is missing
                        const parent = img.parentElement
                        if (parent && !parent.querySelector('.logo-error-message')) {
                          const errorMsg = document.createElement('div')
                          errorMsg.className = 'logo-error-message flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-muted-foreground bg-muted text-xs text-muted-foreground text-center px-2'
                          errorMsg.textContent = 'Logo file missing'
                          parent.appendChild(errorMsg)
                        }
                      }}
                    />
                  </div>
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
              <div>
                <Label htmlFor="external_logo_url" className="text-sm text-muted-foreground">
                  Or enter external logo URL
                </Label>
                <Input
                  id="external_logo_url"
                  {...register('external_logo_url')}
                  placeholder="https://example.com/logo.png"
                  className="mt-1.5"
                  onChange={(e) => {
                    register('external_logo_url').onChange(e)
                    setHasChanges(true)
                  }}
                />
                {errors.external_logo_url && (
                  <p className="mt-1 text-sm text-destructive">{errors.external_logo_url.message}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter an external URL to use as logo. Click Save to apply.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            {hasChanges && (
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
            )}
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
        </form>
      </CardContent>
    </Card>
  )
}
