import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function Calls() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const res = await apiFetch('/calls')
    const data = await res.json()
    setRows(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <h1>Calls</h1>
      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ color: '#6b7280' }}>{loading ? 'Loading…' : `${rows.length} items`}</div>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Created</th>
              <th>Direction</th>
              <th>To</th>
              <th>From</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.direction}</td>
                <td>{r.to || '—'}</td>
                <td>{r.from || '—'}</td>
                <td>{r.status}</td>
                <td><a className="btn" href={`/calls/${r.id}`}>Apri</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


