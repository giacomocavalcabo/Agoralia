import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const DEFAULT_ACTIONS = [
  { id: 'import', label: 'Import CSV', run: (nav) => nav('/import') },
  { id: 'new_campaign', label: 'New Campaign', run: (nav) => nav('/campaigns') },
  { id: 'schedule', label: 'Schedule call', run: (nav) => nav('/leads') },
  { id: 'settings', label: 'Open Settings', run: (nav) => nav('/settings') },
  { id: 'webcall', label: 'Start web call', run: async () => { try { await fetch('http://127.0.0.1:8000/calls/retell/web', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) }) } catch {} } },
]

export default function CommandPalette({ open, onClose, actions = DEFAULT_ACTIONS }) {
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  const filtered = useMemo(() => actions.filter(a => a.label.toLowerCase().includes(q.toLowerCase())), [q, actions])
  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" className="cp-root" onMouseDown={onClose}>
      <div className="cp-card" onMouseDown={(e) => e.stopPropagation()}>
        <input autoFocus ref={ref} className="input" placeholder="Type a command…" value={q} onChange={(e)=>setQ(e.target.value)} />
        <div style={{ display:'grid', gap:6, marginTop: 8 }}>
          {filtered.map((a) => (
            <button key={a.id} className="btn" onClick={()=>{ onClose?.(); a.run(nav) }}>{a.label}</button>
          ))}
        </div>
      </div>
      <style>{`
        .cp-root { position: fixed; inset: 0; background: rgba(0,0,0,.3); display: flex; align-items: flex-start; justify-content: center; padding-top: 10vh; z-index: 10000; }
        .cp-card { width: 640px; max-width: 92vw; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.12); }
      `}</style>
    </div>
  )
}


