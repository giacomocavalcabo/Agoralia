import { useEffect } from 'react'
import { apiFetch } from '../lib/api'

export default function HubSpotCallback() {
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search)
    const code = qp.get('code')
    const redirect_uri = window.location.origin + '/hubspot/callback'
    if (!code) return
    ;(async () => {
      const res = await apiFetch('/crm/hubspot/auth/callback', { method: 'POST', body: { code, redirect_uri } })
      if (res.ok) {
        alert('HubSpot connected')
        window.location.href = '/impostazioni'
      } else {
        const data = await res.json().catch(()=>({}))
        alert(`Errore HubSpot: ${data.detail || res.status}`)
        window.location.href = '/impostazioni'
      }
    })()
  }, [])
  return <div style={{ padding: 24 }}>Connecting HubSpot…</div>
}


