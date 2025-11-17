import { Button } from '@/shared/ui/button'
import { getTenantId } from '@/shared/api/client'
import { useEffectiveSettings } from '@/features/settings/hooks'
import { cn } from '@/shared/utils/cn'

export function Header() {
  const tenantId = getTenantId()
  const { data: effectiveSettings } = useEffectiveSettings()

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('tenant_id')
    localStorage.removeItem('is_admin')
    window.location.href = '/login'
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {effectiveSettings?.workspace_name || `Tenant ID: ${tenantId ?? 'N/A'}`}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {effectiveSettings?.brand_logo_url && (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-background overflow-hidden">
            <img
              src={
                effectiveSettings.brand_logo_url.startsWith('/uploads/') || effectiveSettings.brand_logo_url.startsWith('workspace-logos/')
                  ? `${import.meta.env.VITE_API_BASE_URL || 'https://api.agoralia.app'}${
                      effectiveSettings.brand_logo_url.startsWith('/uploads/') 
                        ? effectiveSettings.brand_logo_url 
                        : `/uploads/${effectiveSettings.brand_logo_url}`
                    }`
                  : effectiveSettings.brand_logo_url
              }
              alt="Workspace logo"
              className="h-full w-full object-cover"
              onError={(e) => {
                console.error('Failed to load logo:', effectiveSettings.brand_logo_url, e)
              }}
            />
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </header>
  )
}
