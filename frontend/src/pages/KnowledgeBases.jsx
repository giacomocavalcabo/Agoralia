import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { useToast } from '../components/ToastProvider.jsx'
import { safeArray } from '../lib/util'

export default function KnowledgeBases() {
  const [rows, setRows] = useState([])
  const [lang, setLang] = useState('it-IT')
  const [scope, setScope] = useState('tenant')
  const toast = useToast()

  async function load() {
    const res = await apiRequest('/kbs')
    if (res.ok) setRows(safeArray(res.data)); else { setRows([]); toast.error(`KBs: ${res.error}`) }
  }
  useEffect(() => { load() }, [])

  async function createKb() {
    const res = await apiRequest('/kbs', { method: 'POST', body: { lang, scope } })
    if (res.ok) load(); else toast.error(`Create KB: ${res.error}`)
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
            {safeArray(rows).map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.lang}</td><td>{r.scope}</td>
                <td><button className="btn" onClick={async () => { const d = await apiRequest(`/kbs/${r.id}`, { method: 'DELETE' }); if (!d.ok) toast.error(`Delete: ${d.error}`); load() }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


