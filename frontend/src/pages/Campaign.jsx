import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch } from '../lib/api.js'
import KPI from '../components/ui/KPI.jsx'

export default function Campaign(){
  const { id } = useParams()
  const { t } = useI18n()
  const [tab, setTab] = useState('overview')
  const [info, setInfo] = useState(null)
  const [kpi, setKpi] = useState(null)
  const [events, setEvents] = useState([])

  useEffect(()=>{ (async()=>{
    try{ setInfo(await apiFetch(`/campaigns/${id}`)) } catch{}
    try{ setKpi(await apiFetch(`/campaigns/${id}/kpi`)) } catch{}
  })() }, [id])

  useEffect(()=>{ if (tab==='calendar') (async()=>{
    try{ const now=new Date(); const next=new Date(now); next.setDate(now.getDate()+7); const res=await apiFetch(`/campaigns/${id}/events?start=${now.toISOString()}&end=${next.toISOString()}`); setEvents(res.events||[]) } catch{}
  })() }, [tab, id])

  if (!id) return <div className="panel">Missing id</div>

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <h2 style={{ margin:0 }}>{info?.name || 'Campaign'}</h2>
        <div className="kpi-title" style={{ marginLeft:'auto' }}>
          <Link to="/campaigns" className="kpi-title">{t('app.Campaigns')||'Campaigns'}</Link>
        </div>
      </div>

      <div style={{ display:'flex', gap:6 }}>
        {['overview','calendar','leads','settings'].map(x=> (
          <button key={x} aria-pressed={tab===x} onClick={()=> setTab(x)} style={{ padding:'6px 10px', border:'1px solid var(--border)', background: tab===x?'var(--surface)':'transparent', borderRadius:8 }}>{x}</button>
        ))}
      </div>

      {tab==='overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12 }}>
          <KPI label="Leads" value={kpi?.leads ?? 0} />
          <KPI label="Calls" value={kpi?.calls ?? 0} />
          <KPI label="Qualified" value={kpi?.qualified ?? 0} />
        </div>
      )}

      {tab==='calendar' && (
        <div className="panel">
          <div className="kpi-title" style={{ marginBottom:8 }}>Calendar</div>
          <ul>
            {events.map(e=> (<li key={e.id} className="kpi-title">[{e.kind}] {e.title||''} {e.at}</li>))}
          </ul>
        </div>
      )}

      {tab==='leads' && (
        <div className="panel">
          <div className="kpi-title">Leads (TBD)</div>
        </div>
      )}

      {tab==='settings' && (
        <div className="panel">
          <div className="kpi-title">Settings (TBD)</div>
        </div>
      )}
    </div>
  )
}


