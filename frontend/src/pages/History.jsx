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
    <div className="grid gap-3">
      <div className="panel flex items-center gap-2">
        <div className="kpi-title">{t('pages.history.title')||'History'}</div>
        <div className="ml-auto flex gap-2">
          <input placeholder={t('pages.history.filters.search')||'Search'} value={filters.q} onChange={e=> setFilters({ ...filters, q:e.target.value })} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5" />
          <select value={filters.range} onChange={e=> setFilters({ ...filters, range:e.target.value })} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="90d">90d</option>
          </select>
          <select value={filters.group_by} onChange={e=> setFilters({ ...filters, group_by:e.target.value })} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">
            <option value="none">Group: None</option>
            <option value="company">Company</option>
            <option value="phone">Phone</option>
            <option value="campaign">Campaign</option>
          </select>
          <select value={filters.sort} onChange={e=> setFilters({ ...filters, sort:e.target.value, page:0 })} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">
            <option value="-ts">Sort: Newest</option>
            <option value="ts">Sort: Oldest</option>
          </select>
        </div>
      </div>
      <div className="panel overflow-auto">
        <table className="w-full border-separate" style={{ borderSpacing:0 }}>
          <thead>
            <tr>
              <th className="kpi-title text-left px-3 py-2">{t('pages.history.columns.time')||'Time'}</th>
              <th className="kpi-title text-left px-3 py-2">{t('pages.history.columns.direction')||'Direction'}</th>
              <th className="kpi-title text-left px-3 py-2">{t('pages.history.columns.to')||'To'}</th>
              <th className="kpi-title text-left px-3 py-2">{t('pages.history.columns.from')||'From'}</th>
              <th className="kpi-title text-left px-3 py-2">{t('pages.history.columns.company')||'Company'}</th>
              <th className="kpi-title text-left px-3 py-2">{t('pages.history.columns.outcome')||'Outcome'}</th>
              <th className="kpi-title text-left px-3 py-2">{t('pages.history.columns.duration')||'Duration'}</th>
              <th className="kpi-title text-left px-3 py-2">{t('pages.history.columns.cost')||'Cost'}</th>
              <th style={{ width:1 }}></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it)=> (
              <tr key={it.id}>
                <td className="px-3 py-2">{it.ts}</td>
                <td className="px-3 py-2">{it.direction}</td>
                <td className="px-3 py-2">{it.to}</td>
                <td className="px-3 py-2">{it.from}</td>
                <td className="px-3 py-2">{it.company}</td>
                <td className="px-3 py-2">{it.outcome}</td>
                <td className="px-3 py-2">{it.duration_sec}s</td>
                <td className="px-3 py-2">€{it.cost_eur}</td>
                <td className="px-3 py-2">
                  <button className="kpi-title rounded-lg border border-line bg-bg-app px-2.5 py-1.5" onClick={async ()=>{ try{ const b = await apiFetch(`/history/${it.id}/brief`); setBrief(b); setOpen(true) } catch{} }}>{t('pages.history.drawer.open_full')||'Open full call'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 px-3 py-2 border-t border-line">
          <div className="kpi-title">{(filters.page*25 + 1)}–{Math.min((filters.page+1)*25, data.total)} / {data.total}</div>
          <div className="ml-auto flex gap-1.5">
            <button disabled={filters.page===0} onClick={()=> setFilters({ ...filters, page: Math.max(0, filters.page-1) })} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5 disabled:opacity-50">{t('common.prev')}</button>
            <button disabled={(filters.page+1)*25>=data.total} onClick={()=> setFilters({ ...filters, page: filters.page+1 })} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5 disabled:opacity-50">{t('common.next')}</button>
          </div>
        </div>
      </div>

      <Drawer open={open} onClose={()=> setOpen(false)} title={brief?.header?.phone || ''}>
        {brief && (
          <div className="grid gap-2">
            <div className="kpi-title">{brief.header.company} • {brief.header.lang} • {brief.header.agent}</div>
            <ul>
              {brief.last_turns.map((t,i)=> (<li key={i} className="kpi-title">{t.role}: {t.text}</li>))}
            </ul>
            <div className="kpi-title">€{brief.cost.total_eur} • {brief.cost.minutes} min</div>
            <div className="flex gap-2">
              <button className="kpi-title rounded-lg border border-line bg-bg-app px-2.5 py-1.5" onClick={()=> navigator.clipboard?.writeText(brief.header.phone || '')}>Copy phone</button>
              <button className="kpi-title rounded-lg border border-line bg-bg-app px-2.5 py-1.5">Update disposition</button>
              <a className="kpi-title rounded-lg border border-line bg-bg-app px-2.5 py-1.5 no-underline" href="#">{t('pages.history.drawer.open_full')||'Open full call'}</a>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}


