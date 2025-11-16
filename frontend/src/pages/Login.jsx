import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [adminSecret, setAdminSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const redirectGoogle = `${window.location.origin}/google-login/callback`

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const body = mode === 'login' ? { email, password } : { email, password, name, admin_secret: adminSecret }
      
      const res = await apiFetch(path, { method: 'POST', body })
      
      // Verifica content-type prima di parsare JSON
      const contentType = res.headers.get('content-type') || ''
      let data
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        // Se non è JSON, probabilmente è HTML (404 o errore)
        const text = await res.text()
        console.error('Risposta non-JSON ricevuta:', text.substring(0, 200))
        console.error('Response URL:', res.url)
        console.error('Response status:', res.status)
        throw new Error(`Errore del server: ${res.status} ${res.statusText}. La risposta non è JSON. URL: ${res.url}`)
      }
      
      if (!res.ok) throw new Error(data.detail || res.statusText)
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('tenant_id', String(data.tenant_id))
      if (data.is_admin) localStorage.setItem('is_admin', '1'); else localStorage.removeItem('is_admin')
      navigate('/', { replace: true })
    } catch (err) {
      alert(`Errore: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <form onSubmit={submit} className="panel" style={{ padding: 24, width: 360, display: 'grid', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Agoralia</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={`btn ${mode==='login'?'primary':''}`} onClick={() => setMode('login')}>Login</button>
          <button type="button" className={`btn ${mode==='register'?'primary':''}`} onClick={() => setMode('register')}>Register</button>
        </div>
        <button type="button" className="btn" onClick={async ()=>{
          const res = await apiFetch('/auth/google/start', { method: 'POST', body: { redirect_uri: redirectGoogle } })
          const data = await res.json().catch(()=>({}))
          if (!res.ok || !data.auth_url) {
            alert(`Errore avvio Google OAuth: ${(data && data.detail) || res.statusText}`)
            return
          }
          window.location.href = data.auth_url
        }}>Login con Google</button>
        {mode === 'register' && (
          <>
            <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder="Admin signup secret (optional)" value={adminSecret} onChange={(e) => setAdminSecret(e.target.value)} />
          </>
        )}
        <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn primary" type="submit" disabled={loading}>{loading ? '...' : (mode==='login'?'Login':'Create account')}</button>
      </form>
    </div>
  )
}


