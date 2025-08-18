import { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch } from '../lib/api.js'
import Drawer from '../components/Drawer.jsx'

export default function History(){
  const { t } = useI18n()
  const [data, setData] = useState({ total: 0, items: [] })
  const [open, setOpen] = useState(false)
  const [brief, setBrief] = useState(null)
  useEffect(()=>{ (async()=>{ try{ setData(await apiFetch('/history')) } catch{} })() }, [])
  return (
    <div style={{ display:'grid', gap:12 }}>
      <div className="panel">
        <div className="kpi-title">{t('pages.history.title')||'History'}</div>
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
      </div>

      <Drawer open={open} onClose={()=> setOpen(false)} title={brief?.header?.phone || ''}>
        {brief && (
          <div style={{ display:'grid', gap:8 }}>
            <div className="kpi-title">{brief.header.company} • {brief.header.lang} • {brief.header.agent}</div>
            <ul>
              {brief.last_turns.map((t,i)=> (<li key={i} className="kpi-title">{t.role}: {t.text}</li>))}
            </ul>
            <div className="kpi-title">€{brief.cost.total_eur} • {brief.cost.minutes} min</div>
          </div>
        )}
      </Drawer>
    </div>
  )
}


