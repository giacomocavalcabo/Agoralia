import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { apiFetch } from './api'

const AuthContext = createContext({
  status: 'idle', // 'idle' | 'checking' | 'authenticated' | 'unauthenticated'
  user: null,
  tenantId: null,
  isAdmin: false,
  refreshAuth: async () => {},
  clearAuth: () => {}
})

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('idle')
  const [user, setUser] = useState(null)
  const [tenantId, setTenantId] = useState(() => localStorage.getItem('tenant_id'))
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('is_admin') === '1')

  const clearAuth = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('tenant_id')
    localStorage.removeItem('is_admin')
    setUser(null)
    setTenantId(null)
    setIsAdmin(false)
    setStatus('unauthenticated')
  }, [])

  const refreshAuth = useCallback(async () => {
    const token = localStorage.getItem('auth_token')
    const tid = localStorage.getItem('tenant_id')
    if (!token || !tid) {
      clearAuth()
      return { ok: false }
    }
    setStatus('checking')
    try {
      const res = await apiFetch('/auth/me')
      if (!res.ok) {
        clearAuth()
        return { ok: false }
      }
      const data = await res.json().catch(() => ({}))
      setUser(data || {})
      setTenantId(tid)
      setIsAdmin(localStorage.getItem('is_admin') === '1')
      setStatus('authenticated')
      return { ok: true, data }
    } catch (_) {
      clearAuth()
      return { ok: false }
    }
  }, [clearAuth])

  useEffect(() => {
    // Esegue una verifica iniziale all'avvio
    if (status === 'idle') {
      refreshAuth()
    }
    const onForcedLogout = () => clearAuth()
    window.addEventListener('auth:logout', onForcedLogout)
    return () => window.removeEventListener('auth:logout', onForcedLogout)
  }, [status, refreshAuth])

  const value = useMemo(() => ({
    status,
    user,
    tenantId,
    isAdmin,
    refreshAuth,
    clearAuth
  }), [status, user, tenantId, isAdmin, refreshAuth, clearAuth])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

export function RequireAuth({ children }) {
  const { status, refreshAuth } = useAuth()
  const hasLocal = !!localStorage.getItem('auth_token') && !!localStorage.getItem('tenant_id')

  useEffect(() => {
    if (status === 'idle' && hasLocal) {
      refreshAuth()
    }
  }, [status, hasLocal, refreshAuth])

  if (!hasLocal) {
    // Non autenticato localmente → manda a login via route element
    // Nota: il Redirect concreto viene gestito nel router configurando l'element per /login
    return null
  }
  if (status === 'checking' || status === 'idle') {
    return <div style={{ padding: 24 }}>Checking session…</div>
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }
  return children
}


