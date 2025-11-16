import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { login, register, getMe, type LoginPayload, type RegisterPayload } from './api'
import { getAuthToken } from '@/shared/api/client'

export function useAuth() {
  const token = getAuthToken()
  const hasToken = !!token

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minuti
  })
}

export function useLogin() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('tenant_id', String(data.tenant_id))
      if (data.is_admin) {
        localStorage.setItem('is_admin', '1')
      } else {
        localStorage.removeItem('is_admin')
      }
      qc.setQueryData(['auth', 'me'], {
        user_id: 0,
        tenant_id: data.tenant_id,
        is_admin: data.is_admin,
        email: null,
        name: null,
      })
      navigate('/')
    },
  })
}

export function useRegister() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('tenant_id', String(data.tenant_id))
      if (data.is_admin) {
        localStorage.setItem('is_admin', '1')
      } else {
        localStorage.removeItem('is_admin')
      }
      qc.setQueryData(['auth', 'me'], {
        user_id: 0,
        tenant_id: data.tenant_id,
        is_admin: data.is_admin,
        email: null,
        name: null,
      })
      navigate('/')
    },
  })
}

export function useRequireAuth() {
  const token = getAuthToken()
  const { data, isLoading } = useAuth()

  return {
    isAuthenticated: !!token && !!data,
    isLoading,
    user: data,
  }
}

