import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function Agents() {
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [lang, setLang] = useState('it-IT')
  const [voiceId, setVoiceId] = useState('')

  async function load() {
    const res = await apiFetch('/agents')
    const data = await res.json()
    setRows(data)
  }

  useEffect(() => { load() }, [])

  async function createAgent() {
    const res = await apiFetch('/agents', { method: 'POST', body: { name, lang, voice_id: voiceId } })
    if (res.ok) { setName(''); setVoiceId(''); load() }
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
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.name}</td><td>{r.lang}</td><td>{r.voice_id || '—'}</td>
                <td><button className="btn" onClick={async () => { await apiFetch(`/agents/${r.id}`, { method: 'DELETE' }); load() }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


