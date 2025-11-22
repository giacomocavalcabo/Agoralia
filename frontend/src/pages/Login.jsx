import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import Button from '../components/ui/Button.jsx'
import Input from '../components/ui/Input.jsx'
import Card from '../components/ui/Card.jsx'
import { endpoints } from '../lib/endpoints'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [adminSecret, setAdminSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const redirectGoogle = `${window.location.origin}/google-login/callback`

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const path = mode === 'login' ? endpoints.auth.login : endpoints.auth.register
      const body = mode === 'login' ? { email, password } : { email, password, first_name: firstName, last_name: lastName, admin_secret: adminSecret }
      
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
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 400 }}>
        <Card style={{ display: 'grid', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--h2-size)', lineHeight: 'var(--h2-line)', fontWeight: 'var(--h2-weight)' }}>
            Agoralia
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" variant={mode==='login'?'primary':'default'} onClick={() => setMode('login')}>Login</Button>
            <Button type="button" variant={mode==='register'?'primary':'default'} onClick={() => setMode('register')}>Register</Button>
          </div>
          <Button type="button" onClick={async ()=>{
            const res = await apiFetch(endpoints.auth.googleStart, { method: 'POST', body: { redirect_uri: redirectGoogle } })
            const data = await res.json().catch(()=>({}))
            if (!res.ok || !data.auth_url) {
              alert(`Errore avvio Google OAuth: ${(data && data.detail) || res.statusText}`)
              return
            }
            window.location.assign(data.auth_url)
          }}>Login con Google</Button>
          {mode === 'register' && (
            <>
              <Input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              <Input placeholder="Admin signup secret (optional)" value={adminSecret} onChange={(e) => setAdminSecret(e.target.value)} />
            </>
          )}
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button variant="primary" type="submit" disabled={loading}>{loading ? '...' : (mode==='login'?'Login':'Create account')}</Button>
        </Card>
      </form>
    </div>
  )
}


