import { api } from '@/shared/api/client'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  name?: string
  admin_secret?: string
}

export interface AuthResponse {
  token: string
  tenant_id: number
  is_admin: boolean
}

export interface User {
  user_id: number
  tenant_id: number
  is_admin: boolean
  email: string | null
  name: string | null
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload)
  return data
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload)
  return data
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
  return data
}

