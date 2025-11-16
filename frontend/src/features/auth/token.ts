export function setAuthToken(token: string) {
  localStorage.setItem('auth_token', token)
}

export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

export function setTenantId(tenantId: string | number) {
  localStorage.setItem('tenant_id', String(tenantId))
}

export function getTenantId(): number | null {
  const tid = localStorage.getItem('tenant_id')
  return tid ? parseInt(tid, 10) : null
}

export function setIsAdmin(isAdmin: boolean) {
  localStorage.setItem('is_admin', String(isAdmin))
}

export function getIsAdmin(): boolean {
  return localStorage.getItem('is_admin') === 'true'
}

export function clearAuth() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('tenant_id')
  localStorage.removeItem('is_admin')
}

