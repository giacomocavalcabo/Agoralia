import { useState } from 'react'
import { useToast } from './ToastProvider.jsx'
import { useNavigate } from 'react-router-dom'

export default function WebCallButton({ label = 'Start Web Call', className = 'btn primary' }) {
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  async function start() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('http://127.0.0.1:8000/calls/retell/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('Web call started')
        if (data?.id) navigate(`/calls/${data.id}`)
      } else {
        toast.error(data?.detail || `Error ${res.status}`)
      }
    } catch (e) {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button className={className} onClick={start} disabled={loading}>
      {loading ? 'Starting…' : label}
    </button>
  )
}


