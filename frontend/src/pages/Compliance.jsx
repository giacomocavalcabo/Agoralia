import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function Compliance() {
  const [rows, setRows] = useState([])
  const [num, setNum] = useState('')

  async function load() {
    const res = await apiFetch('/compliance/dnc')
    const data = await res.json()
    setRows(data)
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!num) return
    await apiFetch('/compliance/dnc', { method: 'POST', body: { e164: num } })
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
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.e164}</td><td>{new Date(r.created_at).toLocaleString()}</td>
                <td><button className="btn" onClick={async () => { await apiFetch(`/compliance/dnc/${r.id}`, { method: 'DELETE' }); load() }}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


