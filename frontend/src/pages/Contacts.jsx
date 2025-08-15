import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

const MOCK = [
  { id: 1, name: 'Mario Rossi', phone: '+39333111222', lang: 'it-IT' },
  { id: 2, name: 'Anne Dubois', phone: '+33123456789', lang: 'fr-FR' },
  { id: 3, name: 'Youssef', phone: '+212612345678', lang: 'ar-MA' },
]

export default function Contacts() {
  const [rows] = useState(MOCK)
  const [agents, setAgents] = useState([])
  const [agentId, setAgentId] = useState('')

  useEffect(() => {
    apiFetch('/agents').then((r) => r.json()).then(setAgents).catch(() => {})
  }, [])

  async function callNumber(phone) {
    const res = await apiFetch('/calls/retell/outbound', { method: 'POST', body: { to: phone, agent_id: agentId || undefined } })
    const data = await res.json()
    alert(res.ok ? `Call created: ${JSON.stringify(data)}` : `Errore: ${data.detail || res.status}`)
  }

  return (
    <div style={{ padding: 0 }}>
      <h1>Contacts</h1>
      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <label>Agent</label>
          <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">Default</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.lang})</option>
            ))}
          </select>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Language</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.phone}</td>
                <td>{r.lang}</td>
                <td>
                  <button className="btn" onClick={() => callNumber(r.phone)}>Call</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


