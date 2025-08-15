import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function Admin() {
  const [rows, setRows] = useState([])
  const [email, setEmail] = useState(localStorage.getItem('admin_email') || '')
  const [error, setError] = useState('')
  async function load() {
    setError('')
    try {
      const r = await fetch(`${location.origin.replace(/:\\d+$/, ':8000')}/admin/overview`, { headers: { 'X-Admin-Email': email } })
      const j = await r.json()
      if (!r.ok) { setError(j?.detail || `Error ${r.status}`); setRows([]); return }
      setRows(j.tenants || [])
    } catch(e) { setError('Network error') }
  }
  useEffect(() => { if (email) load() }, [])
  return (
    <div>
      <h1>Admin</h1>
      <div className="panel" style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input className="input" placeholder="Admin email" value={email} onChange={(e)=> setEmail(e.target.value)} />
        <button className="btn" onClick={()=> { localStorage.setItem('admin_email', email); load() }}>Load</button>
        {error && <span className="kpi-title" style={{ color:'#b91c1c' }}>{error}</span>}
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <table className="table">
          <thead><tr><th>Tenant</th><th>Plan</th><th>Status</th><th>Minutes MTD</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (<tr key={i}><td>{r.tenant_id ?? '—'}</td><td>{r.plan}</td><td>{r.status}</td><td>{r.minutes_mtd}</td></tr>))}
            {!rows.length && <tr><td colSpan="4" className="kpi-title">—</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}


