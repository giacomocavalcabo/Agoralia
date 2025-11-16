import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n.jsx'
import { apiRequest, wsUrl } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import { createReconnectingWebSocket } from '../lib/ws'
import { useToast } from '../components/ToastProvider.jsx'
import PageHeader from '../components/layout/PageHeader'
import SectionHeader from '../components/layout/SectionHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import StatCard from '../components/stats/StatCard'
import StatGrid from '../components/stats/StatGrid'
import SetupChecklist from '../components/setup/SetupChecklist'
import { safeArray } from '../lib/util'

export default function Dashboard() {
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const [health, setHealth] = useState('ok')
  const [liveCalls, setLiveCalls] = useState([])
  const [now, setNow] = useState(Date.now())
  const [activeCalls, setActiveCalls] = useState(0)
  const [costToday, setCostToday] = useState({ amount: 0, currency: 'EUR' })
  const [searchQuery, setSearchQuery] = useState('')
  const [setupStatus, setSetupStatus] = useState({
    numbers: false,
    knowledge: false,
    agent: false,
    leads: false,
    loading: true
  })

  // Health check
  useEffect(() => {
    apiRequest(endpoints.health).then(({ ok, data }) => {
      if (ok) setHealth(data?.status || 'ok')
    }).catch(() => setHealth('down'))
  }, [])

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

  // Check setup status
  useEffect(() => {
    async function checkSetup() {
      try {
        const [numbersRes, kbsRes, agentsRes, leadsRes] = await Promise.all([
          apiRequest(endpoints.numbers),
          apiRequest(endpoints.kbs),
          apiRequest(endpoints.agents),
          apiRequest(`${endpoints.leads}?limit=1`)
        ])
        
        const hasNumbers = numbersRes.ok && safeArray(numbersRes.data).length > 0 && 
          safeArray(numbersRes.data).some(n => n.verified)
        const hasKnowledge = kbsRes.ok && safeArray(kbsRes.data).length > 0 &&
          safeArray(kbsRes.data).some(kb => kb.status === 'ready' || kb.status === 'synced')
        const hasAgent = agentsRes.ok && safeArray(agentsRes.data).length > 0
        const hasLeads = leadsRes.ok && leadsRes.data?.total > 0
        
        setSetupStatus({
          numbers: hasNumbers,
          knowledge: hasKnowledge,
          agent: hasAgent,
          leads: hasLeads,
          loading: false
        })
      } catch {
        setSetupStatus(prev => ({ ...prev, loading: false }))
      }
    }
    checkSetup()
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
      toast.success(t('common.end') + ' - ' + t('common.success'))
      loadLiveCalls()
    } else {
      toast.error(t('common.end') + ' - ' + t('common.error'))
    }
  }

  const filteredCalls = safeArray(liveCalls).filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return String(c.to || '').toLowerCase().includes(q) || 
           String(c.from || '').toLowerCase().includes(q) ||
           String(c.status || '').toLowerCase().includes(q)
  })

  const setupItems = [
    {
      id: 'number',
      type: 'number',
      label: t('pages.dashboard.setup.bricks.number.label'),
      description: t('pages.dashboard.setup.bricks.number.description'),
      completed: setupStatus.numbers,
      onAction: () => navigate('/numbers'),
      actionLabel: setupStatus.numbers ? undefined : t('pages.dashboard.setup.complete_now')
    },
    {
      id: 'knowledge',
      type: 'knowledge',
      label: t('pages.dashboard.setup.bricks.knowledge.label'),
      description: t('pages.dashboard.setup.bricks.knowledge.description'),
      completed: setupStatus.knowledge,
      onAction: () => navigate('/settings?tab=kbs'),
      actionLabel: setupStatus.knowledge ? undefined : t('pages.dashboard.setup.complete_now')
    },
    {
      id: 'agent',
      type: 'agent',
      label: t('pages.dashboard.setup.bricks.agent.label'),
      description: t('pages.dashboard.setup.bricks.agent.description'),
      completed: setupStatus.agent,
      onAction: () => navigate('/agents'),
      actionLabel: setupStatus.agent ? undefined : t('pages.dashboard.setup.complete_now')
    },
    {
      id: 'leads',
      type: 'leads',
      label: t('pages.dashboard.setup.bricks.leads.label'),
      description: t('pages.dashboard.setup.bricks.leads.description'),
      completed: setupStatus.leads,
      onAction: () => navigate('/leads'),
      actionLabel: setupStatus.leads ? undefined : t('pages.dashboard.setup.import_now')
    }
  ]

  const totalCompleted = setupItems.filter(item => item.completed).length
  const isSetupComplete = totalCompleted === 4

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header with quick actions */}
      <PageHeader
        title={t('pages.dashboard.title')}
        primaryAction={isSetupComplete ? {
          label: t('pages.dashboard.create_campaign'),
          onClick: () => navigate('/campaigns/new'),
          size: 'lg'
        } : undefined}
        secondaryAction={{
          label: t('common.refresh'),
          onClick: loadLiveCalls,
          size: 'sm'
        }}
      />

      {/* Setup Checklist or Success Banner */}
      {!setupStatus.loading && (
        <SetupChecklist
          items={setupItems}
          totalCompleted={totalCompleted}
          totalItems={4}
          onStartSetup={!isSetupComplete ? () => navigate('/setup') : undefined}
        />
      )}

      {/* Key metrics - simplified to 2 main KPIs */}
      <StatGrid>
        <StatCard
          label={t('pages.dashboard.active_calls')}
          value={activeCalls}
        />
        <StatCard
          label={t('pages.dashboard.cost_today')}
          value={`${costToday.amount} ${costToday.currency}`}
        />
      </StatGrid>

      {/* Live calls table */}
      <Card>
        <SectionHeader
          title={t('pages.dashboard.live_calls')}
          actions={
            <Input
              placeholder={t('pages.dashboard.search_live') || 'Cerca…'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: 240 }}
            />
          }
        />
        {filteredCalls.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
            {searchQuery ? t('common.no_results') : t('pages.dashboard.no_active_calls')}
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
