import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'

export default function Numbers(){
  const { t } = useI18n()
  const api = useMemo(()=> import.meta.env.VITE_API_BASE_URL, [])
  const [tab, setTab] = useState('my')
  const [items, setItems] = useState([])
  const [buyIso, setBuyIso] = useState('US')
  const [byo, setByo] = useState({ e164:'', method:'voice', verification_id:'' })
  const [defaultFrom, setDefaultFrom] = useState('')

  async function load(){
    try{ const r = await fetch(`${api}/numbers`); const j = await r.json(); setItems(j.items||[]) } catch{}
  }
  useEffect(()=>{ load() },[])

  return (
    <div className="grid gap-3">
      <div className="panel flex gap-2">
        <button className="btn" onClick={()=> setTab('my')} style={{ fontWeight: tab==='my'?700:600 }}>{t('numbers.my_numbers')||'My Numbers'}</button>
        <button className="btn" onClick={()=> setTab('buy')} style={{ fontWeight: tab==='buy'?700:600 }}>{t('numbers.buy_numbers')||'Buy Numbers'}</button>
        <button className="btn" onClick={()=> setTab('policies')} style={{ fontWeight: tab==='policies'?700:600 }}>Policies</button>
      </div>

      {tab==='my' && (
        <div className="panel">
          <div className="kpi-title mb-2">{t('numbers.use_my_number')||'Use my number'}</div>
          <div className="flex flex-wrap gap-2 items-end">
            <input className="input" placeholder="+3902..." value={byo.e164} onChange={e=> setByo({ ...byo, e164:e.target.value })} />
            <select className="input" value={byo.method} onChange={e=> setByo({ ...byo, method:e.target.value })}>
              <option value="voice">Voice</option>
              <option value="sms">SMS</option>
            </select>
            <button className="btn" onClick={async ()=>{ try{ const r = await fetch(`${api}/numbers/byo`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ e164: byo.e164, method:byo.method }) }); const j = await r.json(); setByo(b=> ({ ...b, verification_id:j.verification_id||'' })); } catch{} }}>Verify</button>
            {!!byo.verification_id && (
              <>
                <input className="input" placeholder="code" onKeyDown={async (e)=>{ if(e.key==='Enter'){ try{ await fetch(`${api}/numbers/byo/confirm`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ verification_id: byo.verification_id, code: e.currentTarget.value }) }); setByo({ e164:'', method:'voice', verification_id:'' }); load() } catch{} } }} />
                <span className="kpi-title">ID {byo.verification_id}</span>
              </>
            )}
          </div>

          <div className="kpi-title mt-4">{t('numbers.default_from')||'Default caller ID'}</div>
          <div className="flex gap-2 items-end">
            <input className="input" placeholder="+" value={defaultFrom} onChange={e=> setDefaultFrom(e.target.value)} />
            <button className="btn" onClick={async ()=>{ try{ await fetch(`${api}/workspaces/ws_1/default_from`, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ e164: defaultFrom }) }); } catch{} }}>Save</button>
          </div>

          <table className="table mt-4">
            <thead><tr><th>Number</th><th>Country</th><th>Source</th><th>Capabilities</th><th>Verified</th><th>Inbound</th></tr></thead>
            <tbody>
              {items.map(n=> (
                <tr key={n.id}><td className="kpi-title">{n.e164}</td><td>{n.country_iso}</td><td>{n.source}</td><td>{(n.capabilities||[]).join(', ')}</td><td>{n.verified? 'yes':'no'}</td><td>{n.can_inbound? 'yes':'no'}</td></tr>
              ))}
              {!items.length && <tr><td colSpan={6} className="muted">No numbers</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab==='buy' && (
        <div className="panel">
          <div className="kpi-title mb-2">{t('numbers.buy_number')||'Buy a number'}</div>
          <div className="flex gap-2 items-end">
            <input className="input" placeholder="Country ISO" value={buyIso} onChange={e=> setBuyIso(e.target.value)} style={{ maxWidth:120 }} />
            <button className="btn" onClick={async ()=>{ try{ const r = await fetch(`${api}/numbers/buy`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ country_iso: buyIso }) }); const j = await r.json(); await load(); alert(`Bought ${j.e164}`) } catch{} }}>{t('numbers.buy_number')||'Buy a number'}</button>
          </div>
        </div>
      )}

      {tab==='policies' && (
        <div className="panel">
          <div className="kpi-title">Policies</div>
          <div className="muted">Country-specific caller ID rules will appear here.</div>
        </div>
      )}
    </div>
  )
}


