import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { useToast } from '../components/ToastProvider.jsx'
import { safeArray } from '../lib/util'

export default function ContactHistory() {
  const { phone } = useParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [outcome, setOutcome] = useState('')
  const [fromTs, setFromTs] = useState('')
  const [toTs, setToTs] = useState('')
  const toast = useToast()

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (outcome) params.set('outcome', outcome)
    if (fromTs) params.set('created_gte', fromTs)
    if (toTs) params.set('created_lte', toTs)
    const { ok, data, error } = await apiRequest(`/history/${encodeURIComponent(phone)}${params.toString() ? `?${params.toString()}` : ''}`)
    if (!ok) { toast.error(`History: ${error}`); setRows([]) } else setRows(safeArray(data))
    setLoading(false)
  }
  useEffect(() => { load() }, [phone])

  return (
    <div>
      <h1>History for {phone}</h1>
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px', gap: 8, alignItems: 'center' }}>
        <div>
          <div className="kpi-title" style={{ marginBottom: 6 }}>Outcome</div>
          <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">Any</option>
            <option value="qualified">qualified</option>
            <option value="rfq">rfq</option>
            <option value="quote_sent">quote_sent</option>
            <option value="reorder">reorder</option>
            <option value="not_interested">not_interested</option>
            <option value="callback">callback</option>
            <option value="no_answer">no_answer</option>
            <option value="voicemail">voicemail</option>
            <option value="do_not_call">do_not_call</option>
          </select>
        </div>
        <div>
          <div className="kpi-title" style={{ marginBottom: 6 }}>From</div>
          <input className="input" type="datetime-local" value={fromTs} onChange={(e) => setFromTs(e.target.value)} />
        </div>
        <div>
          <div className="kpi-title" style={{ marginBottom: 6 }}>To</div>
          <input className="input" type="datetime-local" value={toTs} onChange={(e) => setToTs(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Apply'}</button>
          <button className="btn" onClick={() => exportCsv(rows)}>Export CSV</button>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <table className="table">
          <thead><tr><th>When</th><th>Direction</th><th>To</th><th>From</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>
            {safeArray(rows).map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.direction}</td>
                <td>{r.to || '—'}</td>
                <td>{r.from || '—'}</td>
                <td>{r.outcome || r.status}</td>
                <td><a className="btn" href={`/calls/${r.id}`}>Apri</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function exportCsv(rows) {
  const header = ['id','created_at','direction','to','from','status','outcome']
  const lines = [header.join(',')]
  for (const r of rows) {
    const vals = header.map((k) => JSON.stringify(r[k] ?? ''))
    lines.push(vals.join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'contact_history.csv'
  a.click()
  URL.revokeObjectURL(url)
}


