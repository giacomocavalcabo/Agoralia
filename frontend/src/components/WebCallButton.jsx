import { useState } from 'react'
import { useToast } from './ToastProvider.jsx'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'

export default function WebCallButton({ label = 'Start Web Call', className = 'btn primary' }) {
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  async function start() {
    if (loading) return
    setLoading(true)
    try {
      const data = await apiFetch('/calls/retell/web', {
        method: 'POST',
        body: {}
      })
      if (data) {
        toast.success('Web call started')
        if (data?.id) navigate(`/calls/${data.id}`)
      } else {
        toast.error(data?.detail || 'Error')
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


