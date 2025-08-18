import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import KPI from '../components/ui/KPI.jsx'
import { apiFetch } from '../lib/api.js'
import 'chart.js/auto'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

export default function Analytics(){
  const { t, locale } = useI18n()
  const [data, setData] = useState(null)
  const [filters, setFilters] = useState({ range:'30d', scope:'all', lang:[], agent:[], country:[], outcome:[], direction:[] })
  useEffect(()=>{ (async()=>{ try{
    const params = new URLSearchParams()
    params.set('range', filters.range)
    params.set('scope', filters.scope)
    if (filters.lang.length) params.set('lang', filters.lang.join(','))
    if (filters.agent.length) params.set('agent', filters.agent.join(','))
    if (filters.country.length) params.set('country', filters.country.join(','))
    if (filters.outcome.length) params.set('outcome', filters.outcome.join(','))
    if (filters.direction.length) params.set('direction', filters.direction.join(','))
    setData(await apiFetch(`/analytics/overview?${params.toString()}`))
  } catch{} })() }, [filters])

  const callsOverTime = useMemo(()=>{
    const pts = data?.charts?.calls_over_time || []
    return {
      labels: pts.map(p=> p.ts),
      datasets: [
        { label:'Attempted', data: pts.map(p=> p.attempted), borderColor:'#4B5563', backgroundColor:'rgba(75,85,99,.2)' },
        { label:'Connected', data: pts.map(p=> p.connected), borderColor:'#10B981', backgroundColor:'rgba(16,185,129,.2)' },
        { label:'Finished', data: pts.map(p=> p.finished), borderColor:'#2563EB', backgroundColor:'rgba(37,99,235,.2)' },
      ]
    }
  }, [data])

  const outcomesOverTime = useMemo(()=>{
    const pts = data?.charts?.outcomes_over_time || []
    const keys = ['qualified','not_interested','callback','voicemail','no_answer','failed']
    const colors = ['#10B981','#F59E0B','#6B7280','#3B82F6','#9CA3AF','#EF4444']
    return {
      labels: pts.map(p=> p.ts),
      datasets: keys.map((k,i)=> ({ label:k, data: pts.map(p=> p[k]||0), backgroundColor:colors[i] }))
    }
  }, [data])

  const langDistribution = useMemo(()=>{
    const pts = data?.charts?.lang_distribution || []
    return {
      labels: pts.map(p=> p.lang),
      datasets: [{ label:'Calls', data: pts.map(p=> p.calls), backgroundColor:['#2563EB','#10B981','#F59E0B','#EF4444','#6B7280','#A78BFA'] }]
    }
  }, [data])

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div className="panel" style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'space-between' }}>
        <div className="kpi-title">{t('pages.analytics.title')||'Analytics'}</div>
        <div style={{ display:'flex', gap:8 }}>
          <label className="kpi-title" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            Range
            <select value={filters.range} onChange={e=> setFilters({ ...filters, range:e.target.value })} style={{ border:'1px solid var(--border)', borderRadius:8, padding:'4px 8px' }}>
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
          </label>
          <label className="kpi-title" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            Scope
            <select value={filters.scope} onChange={e=> setFilters({ ...filters, scope:e.target.value })} style={{ border:'1px solid var(--border)', borderRadius:8, padding:'4px 8px' }}>
              <option value="all">All</option>
              <option value="campaign">Campaign</option>
              <option value="agent">Agent</option>
              <option value="language">Language</option>
            </select>
          </label>
          <a href={`/api/analytics/export.csv?locale=${encodeURIComponent(locale)}`} className="kpi-title" style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8, textDecoration:'none' }}>{t('pages.analytics.actions.export_csv')||'Export CSV'}</a>
          <a href={`/api/analytics/export.json?locale=${encodeURIComponent(locale)}`} className="kpi-title" style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8, textDecoration:'none' }}>{t('pages.analytics.actions.export_json')||'Export JSON'}</a>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12 }}>
        <KPI label={t('pages.analytics.kpi.calls')||'Calls'} value={data?.kpi?.calls ?? 0} />
        <KPI label={t('pages.analytics.kpi.connected_rate')||'Connected'} value={Math.round((data?.kpi?.connected_rate ?? 0)*100) + '%'} />
        <KPI label={t('pages.analytics.kpi.qualified_rate')||'Qualified'} value={Math.round((data?.kpi?.qualified_rate ?? 0)*100) + '%'} />
      </div>

      <div className="panel" aria-describedby="desc-calls">
        <div className="kpi-title" id="desc-calls" style={{ marginBottom:8 }}>{t('pages.analytics.charts.calls_over_time')||'Calls over time'}</div>
        <Line data={callsOverTime} options={{ responsive:true, maintainAspectRatio:false }} height={220} />
      </div>

      <div className="panel" style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
        <div className="kpi-title">{t('pages.analytics.filters.language')||'Language'}</div>
        {['en-US','it-IT','fr-FR','hi-IN'].map(code=> (
          <label key={code} className="kpi-title" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={filters.lang.includes(code)} onChange={(e)=> setFilters(f=> ({ ...f, lang: e.target.checked ? [...f.lang, code] : f.lang.filter(x=> x!==code) }))} />{code}
          </label>
        ))}
        <div style={{ width:1, height:20, background:'var(--border)' }} />
        <div className="kpi-title">{t('pages.analytics.filters.direction')||'Direction'}</div>
        {['inbound','outbound'].map(code=> (
          <label key={code} className="kpi-title" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={filters.direction.includes(code)} onChange={(e)=> setFilters(f=> ({ ...f, direction: e.target.checked ? [...f.direction, code] : f.direction.filter(x=> x!==code) }))} />{code}
          </label>
        ))}
      </div>

      <div className="panel" aria-describedby="desc-outcomes">
        <div className="kpi-title" id="desc-outcomes" style={{ marginBottom:8 }}>{t('pages.analytics.charts.outcomes_over_time')||'Outcomes (recent days)'}</div>
        <Bar data={outcomesOverTime} options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } }, scales:{ x:{ stacked:true }, y:{ stacked:true } } }} height={260} />
      </div>

      <div className="panel" aria-describedby="desc-lang">
        <div className="kpi-title" id="desc-lang" style={{ marginBottom:8 }}>{t('pages.analytics.charts.lang_distribution')||'By language'}</div>
        <Doughnut data={langDistribution} options={{ plugins:{ legend:{ position:'bottom' } } }} height={240} />
      </div>

      <div className="panel" aria-label="By tables">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12 }}>
          <div>
            <div className="kpi-title" style={{ marginBottom:6 }}>{t('pages.analytics.tables.by_campaign')||'By campaign'}</div>
            <ul style={{ margin:0, paddingLeft:16 }}>
              {(data?.tables?.by_campaign||[]).map(r=> (<li key={r.id} className="kpi-title">{r.name}: {r.calls}</li>))}
            </ul>
          </div>
          <div>
            <div className="kpi-title" style={{ marginBottom:6 }}>{t('pages.analytics.tables.by_agent')||'By agent'}</div>
            <ul style={{ margin:0, paddingLeft:16 }}>
              {(data?.tables?.by_agent||[]).map(r=> (<li key={r.id} className="kpi-title">{r.name}: {r.calls}</li>))}
            </ul>
          </div>
          <div>
            <div className="kpi-title" style={{ marginBottom:6 }}>{t('pages.analytics.tables.by_country')||'By country'}</div>
            <ul style={{ margin:0, paddingLeft:16 }}>
              {(data?.tables?.by_country||[]).map(r=> (<li key={r.iso} className="kpi-title">{r.iso}: {r.calls}</li>))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}


