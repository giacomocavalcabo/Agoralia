import { Button } from '@/shared/ui/button'
import { getTenantId } from '@/shared/api/client'

export function Header() {
  const tenantId = getTenantId()

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
          Tenant ID: {tenantId ?? 'N/A'}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </header>
  )
}

