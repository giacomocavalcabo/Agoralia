import { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch } from '../lib/api.js'
import Drawer from '../components/Drawer.jsx'

export default function History(){
  const { t } = useI18n()
  const [data, setData] = useState({ total: 0, items: [] })
  const [open, setOpen] = useState(false)
  const [brief, setBrief] = useState(null)
  const [filters, setFilters] = useState({ q:'', range:'30d', group_by:'none', sort:'-ts', page:0 })
  useEffect(()=>{ (async()=>{ try{
    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    params.set('limit','25')
    params.set('offset', String(filters.page*25))
    params.set('sort', filters.sort)
    params.set('group_by', filters.group_by==='none'?'':filters.group_by)
    setData(await apiFetch(`/history?${params.toString()}`))
  } catch{} })() }, [filters])
  return (
    <div style={{ display:'grid', gap:12 }}>
      <div className="panel" style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div className="kpi-title">{t('pages.history.title')||'History'}</div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <input placeholder={t('pages.history.filters.search')||'Search'} value={filters.q} onChange={e=> setFilters({ ...filters, q:e.target.value })} style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          <select value={filters.range} onChange={e=> setFilters({ ...filters, range:e.target.value })} style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8 }}>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="90d">90d</option>
          </select>
          <select value={filters.group_by} onChange={e=> setFilters({ ...filters, group_by:e.target.value })} style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8 }}>
            <option value="none">Group: None</option>
            <option value="company">Company</option>
            <option value="phone">Phone</option>
            <option value="campaign">Campaign</option>
          </select>
          <select value={filters.sort} onChange={e=> setFilters({ ...filters, sort:e.target.value, page:0 })} style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8 }}>
            <option value="-ts">Sort: Newest</option>
            <option value="ts">Sort: Oldest</option>
          </select>
        </div>
      </div>
      <div className="panel" style={{ overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
          <thead>
            <tr>
              <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.history.columns.time')||'Time'}</th>
              <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.history.columns.direction')||'Direction'}</th>
              <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.history.columns.to')||'To'}</th>
              <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.history.columns.from')||'From'}</th>
              <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.history.columns.company')||'Company'}</th>
              <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.history.columns.outcome')||'Outcome'}</th>
              <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.history.columns.duration')||'Duration'}</th>
              <th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.history.columns.cost')||'Cost'}</th>
              <th style={{ width:1 }}></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it)=> (
              <tr key={it.id}>
                <td style={{ padding:10 }}>{it.ts}</td>
                <td style={{ padding:10 }}>{it.direction}</td>
                <td style={{ padding:10 }}>{it.to}</td>
                <td style={{ padding:10 }}>{it.from}</td>
                <td style={{ padding:10 }}>{it.company}</td>
                <td style={{ padding:10 }}>{it.outcome}</td>
                <td style={{ padding:10 }}>{it.duration_sec}s</td>
                <td style={{ padding:10 }}>€{it.cost_eur}</td>
                <td style={{ padding:10 }}>
                  <button className="kpi-title" onClick={async ()=>{ try{ const b = await apiFetch(`/history/${it.id}/brief`); setBrief(b); setOpen(true) } catch{} }} style={{ border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8, padding:'6px 10px' }}>{t('pages.history.drawer.open_full')||'Open full call'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:10, borderTop:'1px solid var(--border)' }}>
          <div className="kpi-title">{(filters.page*25 + 1)}–{Math.min((filters.page+1)*25, data.total)} / {data.total}</div>
          <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
            <button disabled={filters.page===0} onClick={()=> setFilters({ ...filters, page: Math.max(0, filters.page-1) })} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.prev')}</button>
            <button disabled={(filters.page+1)*25>=data.total} onClick={()=> setFilters({ ...filters, page: filters.page+1 })} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.next')}</button>
          </div>
        </div>
      </div>

      <Drawer open={open} onClose={()=> setOpen(false)} title={brief?.header?.phone || ''}>
        {brief && (
          <div style={{ display:'grid', gap:8 }}>
            <div className="kpi-title">{brief.header.company} • {brief.header.lang} • {brief.header.agent}</div>
            <ul>
              {brief.last_turns.map((t,i)=> (<li key={i} className="kpi-title">{t.role}: {t.text}</li>))}
            </ul>
            <div className="kpi-title">€{brief.cost.total_eur} • {brief.cost.minutes} min</div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="kpi-title" onClick={()=> navigator.clipboard?.writeText(brief.header.phone || '')} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>Copy phone</button>
              <button className="kpi-title" style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>Update disposition</button>
              <a className="kpi-title" href="#" style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8, textDecoration:'none' }}>{t('pages.history.drawer.open_full')||'Open full call'}</a>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}


