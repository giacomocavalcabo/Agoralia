import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { safeArray } from '../lib/util'
import { useToast } from '../components/ToastProvider.jsx'
import { useI18n } from '../lib/i18n.jsx'

export default function Billing() {
  const toast = useToast()
  const { t } = useI18n()
  const [ov, setOv] = useState({ plan: 'free', status: 'trialing', minutes_month_to_date: 0 })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [addons, setAddons] = useState([])
  const [inboundQty, setInboundQty] = useState(0)

  async function load() {
    const res = await apiRequest('/billing/overview')
    if (res.ok) setOv(res.data || {}); else { setOv({ plan:'free', status:'trialing', minutes_month_to_date:0 }); toast.error(`Billing: ${res.error}`) }
    const a = await apiRequest('/addons').then(r=> r.ok ? (r.data || []) : [])
    setAddons(a)
    const inbound = a.find(x=>x.type==='inbound_slot')
    setInboundQty(inbound?.qty || 0)
  }
  useEffect(() => { load() }, [])

  async function checkout(plan) {
    setLoading(true)
    try {
      const r = await apiRequest(`/billing/checkout?plan=${encodeURIComponent(plan)}`, { method: 'POST' })
      if (r.ok && r.data?.url) window.location.href = r.data.url
      else toast.error(r.error || `Error ${r.status}`)
    } finally { setLoading(false) }
  }

  async function portal() {
    setLoading(true)
    try {
      const r = await apiRequest('/billing/portal')
      if (r.ok && r.data?.url) window.location.href = r.data.url
      else toast.error(r.error || `Error ${r.status}`)
    } finally { setLoading(false) }
  }

  return (
    <div>
      <h1>{t('pages.billing.title')}</h1>
      {ov.trial_days_left != null && (
        <div className="panel" style={{ marginBottom: 12, background:'#fff7ed' }}>
          <div className="kpi-title">{t('pages.billing.free_trial')}</div>
          <div>{t('pages.billing.days_left', { n: ov.trial_days_left })} • {t('pages.billing.expires', { date: new Date(ov.trial_expires_at).toLocaleDateString() })}</div>
        </div>
      )}
      <div className="panel" style={{ display:'grid', gap: 8 }}>
        <div className="kpi-grid">
          <div className="kpi-card"><div className="kpi-title">{t('pages.billing.plan')}</div><div className="kpi-value preserve-ltr">{ov.plan}</div></div>
          <div className="kpi-card"><div className="kpi-title">{t('pages.billing.status')}</div><div className="kpi-value preserve-ltr">{ov.status}</div></div>
          <div className="kpi-card"><div className="kpi-title">{t('pages.billing.minutes_mtd')}</div><div className="kpi-value preserve-ltr">{ov.minutes_month_to_date}</div></div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn" onClick={() => checkout('core')} disabled={loading}>{t('pages.billing.upgrade_core')}</button>
          <button className="btn" onClick={() => checkout('pro')} disabled={loading}>{t('pages.billing.upgrade_pro')}</button>
          <button className="btn" onClick={portal} disabled={loading}>{t('pages.billing.open_portal')}</button>
        </div>
        {msg && <div style={{ color:'#374151' }}>{msg}</div>}
      </div>

      <div className="panel" style={{ marginTop: 12, display:'grid', gap: 8 }}>
        <div className="kpi-title">{t('pages.billing.inbound_slots')}</div>
        <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
          <input className="input" type="number" min={0} value={inboundQty} onChange={(e)=> setInboundQty(parseInt(e.target.value||'0',10))} style={{ width:120 }} />
          <button className="btn" disabled={loading} onClick={async ()=>{ setLoading(true); try{ const r = await apiRequest('/addons/inbound_slot', { method:'POST', body:{ qty: inboundQty } }); if (!r.ok) toast.error(`Add-on: ${r.error}`); await load() } finally{ setLoading(false) } }}>{t('common.save')}</button>
        </div>
        <div style={{ color:'#6b7280' }}>{t('pages.billing.slots_note')}</div>
      </div>
    </div>
  )
}


