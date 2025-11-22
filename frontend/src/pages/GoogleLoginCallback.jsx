import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useToast } from '../components/ToastProvider.jsx'
import Button from '../components/ui/Button.jsx'
import Input from '../components/ui/Input.jsx'
import Card from '../components/ui/Card.jsx'

export default function GoogleLoginCallback() {
  const navigate = useNavigate()
  const toast = useToast()
  const [needsCompletion, setNeedsCompletion] = useState(false)
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search)
    const code = qp.get('code')
    const redirect_uri = window.location.origin + '/google-login/callback'
    if (!code) return
    
    // Try to complete login/registration
    ;(async () => {
      try {
        const res = await apiFetch('/auth/google/callback', { method: 'POST', body: { code, redirect_uri } })
        const data = await res.json().catch(()=>({}))
        
        if (res.ok) {
          // Check if name completion is needed
          if (data.needs_name_completion) {
            setNeedsCompletion(true)
            setEmail(data.email || '')
            setFirstName(data.first_name || '')
            setLastName(data.last_name || '')
          } else {
            // Login successful
            localStorage.setItem('auth_token', data.token)
            localStorage.setItem('tenant_id', String(data.tenant_id))
            if (data.is_admin) localStorage.setItem('is_admin', '1'); else localStorage.removeItem('is_admin')
            toast.success('Login con Google riuscito')
            navigate('/', { replace: true })
          }
        } else {
          toast.error(`Errore login Google: ${data.detail || res.status}`)
          navigate('/login', { replace: true })
        }
      } catch (err) {
        toast.error(`Errore: ${err.message}`)
        navigate('/login', { replace: true })
      }
    })()
  }, [])
  
  const handleComplete = async (e) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Nome e Cognome sono obbligatori')
      return
    }
    
    setLoading(true)
    try {
      const res = await apiFetch('/auth/google/complete', {
        method: 'POST',
        body: { email, first_name: firstName.trim(), last_name: lastName.trim() }
      })
      const data = await res.json().catch(()=>({}))
      
      if (res.ok) {
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('tenant_id', String(data.tenant_id))
        if (data.is_admin) localStorage.setItem('is_admin', '1'); else localStorage.removeItem('is_admin')
        toast.success('Registrazione completata con successo')
        navigate('/', { replace: true })
      } else {
        toast.error(`Errore completamento registrazione: ${data.detail || res.status}`)
      }
    } catch (err) {
      toast.error(`Errore: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }
  
  if (needsCompletion) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
        <form onSubmit={handleComplete} style={{ width: '100%', maxWidth: 400 }}>
          <Card style={{ display: 'grid', gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 'var(--h2-size)', lineHeight: 'var(--h2-line)', fontWeight: 'var(--h2-weight)' }}>
              Completa la registrazione
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Per completare la registrazione con Google, inserisci il tuo nome e cognome.
            </p>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              disabled
            />
            <Input
              placeholder="Nome"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              placeholder="Cognome"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? '...' : 'Completa registrazione'}
            </Button>
          </Card>
        </form>
      </div>
    )
  }
  
  return <div style={{ padding: 24 }}>Accedo con Google…</div>
}
