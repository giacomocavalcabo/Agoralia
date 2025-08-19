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
      <div className="panel flex items-center justify-between gap-2">
        <div className="kpi-title">Analytics</div>
        <div className="flex gap-2">
          <label className="kpi-title inline-flex items-center gap-1.5">
            Range
            <select value={filters.range} onChange={e=> setFilters({ ...filters, range:e.target.value })} className="rounded-lg border border-line bg-bg-app px-2 py-1.5">
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
          </label>
          <label className="kpi-title inline-flex items-center gap-1.5">
            Scope
            <select value={filters.scope} onChange={e=> setFilters({ ...filters, scope:e.target.value })} className="rounded-lg border border-line bg-bg-app px-2 py-1.5">
              <option value="all">All</option>
              <option value="campaign">Campaign</option>
              <option value="agent">Agent</option>
              <option value="language">Language</option>
            </select>
          </label>
          <a href={`/api/analytics/export.csv?locale=${encodeURIComponent(locale)}`} className="kpi-title rounded-lg border border-line bg-bg-app px-2.5 py-1.5 no-underline">Export CSV</a>
          <a href={`/api/analytics/export.json?locale=${encodeURIComponent(locale)}`} className="kpi-title rounded-lg border border-line bg-bg-app px-2.5 py-1.5 no-underline">Export JSON</a>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12 }}>
        <KPI label="Chiamate" value={data?.kpi?.calls ?? 0} />
        <KPI label="Connesse" value={Math.round((data?.kpi?.connected_rate ?? 0)*100) + '%'} />
        <KPI label="Qualificate" value={Math.round((data?.kpi?.qualified_rate ?? 0)*100) + '%'} />
      </div>

      <div className="panel" aria-describedby="desc-calls">
        <div className="kpi-title mb-2" id="desc-calls">Chiamate nel tempo</div>
        <Line data={callsOverTime} options={{ responsive:true, maintainAspectRatio:false }} height={60} />
      </div>

      <div className="panel flex flex-wrap items-center gap-3">
        <div className="kpi-title">Lingua</div>
        {['en-US','it-IT','fr-FR','hi-IN'].map(code=> (
          <label key={code} className="kpi-title inline-flex items-center gap-1.5">
            <input type="checkbox" checked={filters.lang.includes(code)} onChange={(e)=> setFilters(f=> ({ ...f, lang: e.target.checked ? [...f.lang, code] : f.lang.filter(x=> x!==code) }))} />{code}
          </label>
        ))}
        <div className="w-px h-5 bg-line" />
        <div className="kpi-title">Direzione</div>
        {['inbound','outbound'].map(code=> (
          <label key={code} className="kpi-title inline-flex items-center gap-1.5">
            <input type="checkbox" checked={filters.direction.includes(code)} onChange={(e)=> setFilters(f=> ({ ...f, direction: e.target.checked ? [...f.direction, code] : f.direction.filter(x=> x!==code) }))} />{code}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel" aria-describedby="desc-outcomes">
          <div className="kpi-title mb-2" id="desc-outcomes">Risultati nel tempo</div>
          <Bar data={outcomesOverTime} options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } }, scales:{ x:{ stacked:true }, y:{ stacked:true } } }} height={80} />
        </div>

        <div className="panel" aria-describedby="desc-lang">
          <div className="kpi-title mb-2" id="desc-lang">Per lingua</div>
          <Doughnut data={langDistribution} options={{ plugins:{ legend:{ position:'bottom' } } }} height={80} />
        </div>
      </div>

      <div className="panel" aria-label="By tables">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="kpi-title mb-1.5">By campaign</div>
            <ul className="m-0 pl-4">
              {(data?.tables?.by_campaign||[]).map(r=> (<li key={r.id} className="kpi-title">{r.name}: {r.calls}</li>))}
            </ul>
          </div>
          <div>
            <div className="kpi-title mb-1.5">By agent</div>
            <ul className="m-0 pl-4">
              {(data?.tables?.by_agent||[]).map(r=> (<li key={r.id} className="kpi-title">{r.name}: {r.calls}</li>))}
            </ul>
          </div>
          <div>
            <div className="kpi-title mb-1.5">By country</div>
            <ul className="m-0 pl-4">
              {(data?.tables?.by_country||[]).map(r=> (<li key={r.iso} className="kpi-title">{r.iso}: {r.calls}</li>))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}


