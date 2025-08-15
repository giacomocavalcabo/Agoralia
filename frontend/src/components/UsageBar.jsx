import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function UsageBar() {
  const [ov, setOv] = useState(null)
  useEffect(() => { apiFetch('/me/usage').then(r=>r.json()).then(setOv).catch(()=>{}) }, [])
  const { used, cap, pct } = useMemo(() => {
    const used = Number(ov?.minutes_month_to_date || 0)
    // Prefer backend-provided cap if present; fallback by plan
    const plan = String(ov?.plan || 'free').toLowerCase()
    const capFromApi = ov && typeof ov.minutes_cap === 'number' ? ov.minutes_cap : null
    const cap = capFromApi != null ? capFromApi : (plan === 'pro' ? null : plan === 'core' ? 1000 : 100)
    const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : null
    return { used, cap, pct }
  }, [ov])
  return (
    <div title={cap ? `${used}/${cap} min` : `${used} min`} style={{ display:'flex', alignItems:'center', gap:8, minWidth: 160 }}>
      <div className="kpi-title" style={{ whiteSpace:'nowrap' }}>Usage</div>
      <div style={{ position:'relative', width: 120, height: 8, background:'#eef2f7', borderRadius: 999 }}>
        <div style={{ position:'absolute', inset:'0 0 0 0' }}>
          <div style={{ width: `${pct ?? 0}%`, height:'100%', borderRadius:999, background: pct != null && pct >= 80 ? '#f59e0b' : '#10a37f' }} />
        </div>
      </div>
      <div className="kpi-title preserve-ltr" style={{ minWidth: 60, textAlign:'right' }}>{cap ? `${used}/${cap}` : `${used}`}</div>
    </div>
  )
}


