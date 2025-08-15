import Modal from './Modal.jsx'
import { useEffect, useState } from 'react'
import { useToast } from './ToastProvider.jsx'
import { apiFetch } from '../lib/api'

export default function TemplatesModal({ open, onClose }) {
  const toast = useToast()
  const [applying, setApplying] = useState(false)
  const [templates, setTemplates] = useState([])
  useEffect(() => { if (open) apiFetch('/templates').then(r=>r.json()).then((d)=> setTemplates(d.items || [])).catch(()=> setTemplates([])) }, [open])

  async function apply(tpl) {
    setApplying(true)
    try {
      const res = await apiFetch('/templates/apply', { method: 'POST', body: { template_id: tpl.id } })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Template applied: ${tpl.name}`)
        // Redirect to campaign if provided
        if (data?.campaign_id) window.location.href = `/campaigns`
      } else {
        toast.error(data?.detail || `Error ${res.status}`)
      }
      onClose?.()
    } finally { setApplying(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Template Library"
      footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        {templates.map((t) => (
          <div key={t.id} className="panel" style={{ display:'grid', gap:6 }}>
            <div style={{ fontWeight:600 }}>{t.name}</div>
            <div className="kpi-title">{t.lang}</div>
            <div style={{ color:'#6b7280' }}>{t.desc}</div>
            <button className="btn primary" disabled={applying} onClick={() => apply(t)}>Use template</button>
          </div>
        ))}
      </div>
    </Modal>
  )
}


