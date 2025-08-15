import { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { apiFetch, wsUrl } from '../lib/api'
import { useToast } from '../components/ToastProvider.jsx'
import WebCallButton from '../components/WebCallButton.jsx'
import SkeletonKPI from '../components/SkeletonKPI.jsx'
import SkeletonTable from '../components/SkeletonTable.jsx'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)

export default function Dashboard() {
  const { t } = useI18n()
  const toast = useToast()
  const [health, setHealth] = useState('unknown')
  const [metrics, setMetrics] = useState({
    active: 0,
    avgDuration: '—',
    successRate: '—',
    spend: '—',
  })
  const [daily, setDaily] = useState({ labels: [], rate: [], created: [], finished: [] })
  const [outcomes, setOutcomes] = useState({ labels: [], counts: [] })
  const [windowDays, setWindowDays] = useState(7)
  const [liveCalls, setLiveCalls] = useState([])
  const [now, setNow] = useState(Date.now())
  const [concurrency, setConcurrency] = useState({ limit: 0, in_use: 0, available: 0 })
  const [errors24h, setErrors24h] = useState(0)
  const [costToday, setCostToday] = useState({ amount: 0, currency: 'EUR' })
  const [webhookEvents, setWebhookEvents] = useState([])
  const [latencyP95, setLatencyP95] = useState(0)
  const [dlq, setDlq] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ping backend health (placeholder for real metrics)
    apiFetch('/health')
      .then((r) => r.json())
      .then((d) => setHealth(d.status || 'ok'))
      .catch(() => setHealth('down'))
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [d, o] = await Promise.all([
        apiFetch(`/metrics/daily?days=${windowDays}`).then((r) => r.json()),
        apiFetch(`/metrics/outcomes?days=${windowDays}`).then((r) => r.json()),
      ])
      setDaily(d)
      setOutcomes(o)
      setMetrics((m) => ({ ...m, successRate: `${Math.round((d.rate || []).at(-1) || 0)}%` }))
      setLoading(false)
    }
    load()
  }, [windowDays])

  useEffect(() => {
    const ws = new WebSocket(wsUrl('/ws'))
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        // Simple demo: increment active calls on created events
        if (msg?.type === 'call.created') {
          setMetrics((m) => ({ ...m, active: (m.active ?? 0) + 1 }))
          // refresh live list
          apiFetch('/calls/live').then((r) => r.json()).then(setLiveCalls).catch(() => {})
        }
        if (msg?.type === 'call.finished' || msg?.type === 'webcall.finished') {
          setMetrics((m) => ({ ...m, active: Math.max(0, (m.active ?? 1) - 1) }))
          apiFetch('/calls/live').then((r) => r.json()).then(setLiveCalls).catch(() => {})
        }
        if (msg?.type === 'cost.event') {
          apiFetch('/metrics/cost/today').then((r) => r.json()).then(setCostToday).catch(() => {})
        }
      } catch {}
    }
    return () => ws.close()
  }, [])

  useEffect(() => {
    // initial live load
    apiFetch('/calls/live').then((r) => r.json()).then(setLiveCalls).catch(() => {})
    // load additional KPIs
    apiFetch('/metrics/account/concurrency').then((r) => r.json()).then(setConcurrency).catch(() => {})
    apiFetch('/metrics/errors/24h').then((r) => r.json()).then((x) => setErrors24h(x.errors_24h || 0)).catch(() => {})
    apiFetch('/metrics/cost/today').then((r) => r.json()).then(setCostToday).catch(() => {})
    apiFetch('/events').then((r) => r.json()).then(setWebhookEvents).catch(() => {})
    apiFetch('/webhooks/dlq').then((r) => r.json()).then(setDlq).catch(() => {})
    apiFetch('/metrics/latency/p95').then((r) => r.json()).then((x) => setLatencyP95(x.p95_ms || 0)).catch(() => {})
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  function durationSince(ts) {
    if (!ts) return '—'
    const start = new Date(ts).getTime()
    const secs = Math.max(0, Math.floor((now - start) / 1000))
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  async function endCall(id) {
    try {
      const res = await apiFetch(`/calls/${id}/end`, { method: 'POST' })
      if (!res.ok) throw new Error(String(res.status))
      apiFetch('/calls/live').then((r) => r.json()).then(setLiveCalls).catch(() => {})
      toast.success('Call ended')
    } catch {
      toast.error('Failed to end call')
    }
  }

  const [dashQ, setDashQ] = useState('')

  return (
    <div>
      <h1>{t('pages.dashboard.title')}</h1>
      <p className="panel" style={{ display: 'inline-block' }}>{t('pages.dashboard.backend')}: {health}</p>
      <div className="kpi-grid" style={{ marginTop: 12 }}>
        {loading ? <div className="kpi-card" aria-busy="true"><div className="kpi-title skeleton-line" /><div className="skeleton-block" style={{ height: 28, marginTop: 8, borderRadius: 8 }} /></div> : (
          <div className="kpi-card">
            <div className="kpi-title">{t('pages.dashboard.active_calls')}</div>
            <div className="kpi-value preserve-ltr">{metrics.active}</div>
          </div>
        )}
        {loading ? <div className="kpi-card" aria-busy="true"><div className="kpi-title skeleton-line" /><div className="skeleton-block" style={{ height: 28, marginTop: 8, borderRadius: 8 }} /></div> : (
          <div className="kpi-card">
            <div className="kpi-title">{t('pages.dashboard.free_slots')}</div>
            <div className="kpi-value preserve-ltr">{concurrency.available}/{concurrency.limit}</div>
          </div>
        )}
        {loading ? <div className="kpi-card" aria-busy="true"><div className="kpi-title skeleton-line" /><div className="skeleton-block" style={{ height: 28, marginTop: 8, borderRadius: 8 }} /></div> : (
          <div className="kpi-card">
            <div className="kpi-title">{t('pages.dashboard.avg_duration')}</div>
            <div className="kpi-value preserve-ltr">{metrics.avgDuration}</div>
          </div>
        )}
        {loading ? <div className="kpi-card" aria-busy="true"><div className="kpi-title skeleton-line" /><div className="skeleton-block" style={{ height: 28, marginTop: 8, borderRadius: 8 }} /></div> : (
          <div className="kpi-card">
            <div className="kpi-title">{t('pages.dashboard.turn_taking_p95')}</div>
            <div className="kpi-value preserve-ltr">{Math.round(latencyP95)} ms</div>
          </div>
        )}
        {!loading && (
          <>
            <div className="kpi-card">
              <div className="kpi-title">{t('pages.dashboard.success_rate')}</div>
              <div className="kpi-value preserve-ltr">{metrics.successRate}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">{t('pages.dashboard.errors_24h')}</div>
              <div className="kpi-value preserve-ltr">{errors24h}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">{t('pages.dashboard.cost_today')}</div>
              <div className="kpi-value preserve-ltr">{costToday.amount} {costToday.currency}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <span style={{ color: '#6b7280', fontSize: 13 }}>{t('pages.dashboard.period')}</span>
        <button className="btn" onClick={() => setWindowDays(7)}>{t('pages.dashboard.days',{n:7})}</button>
        <button className="btn" onClick={() => setWindowDays(30)}>{t('pages.dashboard.days',{n:30})}</button>
        <div style={{ flex:1 }} />
        <WebCallButton />
        <input className="input" placeholder={t('pages.dashboard.search_live') || 'Search live…'} value={dashQ} onChange={(e)=> setDashQ(e.target.value)} style={{ maxWidth: 220 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
        <div className="panel">
          <div style={{ fontWeight: 600, marginBottom: 8 }} className="preserve-ltr">{t('pages.dashboard.calls_per_day')}</div>
          {loading ? <div style={{ height: 160 }} className="skeleton-block" /> : <Line
            data={{
              labels: (daily?.labels || []).map((d) => d.slice(5)),
              datasets: [
                {
                  label: t('pages.dashboard.create'),
                  data: daily?.created || [],
                  borderColor: 'var(--blue)',
                  backgroundColor: 'rgba(37, 99, 235, 0.12)',
                  tension: 0.3,
                },
                {
                  label: t('pages.dashboard.finish'),
                  data: daily?.finished || [],
                  borderColor: 'var(--green)',
                  backgroundColor: 'rgba(22, 163, 74, 0.12)',
                  tension: 0.3,
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: { legend: { display: true, position: 'bottom' } },
              scales: { y: { beginAtZero: true } },
            }}
            height={120}
          />}
        </div>
        <div className="panel">
          <div style={{ fontWeight: 600, marginBottom: 8 }} className="preserve-ltr">{t('pages.dashboard.outcomes_recent')}</div>
          {loading ? <div style={{ height: 160 }} className="skeleton-block" /> : <Bar
            data={{
              labels: outcomes?.labels || [],
              datasets: [
                 { label: t('pages.dashboard.count'), data: outcomes?.counts || [], backgroundColor: 'var(--amber)' },
              ],
            }}
            options={{ responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }}
            height={120}
          />}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600 }}>{t('pages.dashboard.live_calls')}</div>
          <button className="btn" onClick={() => apiFetch('/calls/live').then((r) => r.json()).then(setLiveCalls)}>
            {t('common.refresh')}
          </button>
        </div>
        {loading ? <div className="panel" style={{ marginTop: 8 }}><div className="skeleton-row" style={{ height: 36 }} /><div className="skeleton-row" style={{ height: 44, marginTop: 6 }} /><div className="skeleton-row" style={{ height: 44, marginTop: 6 }} /></div> : <table className="table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>{t('common.created')}</th>
              <th>{t('common.to')}</th>
              <th>{t('common.from')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.detail')}</th>
            </tr>
          </thead>
          <tbody>
            {liveCalls.length === 0 && (
              <tr>
                <td colSpan="5" style={{ color: '#6b7280' }}>{t('pages.dashboard.no_active_calls')}</td>
              </tr>
            )}
            {liveCalls.filter(c => {
              const q = dashQ.toLowerCase().trim(); if (!q) return true;
              return String(c.to || '').toLowerCase().includes(q) || String(c.from || '').toLowerCase().includes(q) || String(c.status || '').toLowerCase().includes(q)
            }).map((c) => (
              <tr key={c.id}>
                <td>
                  <div>{new Date(c.created_at).toLocaleTimeString()}</div>
                  <div className="badge" style={{ display: 'inline-block', marginTop: 4, background: 'var(--blue)', color: 'white', padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>
                    {durationSince(c.created_at)}
                  </div>
                </td>
                <td className="preserve-ltr">{c.to || '—'}</td>
                <td className="preserve-ltr">{c.from || '—'}</td>
                <td>{c.status}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <a className="btn" href={`/calls/${c.id}`}>{t('common.open')}</a>
                  <button className="btn" onClick={() => endCall(c.id)}>{t('common.end')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600 }}>{t('pages.dashboard.webhooks_monitor')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => apiFetch('/events').then((r) => r.json()).then(setWebhookEvents)}>{t('common.refresh')}</button>
            <button className="btn" onClick={() => apiFetch('/backfill', { method: 'POST' }).then(() => apiFetch('/calls').then((r) => r.json()).then(() => {}))}>{t('pages.dashboard.backfill_recent')}</button>
          </div>
        </div>
        <table className="table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>{t('common.type')}</th>
              <th>{t('common.time')}</th>
              <th>{t('common.ref')}</th>
            </tr>
          </thead>
          <tbody>
            {webhookEvents.slice().reverse().slice(0, 10).map((ev, idx) => (
              <tr key={idx}>
                <td>{ev.type}</td>
                <td>{new Date(ev.ts).toLocaleTimeString()}</td>
                <td>{ev?.data?.call_id || ev?.data?.id || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontWeight: 600, marginTop: 12 }}>DLQ</div>
        <table className="table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>{t('common.id')}</th>
              <th>{t('common.event')}</th>
              <th>{t('common.error')}</th>
              <th>{t('common.time')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {dlq.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.event_id}</td>
                <td>{r.error}</td>
                <td>{new Date(r.created_at).toLocaleTimeString()}</td>
                <td>
                  <button className="btn" onClick={async () => { await apiFetch(`/webhooks/dlq/${r.id}/replay`, { method: 'POST' }); apiFetch('/webhooks/dlq').then((res) => res.json()).then(setDlq) }}>{t('common.replay')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


