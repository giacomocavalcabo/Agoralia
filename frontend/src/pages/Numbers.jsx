import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useMemo } from 'react'

export default function Numbers() {
  const [rows, setRows] = useState([])
  const [e164, setE164] = useState('')
  const [type, setType] = useState('retell')
  const [ent, setEnt] = useState({ inbound_enabled: false })

  async function load() {
    const res = await apiFetch('/numbers')
    const data = await res.json()
    setRows(data)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { apiFetch('/entitlements').then((r)=>r.json()).then(setEnt).catch(()=>{}) }, [])

  async function add() {
    const res = await apiFetch('/numbers', { method: 'POST', body: { e164, type } })
    if (res.ok) { setE164(''); load() }
  }

  return (
    <div>
      <h1>Phone Numbers {!ent.inbound_enabled && <span className="badge" style={{ marginLeft: 8, background:'#fff7ed' }} title="Inbound requires add-on">Inbound locked</span>}</h1>
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: '1fr 180px 120px', gap: 8 }}>
        <input className="input" placeholder="E.164 es. +39..." value={e164} onChange={(e) => setE164(e.target.value)} />
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} disabled={!ent.inbound_enabled && type === 'byo'} title={!ent.inbound_enabled && type==='byo' ? 'Inbound requires add-on' : ''}>
          <option value="retell">retell</option>
          <option value="byo">byo</option>
        </select>
        <button className="btn" onClick={add}>Add</button>
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <table className="table">
          <thead><tr><th>ID</th><th>Number</th><th>Type</th><th>Verified</th><th>Country</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.e164}</td><td>{r.type}</td><td>{r.verified ? 'yes' : 'no'}</td><td>{r.country || '—'}</td>
                <td><button className="btn" onClick={async () => { await apiFetch(`/numbers/${r.id}`, { method: 'DELETE' }); load() }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


