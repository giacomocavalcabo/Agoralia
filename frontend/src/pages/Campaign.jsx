import { useEffect, useMemo, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api.js'
import KPI from '../components/ui/KPI.jsx'
import { useToast } from '../components/ToastProvider.jsx'

export default function Campaign(){
  const location = useLocation()
  const id = useMemo(()=> new URLSearchParams(location.search).get('id') || '', [location.search])
  const { t } = useTranslation('pages')
  const [tab, setTab] = useState('overview')
  const [info, setInfo] = useState(null)
  const [kpi, setKpi] = useState(null)
  const [events, setEvents] = useState([])
  const { toast } = useToast()
  const [settings, setSettings] = useState({ quiet_hours:true })
  const [leads, setLeads] = useState({ total: 0, items: [] })

  useEffect(()=>{ (async()=>{
    try{ setInfo(await apiFetch(`/campaigns/${id}`)) } catch{}
    try{ setKpi(await apiFetch(`/campaigns/${id}/kpi`)) } catch{}
  })() }, [id])

  useEffect(()=>{
    if (info){
      setSettings({
        quiet_hours: Boolean(info.window?.quiet_hours ?? true)
      })
    }
  }, [info])

  useEffect(()=>{ if (tab==='calendar') (async()=>{
    try{ const now=new Date(); const next=new Date(now); next.setDate(now.getDate()+7); const res=await apiFetch(`/campaigns/${id}/events?start=${now.toISOString()}&end=${next.toISOString()}`); setEvents(res.events||[]) } catch{}
  })() }, [tab, id])

  useEffect(()=>{ if (tab==='leads') (async()=>{ try{ setLeads(await apiFetch(`/campaigns/${id}/leads`)) } catch{} })() }, [tab, id])

  if (!id) return <div className="panel">Missing id (?id=...)</div>

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <h2 style={{ margin:0 }}>{info?.name || 'Campaign'}</h2>
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button onClick={async ()=>{ try{ await apiFetch(`/campaigns/${id}/pause`, { method:'POST' }); toast('Paused') } catch(e){ toast(String(e?.message||e)) } }} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>Pause</button>
          <button onClick={async ()=>{ try{ await apiFetch(`/campaigns/${id}/resume`, { method:'POST' }); toast('Resumed') } catch(e){ toast(String(e?.message||e)) } }} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>Resume</button>
          <a href={`/api/analytics/export.csv`} target="_blank" rel="noreferrer" style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8, textDecoration:'none' }}>Export CSV</a>
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
          <KPI label="Chiamate" value={kpi?.calls ?? 0} />
          <KPI label="Qualificate %" value={(kpi?.qualified_rate ?? 0)+'%'} />
          <KPI label="Durata media" value={(kpi?.avg_duration_sec ?? 0)+'s'} />
          <KPI label="Costo/min" value={kpi?.cost_per_min ?? 0} />
          <KPI label="p95" value={(kpi?.p95 ?? 0)+' ms'} />
        </div>
      )}

      {tab==='calendar' && (
        <div className="panel">
          <div className="kpi-title" style={{ marginBottom:8 }}>Calendario</div>
          <ul>
            {events.map(e=> (<li key={e.id} className="kpi-title">[{e.kind}] {e.title||''} {e.at}</li>))}
          </ul>
        </div>
      )}

      {tab==='leads' && (
        <div className="panel" style={{ overflow:'auto' }}>
          <div className="kpi-title" style={{ marginBottom:8 }}>Leads filtrati per segmento campagna</div>
          <div className="text-sm text-gray-600 mb-4">
            Filtri applicati: {info?.segment ? Object.entries(info.segment).filter(([k,v]) => v && (Array.isArray(v) ? v.length > 0 : true)).map(([k,v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ') : 'Nessun filtro'}
          </div>
          <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
            <thead>
              <tr>
                <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>Nome</th>
                <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>Telefono</th>
                <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>Stato</th>
                <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {(leads.items||[]).map(it=> (
                <tr key={it.id}>
                  <td style={{ padding:10 }}>{it.name}</td>
                  <td style={{ padding:10 }}>{it.phone_e164}</td>
                  <td style={{ padding:10 }}>{it.status}</td>
                  <td style={{ padding:10 }}>{it.compliance_category || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='settings' && (
        <div className="panel" style={{ display:'grid', gap:10 }}>
          <label>
            <div className="kpi-title">Pacing (calls/min)</div>
            <input type="number" min="1" value={settings.pacing_npm} onChange={e=> setSettings({ ...settings, pacing_npm:e.target.value })} style={{ width:220, padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <label>
            <div className="kpi-title">Budget (centesimi)</div>
            <input type="number" min="0" value={settings.budget_cap_cents} onChange={e=> setSettings({ ...settings, budget_cap_cents:e.target.value })} style={{ width:220, padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <input type="checkbox" checked={settings.quiet_hours} onChange={e=> setSettings({ ...settings, quiet_hours:e.target.checked })} />
            <span className="kpi-title">Rispetta orari silenziosi</span>
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
                toast('Aggiornato')
              } catch(err){ toast(String(err?.message || err)) }
            }} style={{ padding:'8px 12px', border:'1px solid var(--brand)', background:'var(--brand)', color:'white', borderRadius:8, fontWeight:700 }}>Salva</button>
          </div>
        </div>
      )}
    </div>
  )
}


