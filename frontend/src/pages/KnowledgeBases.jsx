import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function KnowledgeBases() {
  const [rows, setRows] = useState([])
  const [lang, setLang] = useState('it-IT')
  const [scope, setScope] = useState('tenant')

  async function load() {
    const res = await apiFetch('/kbs')
    const data = await res.json()
    setRows(data)
  }
  useEffect(() => { load() }, [])

  async function createKb() {
    const res = await apiFetch('/kbs', { method: 'POST', body: { lang, scope } })
    if (res.ok) load()
  }

  return (
    <div>
      <h1>Knowledge Bases</h1>
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 8 }}>
        <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
          <option>it-IT</option>
          <option>fr-FR</option>
          <option>ar-EG</option>
        </select>
        <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="tenant">tenant</option>
          <option value="global">global</option>
        </select>
        <button className="btn" onClick={createKb}>Create</button>
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <table className="table">
          <thead><tr><th>ID</th><th>Lang</th><th>Scope</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.lang}</td><td>{r.scope}</td>
                <td><button className="btn" onClick={async () => { await apiFetch(`/kbs/${r.id}`, { method: 'DELETE' }); load() }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


