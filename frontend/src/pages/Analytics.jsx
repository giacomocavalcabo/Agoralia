import { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import KPI from '../components/ui/KPI.jsx'
import { apiFetch } from '../lib/api.js'

export default function Analytics(){
  const { t } = useI18n()
  const [data, setData] = useState(null)
  useEffect(()=>{ (async()=>{ try{ setData(await apiFetch('/analytics/overview')) } catch{} })() }, [])
  return (
    <div style={{ display:'grid', gap:12 }}>
      <div className="panel" style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'space-between' }}>
        <div className="kpi-title">{t('pages.analytics.title')||'Analytics'}</div>
        <div style={{ display:'flex', gap:6 }}>
          <button style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('pages.analytics.actions.export_csv')||'Export CSV'}</button>
          <button style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('pages.analytics.actions.export_json')||'Export JSON'}</button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12 }}>
        <KPI label={t('pages.analytics.kpi.calls')||'Calls'} value={data?.kpi?.calls ?? 0} />
        <KPI label={t('pages.analytics.kpi.connected_rate')||'Connected'} value={(data?.kpi?.connected_rate ?? 0)*100 + '%'} />
        <KPI label={t('pages.analytics.kpi.qualified_rate')||'Qualified'} value={(data?.kpi?.qualified_rate ?? 0)*100 + '%'} />
      </div>
      <div className="panel">
        <div className="kpi-title">{t('pages.analytics.charts.calls_over_time')||'Calls over time'}</div>
      </div>
    </div>
  )
}


