import { useEffect, useMemo, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch } from '../lib/api.js'
import KPI from '../components/ui/KPI.jsx'
import { useToast } from '../components/ToastProvider.jsx'

export default function Campaign(){
  const location = useLocation()
  const id = useMemo(()=> new URLSearchParams(location.search).get('id') || '', [location.search])
  const { t } = useI18n()
  const [tab, setTab] = useState('overview')
  const [info, setInfo] = useState(null)
  const [kpi, setKpi] = useState(null)
  const [events, setEvents] = useState([])
  const { toast } = useToast()
  const [settings, setSettings] = useState({ pacing_npm:'', budget_cap_cents:'', quiet_hours:true })

  useEffect(()=>{ (async()=>{
    try{ setInfo(await apiFetch(`/campaigns/${id}`)) } catch{}
    try{ setKpi(await apiFetch(`/campaigns/${id}/kpi`)) } catch{}
  })() }, [id])

  useEffect(()=>{
    if (info){
      setSettings({
        pacing_npm: String(info.pacing_npm ?? ''),
        budget_cap_cents: String(info.budget_cap_cents ?? ''),
        quiet_hours: Boolean(info.window?.quiet_hours ?? true)
      })
    }
  }, [info])

  useEffect(()=>{ if (tab==='calendar') (async()=>{
    try{ const now=new Date(); const next=new Date(now); next.setDate(now.getDate()+7); const res=await apiFetch(`/campaigns/${id}/events?start=${now.toISOString()}&end=${next.toISOString()}`); setEvents(res.events||[]) } catch{}
  })() }, [tab, id])

  if (!id) return <div className="panel">Missing id (?id=...)</div>

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
        <div className="panel" style={{ display:'grid', gap:10 }}>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.pacing')}</div>
            <input type="number" min="1" value={settings.pacing_npm} onChange={e=> setSettings({ ...settings, pacing_npm:e.target.value })} style={{ width:220, padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.budget')}</div>
            <input type="number" min="0" value={settings.budget_cap_cents} onChange={e=> setSettings({ ...settings, budget_cap_cents:e.target.value })} style={{ width:220, padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <input type="checkbox" checked={settings.quiet_hours} onChange={e=> setSettings({ ...settings, quiet_hours:e.target.checked })} />
            <span className="kpi-title">{t('pages.campaigns.fields.quiet_hours')}</span>
          </label>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={async ()=>{
              try{
                const payload = {
                  pacing_npm: Number(settings.pacing_npm)||0,
                  budget_cap_cents: settings.budget_cap_cents? Number(settings.budget_cap_cents): null,
                  window: { ...(info?.window||{}), quiet_hours: settings.quiet_hours }
                }
                if (payload.budget_cap_cents == null) delete payload.budget_cap_cents
                await apiFetch(`/campaigns/${id}`, { method:'PATCH', body: payload })
                toast(t('pages.campaigns.toasts.updated') || 'Updated')
              } catch(err){ toast(String(err?.message || err)) }
            }} style={{ padding:'8px 12px', border:'1px solid var(--brand)', background:'var(--brand)', color:'white', borderRadius:8, fontWeight:700 }}>{t('common.save')}</button>
          </div>
        </div>
      )}
    </div>
  )
}


