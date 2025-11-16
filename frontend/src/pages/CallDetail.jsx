import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiRequest, wsUrl } from '../lib/api'
import { createReconnectingWebSocket } from '../lib/ws'
import { useToast } from '../components/ToastProvider.jsx'

export default function CallDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [segments, setSegments] = useState([])
  const [summary, setSummary] = useState(null)
  const [outcome, setOutcome] = useState('')
  const [note, setNote] = useState('')

  const providerCallId = useMemo(() => data?.provider_call_id || null, [data])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await apiRequest(`/calls/${id}`)
      if (!res.ok) { toast.error(`Call detail: ${res.error}`); setData(null) } else setData(res.data || null)
      setLoading(false)
    }
    load()
  }, [id])

  async function refreshSegments() {
    const res = await apiRequest(`/calls/${id}/segments`)
    setSegments(Array.isArray(res.data) ? res.data : [])
  }

  async function refreshSummary() {
    const res = await apiRequest(`/calls/${id}/summary`)
    const json = res.data || {}
    setSummary(json?.summary || null)
    // attach structured if present
    if (json?.bant || json?.trade) {
      setSummary((prev) => ({ ...(prev || {}), __bant: json.bant, __trade: json.trade }))
    }
  }

  useEffect(() => {
    refreshSegments()
    refreshSummary()
  }, [id])

  // Subscribe to websocket for live updates
  useEffect(() => {
    const { close } = createReconnectingWebSocket(wsUrl('/ws'), {
      onMessage: (evt) => {
      try {
        const msg = JSON.parse(evt.data || '{}')
        const t = msg?.type
        const d = msg?.data || {}
        const matches = providerCallId && (d.call_id === providerCallId || d.id === providerCallId || d.provider_call_id === providerCallId)
        if (!matches) return
        if (t === 'call.transcript.append') {
          refreshSegments()
        }
        if (t === 'call.summary') {
          refreshSummary()
        }
      } catch {}
      }
    })
    return () => { try { close() } catch {} }
  }, [providerCallId])

  if (loading || !data) return <div>Loading…</div>

  return (
    <div>
      <h1>Call detail #{data.id}</h1>
      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div><div className="kpi-title">Created</div><div>{new Date(data.created_at).toLocaleString()}</div></div>
          <div><div className="kpi-title">Status</div><div>{data.status}</div></div>
          <div><div className="kpi-title">Direction</div><div>{data.direction}</div></div>
          <div><div className="kpi-title">To</div><div>{data.to || '—'}</div></div>
          <div><div className="kpi-title">From</div><div>{data.from || '—'}</div></div>
          <div><div className="kpi-title">Provider ID</div><div>{data.provider_call_id || '—'}</div></div>
          <div><div className="kpi-title">Disposition</div><div>{data.disposition || '—'}</div></div>
          {data.audio_url && (
            <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
              <audio controls src={data.audio_url} style={{ width: '100%' }} />
            </div>
          )}
        </div>
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <div className="kpi-title">Update disposition</div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 120px', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">Select…</option>
            <option value="rfq">RFQ</option>
            <option value="quote_sent">Quote sent</option>
            <option value="reorder">Reorder</option>
            <option value="stock_check">Stock check</option>
            <option value="quality_issue">Quality issue</option>
            <option value="qualified">Qualified</option>
            <option value="not_interested">Not interested</option>
            <option value="callback">Callback</option>
            <option value="no_answer">No answer</option>
            <option value="voicemail">Voicemail</option>
            <option value="do_not_call">Do not call</option>
          </select>
          <input className="input" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" onClick={async () => {
            if (!outcome) return
            await apiRequest(`/calls/${id}/disposition`, { method: 'POST', body: { outcome, note } })
            // refresh header
            const res = await apiRequest(`/calls/${id}`)
            if (res.ok) setData(res.data || null)
          }}>Save</button>
        </div>
      </div>
      {summary && (
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="kpi-title">Summary</div>
          {summary.__bant || summary.__trade ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="panel" style={{ margin: 0 }}>
                <div className="kpi-title">BANT</div>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(summary.__bant || {}, null, 2)}</pre>
              </div>
              <div className="panel" style={{ margin: 0 }}>
                <div className="kpi-title">TRADE</div>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(summary.__trade || {}, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(summary, null, 2)}</pre>
          )}
        </div>
      )}
      <div className="panel" style={{ marginTop: 12 }}>
        <div className="kpi-title">Transcript</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {(Array.isArray(segments) ? segments : []).length === 0 && <div style={{ color: '#6b7280' }}>No transcript yet.</div>}
          {(Array.isArray(segments) ? segments : []).map((s) => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
              <div style={{ color: '#6b7280' }}>{typeof s.start_ms === 'number' ? `${(s.start_ms/1000).toFixed(1)}s` : ''}</div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{s.speaker || 'Unknown'}</div>
                <div>{s.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <div className="kpi-title">Raw</div>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{data.raw_response}</pre>
      </div>
    </div>
  )
}


