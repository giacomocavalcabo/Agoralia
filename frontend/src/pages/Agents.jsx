import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { useToast } from '../components/ToastProvider.jsx'
import { safeArray } from '../lib/util'

export default function Agents() {
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [lang, setLang] = useState('it-IT')
  const [voiceId, setVoiceId] = useState('')
  const toast = useToast()

  async function load() {
    const res = await apiRequest('/agents')
    if (res.ok) setRows(safeArray(res.data)); else { setRows([]); toast.error(`Agents: ${res.error}`) }
  }

  useEffect(() => { load() }, [])

  async function createAgent() {
    const res = await apiRequest('/agents', { method: 'POST', body: { name, lang, voice_id: voiceId } })
    if (res.ok) { setName(''); setVoiceId(''); load() } else toast.error(`Create agent: ${res.error}`)
  }

  return (
    <div>
      <h1>Agents</h1>
      <div className="panel" style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 1fr 120px', gap: 8 }}>
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option>it-IT</option>
            <option>fr-FR</option>
            <option>ar-EG</option>
          </select>
          <input className="input" placeholder="Voice ID (optional)" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} />
          <button className="btn" onClick={createAgent}>Create</button>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Lang</th><th>Voice</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {safeArray(rows).map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.name}</td><td>{r.lang}</td><td>{r.voice_id || '—'}</td>
                <td><button className="btn" onClick={async () => { const d = await apiRequest(`/agents/${r.id}`, { method: 'DELETE' }); if (!d.ok) toast.error(`Delete agent: ${d.error}`); load() }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


