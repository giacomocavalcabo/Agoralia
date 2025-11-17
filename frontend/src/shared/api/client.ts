import axios, { AxiosError } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://api.agoralia.app'

export const api = axios.create({
  baseURL: API_BASE_URL,
})

// Interceptor per aggiungere token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

      // Interceptor per gestire errori
      api.interceptors.response.use(
        (response) => response,
        async (error: AxiosError<{ detail?: string }>) => {
          if (error.response?.status === 401) {
            // Token scaduto o invalido → logout
            localStorage.removeItem('auth_token')
            localStorage.removeItem('tenant_id')
            localStorage.removeItem('is_admin')
            window.location.href = '/login'
          } else if (error.response?.status === 403 && error.config?.url?.includes('/settings/workspace')) {
            // 403 su workspace settings → potrebbe essere che lo stato admin è cambiato
            // Prova a refreshare lo stato auth
            try {
              const { getMe } = await import('@/features/auth/api')
              const userData = await getMe()
              if (userData.is_admin) {
                // L'utente è admin ma il token non lo riflette → forzare refresh pagina
                // Il token verrà aggiornato al prossimo login
                console.warn('User is admin but token is outdated. Please refresh the page or logout/login.')
                // Non facciamo auto-refresh per non essere invasivi, ma logghiamo
              }
            } catch (e) {
              // Ignora errori nel refresh
            }
          }
          return Promise.reject(error)
        }
      )

export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

export function getTenantId(): number | null {
  const tid = localStorage.getItem('tenant_id')
  return tid ? parseInt(tid, 10) : null
}

export function setTenantId(tenantId: string | number) {
  localStorage.setItem('tenant_id', String(tenantId))
}

