import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch, API_BASE_URL } from '../lib/api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import Drawer from '../components/Drawer.jsx'

function fmt(d){
  const pad=(n)=> String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

export default function Calendar(){
  const { t } = useI18n()
  const [view, setView] = useState('week')
  const [cursor, setCursor] = useState(new Date())
  const [events, setEvents] = useState([])
  const { toast } = useToast()
  const [quickOpen, setQuickOpen] = useState(false)
  const [quick, setQuick] = useState({ lead_id:'', agent_id:'', kb_id:'', from:'', at:'' })
  const [dragStart, setDragStart] = useState(null)
  const [selected, setSelected] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [focusedSlot, setFocusedSlot] = useState(null)
  const [hoverSlot, setHoverSlot] = useState(null)

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

  async function load(){
    try{
      const res = await apiFetch(`/calendar?scope=tenant&start=${range.start.toISOString()}&end=${range.end.toISOString()}`)
      setEvents(res.events || [])
    } catch(e){}
  }

  useEffect(()=>{ load() }, [range.start, range.end])

  function prev(){ setCursor(d=> view==='week'? new Date(d.getFullYear(), d.getMonth(), d.getDate()-7) : new Date(d.getFullYear(), d.getMonth()-1, 1)) }
  function next(){ setCursor(d=> view==='week'? new Date(d.getFullYear(), d.getMonth(), d.getDate()+7) : new Date(d.getFullYear(), d.getMonth()+1, 1)) }
  function today(){ setCursor(new Date()) }

  const fromStr = fmt(range.start), toStr = fmt(range.end)

  function openQuick(date){
    setQuick({ lead_id:'', agent_id:'', kb_id:'', from:'', at: date.toISOString() })
    setQuickOpen(true)
  }

  async function submitQuick(){
    try{
      await apiFetch('/schedule', { method:'POST', body: quick })
      setQuickOpen(false)
      toast(t('pages.calendar.quick.submit_done') || 'Scheduled')
      load()
    } catch(err){ toast(String(err?.message || err)) }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          <button onClick={prev} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">{t('common.prev')}</button>
          <button onClick={today} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">{t('common.today')||'Today'}</button>
          <button onClick={next} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">{t('common.next')}</button>
        </div>
        <div className="ml-auto flex gap-1.5">
          <button aria-pressed={view==='week'} onClick={()=> setView('week')} className={`rounded-lg border border-line px-2.5 py-1.5 ${view==='week'?'bg-bg-app':''}`}>{t('common.week')||'Week'}</button>
          <button aria-pressed={view==='month'} onClick={()=> setView('month')} className={`rounded-lg border border-line px-2.5 py-1.5 ${view==='month'?'bg-bg-app':''}`}>{t('common.month')||'Month'}</button>
        </div>
      </div>
      <div className="kpi-title">{t('pages.calendar.range', { from: fromStr, to: toStr })}</div>
      <div className="flex items-center gap-2.5">
        <span className="kpi-title inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background:'rgba(16,185,129,.25)' }}></span>{t('pages.calendar.legend.scheduled')||'Scheduled'}</span>
        <span className="kpi-title inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background:'repeating-linear-gradient(45deg, rgba(0,0,0,.08) 0, rgba(0,0,0,.08) 6px, transparent 6px, transparent 12px)' }}></span>{t('pages.calendar.legend.blocked')||'Blocked'}</span>
        <span className="kpi-title inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background:'rgba(245,158,11,.18)' }}></span>{t('pages.calendar.legend.warn_budget')||'Warn • Budget'}</span>
        <span className="kpi-title inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background:'rgba(239,68,68,.16)' }}></span>{t('pages.calendar.legend.warn_concurrency')||'Warn • Concurrency'}</span>
      </div>
      <div className="panel" style={{ minHeight:300 }}>
        <div className="kpi-title" style={{ marginBottom:8 }}>{t('pages.calendar.title')}</div>
        {view==='week' ? (
          <div
            role="grid"
            aria-label="week"
            tabIndex={0}
            onKeyDown={(e)=>{
              if (!focusedSlot){ const base = new Date(range.start); base.setHours(8,0,0,0); setFocusedSlot(base) }
              const cur = focusedSlot ? new Date(focusedSlot) : (()=>{ const b=new Date(range.start); b.setHours(8,0,0,0); return b })()
              if (e.key === 'ArrowRight'){ const d=new Date(cur); d.setDate(d.getDate()+1); setFocusedSlot(d); e.preventDefault() }
              if (e.key === 'ArrowLeft'){ const d=new Date(cur); d.setDate(d.getDate()-1); setFocusedSlot(d); e.preventDefault() }
              if (e.key === 'ArrowDown'){ const d=new Date(cur); d.setHours(d.getHours()+1,0,0,0); setFocusedSlot(d); e.preventDefault() }
              if (e.key === 'ArrowUp'){ const d=new Date(cur); d.setHours(d.getHours()-1,0,0,0); setFocusedSlot(d); e.preventDefault() }
              if (e.key === 'Enter' && focusedSlot){ openQuick(new Date(focusedSlot)); e.preventDefault() }
              if (e.key === 'Escape'){ setFocusedSlot(null); e.preventDefault() }
              if (e.key.toLowerCase() === 't'){ today(); const d=new Date(); d.setHours(8,0,0,0); setFocusedSlot(d); e.preventDefault() }
            }}
            style={{ display:'grid', gridTemplateColumns:'64px repeat(7, 1fr)', borderTop:'1px solid var(--line)', borderLeft:'1px solid var(--line)' }}
          >
            <div></div>
            {Array.from({ length:7 }).map((_,d)=>{
              const day = new Date(range.start); day.setDate(range.start.getDate()+d)
              return <div key={d} className="kpi-title" style={{ padding:8, borderRight:'1px solid var(--line)', borderBottom:'1px solid var(--line)' }}>{day.toLocaleDateString()}</div>
            })}
            {Array.from({ length:11 }).map((_,h)=>{
              const hour = h+8
              return (
                <div key={`row-${hour}`} style={{ display:'contents' }}>
                  <div className="kpi-title" style={{ padding:6, borderRight:'1px solid var(--line)', borderBottom:'1px solid var(--line)' }}>{String(hour).padStart(2,'0')}:00</div>
                  {Array.from({ length:7 }).map((_,d)=>{
                    const slot = new Date(range.start); slot.setDate(range.start.getDate()+d); slot.setHours(hour,0,0,0)
                    const scheduledHere = events.find(e=> e.kind==='scheduled' && e.at && new Date(e.at).getTime()===slot.getTime())
                    const warnHere = events.find(e=> e.kind==='warn' && e.at && new Date(e.at).getTime()===slot.getTime())
                    const warnBudgetHere = warnHere && warnHere.reason === 'BUDGET'
                    const warnConcHere = warnHere && warnHere.reason === 'CONCURRENCY'
                    const blockedHere = events.some(e=> e.kind==='blocked' && e.at && e.end && new Date(e.at) <= slot && new Date(e.end) > slot)
                    return (
                      <button
                        key={`c-${d}-${hour}`}
                        role="gridcell"
                        onClick={()=> scheduledHere ? (setSelected(scheduledHere), setDrawerOpen(true)) : openQuick(slot)}
                        onMouseDown={()=> { setDragStart(slot); setHoverSlot(slot) }}
                        onMouseEnter={()=> { if (dragStart) setHoverSlot(slot) }}
                        onMouseUp={async ()=>{
                          if (dragStart && dragStart.getTime()!==slot.getTime()){
                            if (selected){
                              try{
                                const resp = await fetch(`${API_BASE_URL}/schedule/${selected.id}`, {
                                  method:'PATCH',
                                  headers:{ 'Content-Type':'application/json' },
                                  body: JSON.stringify({ at: slot.toISOString() })
                                })
                                if (resp.ok){ toast('Moved'); load() }
                                else if (resp.status===409){
                                  let detail
                                  try { detail = await resp.json() } catch { detail = {} }
                                  const code = String(detail?.code || 'quiet_hours').toLowerCase()
                                  if (code==='concurrency') {
                                    const msg = `${t('pages.calendar.errors.concurrency')} (${detail.used||0}/${detail.limit||0})`
                                    toast(msg)
                                  } else if (code==='quiet_hours') {
                                    toast(t('pages.calendar.errors.quiet_hours', { iso: detail?.iso || '' }))
                                  } else if (code==='budget') {
                                    toast(t('pages.calendar.errors.budget'))
                                  } else if (code==='rpo') {
                                    toast(t('pages.calendar.errors.rpo', { iso: detail?.iso || '' }))
                                  } else {
                                    toast(`409: ${code}`)
                                  }
                                } else {
                                  const text = await resp.text(); toast(`API ${resp.status}: ${text}`)
                                }
                              } catch(err){ toast(String(err?.message || err)) }
                            } else {
                              // Drag-to-create selection
                              const start = dragStart < slot ? dragStart : slot
                              const end = dragStart < slot ? slot : dragStart
                              setQuick({ lead_id:'', agent_id:'', kb_id:'', from:'', at: start.toISOString(), end: end.toISOString() })
                              setQuickOpen(true)
                            }
                          }
                          setDragStart(null); setHoverSlot(null)
                        }}
                        style={{ padding:0, height:36, border:'none', borderRight:'1px solid var(--line)', borderBottom:'1px solid var(--line)', background: (function(){
                          if (blockedHere) return 'repeating-linear-gradient(45deg, rgba(0,0,0,.04) 0, rgba(0,0,0,.04) 6px, transparent 6px, transparent 12px)'
                          if (warnConcHere) return 'rgba(239,68,68,.10)'
                          if (warnBudgetHere) return 'rgba(245,158,11,.12)'
                          if (dragStart && hoverSlot){
                            const a = dragStart.getTime(), b = hoverSlot.getTime(), t = slot.getTime()
                            const min = Math.min(a,b), max = Math.max(a,b)
                            if (t>=min && t<=max) return 'rgba(59,130,246,.12)'
                          }
                          if (scheduledHere) return 'rgba(16,185,129,.15)'
                          return 'transparent'
                        })(), outline: (focusedSlot && new Date(focusedSlot).getTime()===slot.getTime()) ? '2px solid var(--primary)' : 'none', cursor:'pointer' }}
                        aria-label={`${slot.toISOString()}`}
                        onFocus={()=> setFocusedSlot(slot)}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Header row with day names */}
            {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-ink-600 p-2 border-b border-line">
                {day}
              </div>
            ))}
            
            {/* Calendar grid */}
            {(() => {
              const monthStart = new Date(range.start)
              const monthEnd = new Date(range.end)
              const startDate = new Date(monthStart)
              startDate.setDate(1)
              const endDate = new Date(monthEnd)
              endDate.setDate(monthEnd.getDate())
              
              // Get first day of month and adjust to start of week
              const firstDay = new Date(startDate)
              const dayOfWeek = firstDay.getDay()
              firstDay.setDate(firstDay.getDate() - dayOfWeek)
              
              const days = []
              const currentDate = new Date(firstDay)
              
              while (currentDate <= endDate || days.length < 42) { // 6 weeks max
                days.push(new Date(currentDate))
                currentDate.setDate(currentDate.getDate() + 1)
              }
              
              return days.map((date, index) => {
                const isCurrentMonth = date.getMonth() === monthStart.getMonth()
                const isToday = date.toDateString() === new Date().toDateString()
                const dayEvents = events.filter(e => {
                  const eventDate = new Date(e.at)
                  return eventDate.toDateString() === date.toDateString()
                })
                
                return (
                  <div
                    key={index}
                    className={`h-32 p-1 border border-line ${
                      isCurrentMonth ? 'bg-bg-card' : 'bg-bg-app/50'
                    } ${isToday ? 'ring-2 ring-brand-500' : ''}`}
                  >
                    <div className={`text-xs text-right mb-1 ${
                      isCurrentMonth ? 'text-ink-900' : 'text-ink-400'
                    } ${isToday ? 'font-bold' : ''}`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1 max-h-20 overflow-hidden">
                      {dayEvents.slice(0, 3).map((event, eventIndex) => {
                        const eventDate = new Date(event.at)
                        const timeStr = eventDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                        const getEventColor = (kind) => {
                          if (kind === 'scheduled') return 'bg-success/20 text-success border-success/30'
                          if (kind === 'blocked') return 'bg-ink-600/20 text-ink-600 border-ink-600/30'
                          if (kind === 'warn') return 'bg-warn/20 text-warn border-warn/30'
                          return 'bg-info/20 text-info border-info/30'
                        }
                        
                        return (
                          <div
                            key={eventIndex}
                            className={`text-xs p-1 rounded border ${getEventColor(event.kind)} truncate cursor-pointer`}
                            onClick={() => {
                              setSelected(event)
                              setDrawerOpen(true)
                            }}
                            title={`${event.title || ''} ${timeStr}`}
                          >
                            {event.title || event.kind} {timeStr}
                          </div>
                        )
                      })}
                      {dayEvents.length > 3 && (
                        <button 
                          className="text-xs text-brand-600 hover:text-brand-700 hover:underline text-center w-full cursor-pointer"
                          onClick={() => {
                            // Show all events for this day in a modal/drawer
                            setSelected({ 
                              title: `Eventi del ${date.toLocaleDateString('it-IT')}`, 
                              events: dayEvents,
                              date: date 
                            })
                            setDrawerOpen(true)
                          }}
                        >
                          +{dayEvents.length - 3} altri
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>

      <Modal title={t('pages.calendar.quick.title')} open={quickOpen} onClose={()=> setQuickOpen(false)} footer={
        <>
          <button onClick={()=> setQuickOpen(false)} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">{t('common.cancel')}</button>
          <button onClick={submitQuick} className="btn">{t('pages.calendar.quick.submit')}</button>
        </>
      }>
        <div className="grid gap-2.5">
          <label>
            <div className="kpi-title">{t('pages.calendar.quick.lead')}</div>
            <input value={quick.lead_id} onChange={e=> setQuick({ ...quick, lead_id:e.target.value })} className="input" />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label>
              <div className="kpi-title">{t('pages.calendar.quick.agent')}</div>
              <input value={quick.agent_id} onChange={e=> setQuick({ ...quick, agent_id:e.target.value })} className="input" />
            </label>
            <label>
              <div className="kpi-title">{t('pages.calendar.quick.kb')}</div>
              <input value={quick.kb_id} onChange={e=> setQuick({ ...quick, kb_id:e.target.value })} className="input" />
            </label>
          </div>
          <label>
            <div className="kpi-title">{t('pages.calendar.quick.from')}</div>
            <input placeholder={'+12025550123'} value={quick.from} onChange={e=> setQuick({ ...quick, from:e.target.value })} className="input" />
          </label>
          <label>
            <div className="kpi-title">{t('pages.calendar.quick.datetime')}</div>
            <input type="datetime-local" value={quick.at ? new Date(quick.at).toISOString().slice(0,16) : ''} onChange={e=> setQuick({ ...quick, at: new Date(e.target.value).toISOString() })} className="input" />
          </label>
        </div>
      </Modal>

      <Drawer open={drawerOpen} onClose={()=> setDrawerOpen(false)} title={selected ? (selected.title || 'Scheduled') : ''}>
        {selected && (
          <div className="grid gap-2">
            {selected.events ? (
              // Multiple events for a day
              <div>
                <div className="text-sm text-ink-600 mb-3">
                  {selected.date?.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <div className="space-y-2">
                  {selected.events.map((event, index) => (
                    <div key={index} className="p-3 border border-line rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-block w-3 h-3 rounded-full ${
                          event.kind === 'scheduled' ? 'bg-success' :
                          event.kind === 'blocked' ? 'bg-ink-600' :
                          event.kind === 'warn' ? 'bg-warn' : 'bg-info'
                        }`}></span>
                        <span className="font-semibold text-ink-900">{event.title || event.kind}</span>
                        <span className="text-sm text-ink-600">
                          {new Date(event.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {event.reason && <div className="text-sm text-ink-600">{event.reason}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Single event
              <>
                <div className="kpi-title">{selected.at}</div>
                <div className="flex gap-2">
                  <span className="kpi-title rounded-full border border-line px-2 py-0.5">Fuso: UTC</span>
                  {selected.lang && <span className="kpi-title rounded-full border border-line px-2 py-0.5">Lingua: {selected.lang}</span>}
                </div>
                {(selected.kind==='blocked' || selected.kind==='warn') && (
                  <div className="kpi-title">{selected.title || ''} {selected.reason ? `(${selected.reason})` : ''} {typeof selected.budget_used_pct==='number' ? `— ${selected.budget_used_pct}%` : ''} {typeof selected.used==='number' && typeof selected.limit==='number' ? `— ${selected.used}/${selected.limit}` : ''}</div>
                )}
                <div className="flex gap-2">
                  <button onClick={()=> setDrawerOpen(false)} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">Chiudi</button>
                  <button onClick={async ()=>{
                    try{
                      await apiFetch(`/schedule/${selected.id}`, { method:'PATCH', body:{ cancel: true } })
                      toast('Annullato'); setDrawerOpen(false); load()
                    } catch(err){ toast(String(err?.message || err)) }
                  }} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">Annulla Evento</button>
                  <button onClick={()=>{ setQuick({ ...quick, at: selected.at }); setQuickOpen(true); }} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">Riprogramma</button>
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}


