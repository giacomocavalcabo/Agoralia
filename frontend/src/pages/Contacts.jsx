import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { useToast } from '../components/ToastProvider.jsx'
import { safeArray } from '../lib/util'

const MOCK = [
  { id: 1, name: 'Mario Rossi', phone: '+39333111222', lang: 'it-IT' },
  { id: 2, name: 'Anne Dubois', phone: '+33123456789', lang: 'fr-FR' },
  { id: 3, name: 'Youssef', phone: '+212612345678', lang: 'ar-MA' },
]

export default function Contacts() {
  const [rows] = useState(MOCK)
  const [agents, setAgents] = useState([])
  const [agentId, setAgentId] = useState('')
  const toast = useToast()

  useEffect(() => {
    apiRequest('/agents').then((r) => { if (r.ok && Array.isArray(r.data)) setAgents(r.data); else if (!r.ok) toast.error(`Agents: ${r.error}`) })
  }, [])

  async function callNumber(phone) {
    const r = await apiRequest('/calls/retell/outbound', { method: 'POST', body: { to: phone, agent_id: agentId || undefined } })
    if (r.ok) toast.success('Call created')
    else toast.error(`Call error: ${r.error}`)
  }

  return (
    <div style={{ padding: 0 }}>
      <h1>Contacts</h1>
      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <label>Agent</label>
          <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">Default</option>
            {safeArray(agents).map((a) => (
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


