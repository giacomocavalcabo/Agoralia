import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { useToast } from '../components/ToastProvider.jsx'
import { safeArray } from '../lib/util'

export default function Compliance() {
  const [rows, setRows] = useState([])
  const [num, setNum] = useState('')
  const toast = useToast()

  async function load() {
    const res = await apiRequest('/compliance/dnc')
    if (res.ok) setRows(safeArray(res.data)); else { setRows([]); toast.error(`DNC: ${res.error}`) }
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!num) return
    const r = await apiRequest('/compliance/dnc', { method: 'POST', body: { e164: num } })
    if (!r.ok) toast.error(`DNC add: ${r.error}`)
    setNum('')
    load()
  }

  return (
    <div>
      <h1>Compliance</h1>
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
        <input className="input" placeholder="E.164 es. +39..." value={num} onChange={(e) => setNum(e.target.value)} />
        <button className="btn" onClick={add}>Add to DNC</button>
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <table className="table">
          <thead><tr><th>ID</th><th>E.164</th><th>Added</th><th>Actions</th></tr></thead>
          <tbody>
            {safeArray(rows).map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.e164}</td><td>{new Date(r.created_at).toLocaleString()}</td>
                <td><button className="btn" onClick={async () => { const d = await apiRequest(`/compliance/dnc/${r.id}`, { method: 'DELETE' }); if (!d.ok) toast.error(`DNC remove: ${d.error}`); load() }}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


