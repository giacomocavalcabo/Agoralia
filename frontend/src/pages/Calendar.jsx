import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useI18n } from '../lib/i18n.jsx'

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export default function Calendar() {
  const { t } = useI18n()
  const [mode, setMode] = useState('month') // week | month
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [events, setEvents] = useState([])
  const [ent, setEnt] = useState({ calendar_full: false, calendar_week_day: true })

  const range = useMemo(() => {
    if (mode === 'month') {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
      const startDay = (first.getDay() + 6) % 7 // Monday=0
      const endDay = (last.getDay() + 6) % 7
      const start = addDays(startOfDay(first), -startDay)
      const end = addDays(startOfDay(last), 6 - endDay + 1) // inclusive last week -> exclusive end
      return { start, end }
    }
    // week: Monday..Sunday (ISO)
    const day = (anchor.getDay() + 6) % 7
    const monday = addDays(startOfDay(anchor), -day)
    const sunday = addDays(monday, 7)
    return { start: monday, end: sunday }
  }, [mode, anchor])

  useEffect(() => {
    const qs = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() })
    apiFetch(`/calendar?${qs}`).then((r) => r.json()).then(setEvents).catch(() => setEvents([]))
  }, [range.start, range.end])

  useEffect(() => {
    apiFetch('/billing/entitlements').then((r) => r.json()).then((j)=> setEnt(j || {})).catch(()=>{})
  }, [])

  const days = useMemo(() => {
    const out = []
    let d = new Date(range.start)
    while (d < range.end) { out.push(new Date(d)); d = addDays(d, 1) }
    return out
  }, [range])

  const eventsByDay = useMemo(() => {
    const map = new Map()
    for (const d of days) map.set(d.toDateString(), [])
    for (const ev of events) {
      const day = new Date(ev.start).toDateString()
      if (!map.has(day)) map.set(day, [])
      map.get(day).push(ev)
    }
    return map
  }, [days, events])

  function eventStyle(ev) {
    const now = Date.now()
    const t = new Date(ev.start).getTime()
    const diffDays = (t - now) / (1000 * 60 * 60 * 24)
    const closeness = Math.min(1, Math.abs(diffDays) / 30)
    const alpha = Math.max(0.2, 0.65 * (1 - closeness))
    if (diffDays < 0) {
      // past -> green shades
      return { backgroundColor: `hsla(142, 60%, 45%, ${alpha})`, color: '#064e3b' }
    }
    // future -> red shades
    return { backgroundColor: `hsla(0, 75%, 60%, ${alpha})`, color: '#7f1d1d' }
  }

  return (
    <div>
      <h1>
        {t('pages.calendar.title')}
        {ent.calendar_full
          ? <span className="badge" style={{ marginLeft: 8, background:'#ecfeff' }}>{t('pages.calendar.full')}</span>
          : <span className="badge" style={{ marginLeft: 8, background:'#fff7ed' }}>{t('pages.calendar.limited')}</span>}
      </h1>
      <div className="panel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" onClick={() => setAnchor(mode==='month' ? new Date(anchor.getFullYear(), anchor.getMonth()-1, 1) : addDays(anchor, -7))}>{t('common.prev')}</button>
        <div className="kpi-title preserve-ltr" style={{ minWidth: 200, textAlign: 'center' }}>{range.start.toLocaleDateString()} → {addDays(range.end, -1).toLocaleDateString()}</div>
        <button className="btn" onClick={() => setAnchor(mode==='month' ? new Date(anchor.getFullYear(), anchor.getMonth()+1, 1) : addDays(anchor, 7))}>{t('common.next')}</button>
        <div style={{ flex: 1 }} />
        <button className={`btn ${mode==='week'?'primary':''}`} onClick={() => setMode('week')} disabled={!ent.calendar_full} title={!ent.calendar_full ? t('pages.calendar.pro_tooltip') : ''}>{t('pages.calendar.week')}</button>
        <button className={`btn ${mode==='month'?'primary':''}`} onClick={() => setMode('month')}>{t('pages.calendar.month')}</button>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {days.map((d) => (
            <div key={d.toISOString()} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, minHeight: 160 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{d.toLocaleDateString()}</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {(eventsByDay.get(d.toDateString()) || []).map((ev) => {
                  const style = eventStyle(ev)
                  return (
                    <div key={ev.id} className="badge" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...style }}>
                      <span>{ev.title}</span>
                      <span style={{ color: 'inherit', opacity: 0.8 }}>{new Date(ev.start).toLocaleTimeString()}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


