import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'

export default function GoogleLoginCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search)
    const code = qp.get('code')
    const redirect_uri = window.location.origin + '/google-login/callback'
    if (!code) return
    ;(async () => {
      const res = await apiFetch('/auth/google/callback', { method: 'POST', body: { code, redirect_uri } })
      const data = await res.json().catch(()=>({}))
      if (res.ok) {
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('tenant_id', String(data.tenant_id))
        if (data.is_admin) localStorage.setItem('is_admin', '1'); else localStorage.removeItem('is_admin')
        navigate('/', { replace: true })
      } else {
        alert(`Errore login Google: ${data.detail || res.status}`)
        navigate('/login', { replace: true })
      }
    })()
  }, [])
  return <div style={{ padding: 24 }}>Accedo con Google…</div>
}


