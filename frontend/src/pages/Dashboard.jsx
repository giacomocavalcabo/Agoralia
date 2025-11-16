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
import { Line } from 'react-chartjs-2'
import { apiRequest, wsUrl } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import { useMetricsDaily } from '../lib/hooks/useMetrics'
import { createReconnectingWebSocket } from '../lib/ws'
import { useToast } from '../components/ToastProvider.jsx'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import WebCallButton from '../components/WebCallButton.jsx'
import { safeArray } from '../lib/util'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)

export default function Dashboard() {
  const { t } = useI18n()
  const toast = useToast()
  const { loading: loadingDaily, data: dailyData } = useMetricsDaily(7)
  const [health, setHealth] = useState('ok')
  const [liveCalls, setLiveCalls] = useState([])
  const [now, setNow] = useState(Date.now())
  const [activeCalls, setActiveCalls] = useState(0)
  const [successRate, setSuccessRate] = useState('—')
  const [costToday, setCostToday] = useState({ amount: 0, currency: 'EUR' })
  const [searchQuery, setSearchQuery] = useState('')

  // Health check
  useEffect(() => {
    apiRequest(endpoints.health).then(({ ok, data }) => {
      if (ok) setHealth(data?.status || 'ok')
    }).catch(() => setHealth('down'))
  }, [])

  // Success rate from daily data
  useEffect(() => {
    if (dailyData?.rate?.length) {
      const latest = dailyData.rate[dailyData.rate.length - 1] || 0
      setSuccessRate(`${Math.round(latest)}%`)
    }
  }, [dailyData])

  // WebSocket for real-time updates
  useEffect(() => {
    const { close } = createReconnectingWebSocket(wsUrl('/ws'), {
      onMessage: (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg?.type === 'call.created') {
            setActiveCalls((n) => n + 1)
            loadLiveCalls()
          }
          if (msg?.type === 'call.finished' || msg?.type === 'webcall.finished') {
            setActiveCalls((n) => Math.max(0, n - 1))
            loadLiveCalls()
          }
          if (msg?.type === 'cost.event') {
            loadCostToday()
          }
        } catch {}
      }
    })
    return () => close()
  }, [])

  // Initial load
  useEffect(() => {
    loadLiveCalls()
    loadCostToday()
  }, [])

  // Timer for duration display
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  async function loadLiveCalls() {
    const { ok, data } = await apiRequest(endpoints.calls.live)
    if (ok && Array.isArray(data)) {
      setLiveCalls(data)
      setActiveCalls(data.length)
    }
  }

  async function loadCostToday() {
    const { ok, data } = await apiRequest(endpoints.metrics.costToday)
    if (ok && data) setCostToday(data)
  }

  function durationSince(ts) {
    if (!ts) return '—'
    const start = new Date(ts).getTime()
    const secs = Math.max(0, Math.floor((now - start) / 1000))
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  async function endCall(id) {
    const { ok } = await apiRequest(`/calls/${id}/end`, { method: 'POST' })
    if (ok) {
      toast.success('Chiamata terminata')
      loadLiveCalls()
    } else {
      toast.error('Errore nella terminazione')
    }
  }

  const filteredCalls = safeArray(liveCalls).filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return String(c.to || '').toLowerCase().includes(q) || 
           String(c.from || '').toLowerCase().includes(q) ||
           String(c.status || '').toLowerCase().includes(q)
  })

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header with quick actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0 }}>{t('pages.dashboard.title')}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <WebCallButton />
          <Button variant="secondary" size="sm" onClick={loadLiveCalls}>
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Key metrics - simplified to 3 main KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
            {t('pages.dashboard.active_calls')}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>
            {activeCalls}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
            {t('pages.dashboard.success_rate')}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>
            {successRate}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
            {t('pages.dashboard.cost_today')}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>
            {costToday.amount} {costToday.currency}
          </div>
        </Card>
      </div>

      {/* Main chart - calls per day */}
      <Card>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          {t('pages.dashboard.calls_per_day')}
        </div>
        <div style={{ height: 300, position: 'relative' }}>
          {loadingDaily ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
              Caricamento...
            </div>
          ) : dailyData?.labels?.length > 0 ? (
            <Line
              data={{
                labels: safeArray(dailyData.labels).map((d) => d.slice(5)),
                datasets: [
                  {
                    label: t('pages.dashboard.create'),
                    data: safeArray(dailyData.created),
                    borderColor: 'var(--indigo-600)',
                    backgroundColor: 'rgba(79, 70, 229, 0.08)',
                    tension: 0.4,
                    fill: true,
                  },
                  {
                    label: t('pages.dashboard.finish'),
                    data: safeArray(dailyData.finished),
                    borderColor: 'var(--green)',
                    backgroundColor: 'rgba(34, 197, 94, 0.08)',
                    tension: 0.4,
                    fill: true,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                  legend: { display: true, position: 'bottom' },
                  tooltip: { mode: 'index', intersect: false }
                },
                scales: { 
                  y: { beginAtZero: true, grid: { color: 'var(--border)' } },
                  x: { grid: { display: false } }
                },
              }}
            />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
              Nessun dato disponibile
            </div>
          )}
        </div>
      </Card>

      {/* Live calls table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {t('pages.dashboard.live_calls')}
          </div>
          <Input
            placeholder={t('pages.dashboard.search_live') || 'Cerca…'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: 240 }}
          />
        </div>
        {filteredCalls.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
            {searchQuery ? 'Nessun risultato' : t('pages.dashboard.no_active_calls')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th>{t('common.created')}</th>
                  <th>{t('common.to')}</th>
                  <th>{t('common.from')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontSize: 14 }}>{new Date(c.created_at).toLocaleTimeString()}</div>
                      <div style={{ 
                        display: 'inline-block', 
                        marginTop: 4, 
                        background: 'var(--indigo-600)', 
                        color: 'white', 
                        padding: '2px 8px', 
                        borderRadius: 6, 
                        fontSize: 11,
                        fontWeight: 500
                      }}>
                        {durationSince(c.created_at)}
                      </div>
                    </td>
                    <td className="preserve-ltr" style={{ fontFamily: 'monospace' }}>{c.to || '—'}</td>
                    <td className="preserve-ltr" style={{ fontFamily: 'monospace' }}>{c.from || '—'}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: 4, 
                        fontSize: 12,
                        background: c.status === 'ringing' ? 'var(--amber)' : 'var(--border)',
                        color: c.status === 'ringing' ? 'var(--text)' : 'var(--muted)'
                      }}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a className="btn btn-sm" href={`/calls/${c.id}`}>
                          {t('common.open')}
                        </a>
                        <Button variant="secondary" size="sm" onClick={() => endCall(c.id)}>
                          {t('common.end')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
