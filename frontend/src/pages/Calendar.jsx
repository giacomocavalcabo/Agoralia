import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch } from '../lib/api.js'

function fmt(d){
  const pad=(n)=> String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

export default function Calendar(){
  const { t } = useI18n()
  const [view, setView] = useState('week')
  const [cursor, setCursor] = useState(new Date())
  const [events, setEvents] = useState([])

  const range = useMemo(()=>{
    const start = new Date(cursor)
    if (view==='week'){
      const day = start.getDay(); const diff = (day===0? -6: 1) - day; start.setDate(start.getDate()+diff)
      const end = new Date(start); end.setDate(start.getDate()+6)
      return { start, end }
    }
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1)
    const monthEnd = new Date(start.getFullYear(), start.getMonth()+1, 0)
    return { start: monthStart, end: monthEnd }
  }, [cursor, view])

  useEffect(()=>{ (async()=>{
    try{
      const res = await apiFetch(`/calendar?scope=tenant&start=${range.start.toISOString()}&end=${range.end.toISOString()}`)
      setEvents(res.events || [])
    } catch(e){}
  })() }, [range.start, range.end])

  function prev(){ setCursor(d=> view==='week'? new Date(d.getFullYear(), d.getMonth(), d.getDate()-7) : new Date(d.getFullYear(), d.getMonth()-1, 1)) }
  function next(){ setCursor(d=> view==='week'? new Date(d.getFullYear(), d.getMonth(), d.getDate()+7) : new Date(d.getFullYear(), d.getMonth()+1, 1)) }
  function today(){ setCursor(new Date()) }

  const fromStr = fmt(range.start), toStr = fmt(range.end)

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={prev} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.prev')}</button>
          <button onClick={today} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.today')||'Today'}</button>
          <button onClick={next} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.next')}</button>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button aria-pressed={view==='week'} onClick={()=> setView('week')} style={{ padding:'6px 10px', border:'1px solid var(--border)', background: view==='week'? 'var(--surface)':'transparent', borderRadius:8 }}>{t('common.week')||'Week'}</button>
          <button aria-pressed={view==='month'} onClick={()=> setView('month')} style={{ padding:'6px 10px', border:'1px solid var(--border)', background: view==='month'? 'var(--surface)':'transparent', borderRadius:8 }}>{t('common.month')||'Month'}</button>
        </div>
      </div>
      <div className="kpi-title">{t('pages.calendar.range', { from: fromStr, to: toStr })}</div>
      <div className="panel" style={{ minHeight:300 }}>
        <div className="kpi-title" style={{ marginBottom:8 }}>{t('pages.calendar.title')}</div>
        <ul style={{ margin:0, paddingLeft:16 }}>
          {events.map(e=> (<li key={e.id} className="kpi-title">[{e.kind}] {e.title || ''} {e.at}</li>))}
        </ul>
      </div>
    </div>
  )
}


