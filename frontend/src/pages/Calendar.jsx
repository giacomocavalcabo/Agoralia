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
            style={{ display:'grid', gridTemplateColumns:'64px repeat(7, 1fr)', borderTop:'1px solid var(--border)', borderLeft:'1px solid var(--border)' }}
          >
            <div></div>
            {Array.from({ length:7 }).map((_,d)=>{
              const day = new Date(range.start); day.setDate(range.start.getDate()+d)
              return <div key={d} className="kpi-title" style={{ padding:8, borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>{day.toLocaleDateString()}</div>
            })}
            {Array.from({ length:11 }).map((_,h)=>{
              const hour = h+8
              return (
                <div key={`row-${hour}`} style={{ display:'contents' }}>
                  <div className="kpi-title" style={{ padding:6, borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>{String(hour).padStart(2,'0')}:00</div>
                  {Array.from({ length:7 }).map((_,d)=>{
                    const slot = new Date(range.start); slot.setDate(range.start.getDate()+d); slot.setHours(hour,0,0,0)
                    const scheduledHere = events.find(e=> e.kind==='scheduled' && e.at && new Date(e.at).getTime()===slot.getTime())
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
                                  toast(t(`pages.calendar.errors.${code}`, { iso: detail?.iso || '' }))
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
                        style={{ padding:0, height:36, border:'none', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', background: (()=>{
                          if (blockedHere) return 'repeating-linear-gradient(45deg, rgba(0,0,0,.04) 0, rgba(0,0,0,.04) 6px, transparent 6px, transparent 12px)'
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
          <ul style={{ margin:0, paddingLeft:16 }}>
            {events.map(e=> (<li key={e.id} className="kpi-title">[{e.kind}] {e.title || ''} {e.at}</li>))}
          </ul>
        )}
      </div>

      <Modal title={t('pages.calendar.quick.title')} open={quickOpen} onClose={()=> setQuickOpen(false)} footer={
        <>
          <button onClick={()=> setQuickOpen(false)} style={{ padding:'8px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.cancel')}</button>
          <button onClick={submitQuick} style={{ padding:'8px 12px', border:'1px solid var(--brand)', background:'var(--brand)', color:'white', borderRadius:8, fontWeight:700 }}>{t('pages.calendar.quick.submit')}</button>
        </>
      }>
        <div style={{ display:'grid', gap:10 }}>
          <label>
            <div className="kpi-title">{t('pages.calendar.quick.lead')}</div>
            <input value={quick.lead_id} onChange={e=> setQuick({ ...quick, lead_id:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <label>
              <div className="kpi-title">{t('pages.calendar.quick.agent')}</div>
              <input value={quick.agent_id} onChange={e=> setQuick({ ...quick, agent_id:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
            </label>
            <label>
              <div className="kpi-title">{t('pages.calendar.quick.kb')}</div>
              <input value={quick.kb_id} onChange={e=> setQuick({ ...quick, kb_id:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
            </label>
          </div>
          <label>
            <div className="kpi-title">{t('pages.calendar.quick.from')}</div>
            <input placeholder={'+12025550123'} value={quick.from} onChange={e=> setQuick({ ...quick, from:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <label>
            <div className="kpi-title">{t('pages.calendar.quick.datetime')}</div>
            <input type="datetime-local" value={quick.at ? new Date(quick.at).toISOString().slice(0,16) : ''} onChange={e=> setQuick({ ...quick, at: new Date(e.target.value).toISOString() })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
        </div>
      </Modal>

      <Drawer open={drawerOpen} onClose={()=> setDrawerOpen(false)} title={selected ? (selected.title || 'Scheduled') : ''}>
        {selected && (
          <div style={{ display:'grid', gap:8 }}>
            <div className="kpi-title">{selected.at}</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=> setDrawerOpen(false)} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.cancel')}</button>
              <button onClick={async ()=>{
                try{
                  await apiFetch(`/schedule/${selected.id}`, { method:'PATCH', body:{ cancel: true } })
                  toast('Canceled'); setDrawerOpen(false); load()
                } catch(err){ toast(String(err?.message || err)) }
              }} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('pages.calendar.drawer_cancel')||'Cancel'}</button>
              <button onClick={()=>{ setQuick({ ...quick, at: selected.at }); setQuickOpen(true); }} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('pages.calendar.drawer_reschedule')||'Reschedule'}</button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}


