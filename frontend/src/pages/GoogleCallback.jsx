import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'

export default function GoogleCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search)
    const code = qp.get('code')
    const redirect_uri = window.location.origin + '/google/callback'
    if (!code) return
    ;(async () => {
      const res = await apiFetch('/integrations/google/auth/callback', { method: 'POST', body: { code, redirect_uri } })
      if (res.ok) {
        alert('Google Calendar connected')
        navigate('/settings', { replace: true })
      } else {
        const data = await res.json().catch(()=>({}))
        alert(`Errore Google: ${data.detail || res.status}`)
        navigate('/settings', { replace: true })
      }
    })()
  }, [])
  return <div style={{ padding: 24 }}>Connecting Google…</div>
}


