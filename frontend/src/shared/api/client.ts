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
  (error: AxiosError<{ detail?: string }>) => {
    if (error.response?.status === 401) {
      // Token scaduto o invalido → logout
      localStorage.removeItem('auth_token')
      localStorage.removeItem('tenant_id')
      localStorage.removeItem('is_admin')
      window.location.href = '/login'
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

