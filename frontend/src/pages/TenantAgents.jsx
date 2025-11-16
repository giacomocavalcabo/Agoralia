import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { useToast } from '../components/ToastProvider.jsx'
import { safeArray } from '../lib/util'

export default function TenantAgents() {
  const [rows, setRows] = useState([])
  const [kind, setKind] = useState('voice')
  const [lang, setLang] = useState('')
  const [agentId, setAgentId] = useState('')
  const [isMulti, setIsMulti] = useState(false)
  const toast = useToast()

  async function load() {
    const res = await apiRequest('/tenant_agents')
    if (res.ok) setRows(safeArray(res.data)); else { setRows([]); toast.error(`Tenant agents: ${res.error}`) }
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!agentId) return
    const r = await apiRequest('/tenant_agents', { method:'POST', body:{ kind, lang: lang || null, agent_id: agentId, is_multi: isMulti } })
    if (!r.ok) toast.error(`Save tenant agent: ${r.error}`)
    setAgentId(''); setLang(''); setIsMulti(false)
    await load()
  }

  return (
    <div>
      <h3>Tenant Agents</h3>
      <div className="panel" style={{ display:'grid', gridTemplateColumns:'140px 140px 1fr 120px', gap:8, alignItems:'center' }}>
        <select className="input" value={kind} onChange={(e)=> setKind(e.target.value)}>
          <option value="voice">voice</option>
          <option value="chat">chat</option>
        </select>
        <select className="input" value={lang} onChange={(e)=> setLang(e.target.value)}>
          <option value="">(any)</option>
          {['it-IT','en-US','fr-FR','ar-EG','hi-IN'].map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input className="input" placeholder="agent_id" value={agentId} onChange={(e)=> setAgentId(e.target.value)} />
        <label style={{ display:'flex', gap:6, alignItems:'center' }}><input type="checkbox" checked={isMulti} onChange={(e)=> setIsMulti(e.target.checked)} /> is_multi</label>
        <button className="btn" onClick={save}>Save</button>
      </div>
      <div className="panel" style={{ marginTop:12 }}>
        <table className="table">
          <thead><tr><th>ID</th><th>Kind</th><th>Lang</th><th>Agent ID</th><th>Multi</th><th>Actions</th></tr></thead>
          <tbody>
            {safeArray(rows).map(r => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.kind}</td><td>{r.lang || '(any)'}</td><td>{r.agent_id}</td><td>{r.is_multi ? 'yes' : 'no'}</td>
                <td><button className="btn" onClick={async ()=>{ const d = await apiRequest(`/tenant_agents/${r.id}`, { method:'DELETE' }); if (!d.ok) toast.error(`Delete tenant agent: ${d.error}`); await load() }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


