import { useEffect } from 'react'
import { apiFetch } from '../lib/api'

export default function GoogleCallback() {
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search)
    const code = qp.get('code')
    const redirect_uri = window.location.origin + '/google/callback'
    if (!code) return
    ;(async () => {
      const res = await apiFetch('/integrations/google/auth/callback', { method: 'POST', body: { code, redirect_uri } })
      if (res.ok) {
        alert('Google Calendar connected')
        window.location.href = '/impostazioni'
      } else {
        const data = await res.json().catch(()=>({}))
        alert(`Errore Google: ${data.detail || res.status}`)
        window.location.href = '/impostazioni'
      }
    })()
  }, [])
  return <div style={{ padding: 24 }}>Connecting Google…</div>
}


