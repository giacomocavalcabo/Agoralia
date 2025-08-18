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
  const [routingDrawer, setRoutingDrawer] = useState({ open: false, number: null })
  const [routingForm, setRoutingForm] = useState({
    agent_id: '',
    hours: { start: '09:00', end: '17:00', tz: 'UTC' },
    voicemail: { enabled: false, message: 'Please leave a message after the beep.' }
  })

  async function load(){
    try{ const r = await fetch(`${api}/numbers`); const j = await r.json(); setItems(j.items||[]) } catch{}
  }
  useEffect(()=>{ load() },[])

  async function saveRouting() {
    if (!routingDrawer.number) return
    try {
      await fetch(`${api}/numbers/${routingDrawer.number.id}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routingForm)
      })
      setRoutingDrawer({ open: false, number: null })
      load() // Refresh to show updated routing
    } catch (e) {
      console.error('Failed to save routing:', e)
    }
  }

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
            <thead><tr><th>Number</th><th>Country</th><th>Source</th><th>Capabilities</th><th>Verified</th><th>Inbound</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map(n=> (
                <tr key={n.id}>
                  <td className="kpi-title">{n.e164}</td>
                  <td>{n.country_iso}</td>
                  <td>{n.source}</td>
                  <td>{(n.capabilities||[]).join(', ')}</td>
                  <td>{n.verified? 'yes':'no'}</td>
                  <td>{n.can_inbound? 'yes':'no'}</td>
                  <td>
                    {n.can_inbound && (
                      <button 
                        className="btn-sm" 
                        onClick={() => setRoutingDrawer({ open: true, number: n })}
                      >
                        {t('numbers.route') || 'Route'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="muted">No numbers</td></tr>}
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

      {/* Routing Drawer */}
      {routingDrawer.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {t('numbers.route_number') || 'Route Number'} {routingDrawer.number?.e164}
              </h3>
              <button 
                onClick={() => setRoutingDrawer({ open: false, number: null })}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <label>
                <div className="kpi-title">{t('numbers.agent_id') || 'Agent ID'}</div>
                <input 
                  value={routingForm.agent_id} 
                  onChange={e => setRoutingForm({ ...routingForm, agent_id: e.target.value })}
                  className="input" 
                  placeholder="agent_123"
                />
              </label>

              <div>
                <div className="kpi-title mb-2">{t('numbers.business_hours') || 'Business Hours'}</div>
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <div className="text-sm text-gray-600">Start</div>
                    <input 
                      type="time" 
                      value={routingForm.hours.start} 
                      onChange={e => setRoutingForm({ 
                        ...routingForm, 
                        hours: { ...routingForm.hours, start: e.target.value } 
                      })}
                      className="input" 
                    />
                  </label>
                  <label>
                    <div className="text-sm text-gray-600">End</div>
                    <input 
                      type="time" 
                      value={routingForm.hours.end} 
                      onChange={e => setRoutingForm({ 
                        ...routingForm, 
                        hours: { ...routingForm.hours, end: e.target.value } 
                      })}
                      className="input" 
                    />
                  </label>
                </div>
                <label className="mt-2 block">
                  <div className="text-sm text-gray-600">Timezone</div>
                  <select 
                    value={routingForm.hours.tz} 
                    onChange={e => setRoutingForm({ 
                      ...routingForm, 
                      hours: { ...routingForm.hours, tz: e.target.value } 
                    })}
                    className="input"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern</option>
                    <option value="America/Chicago">Central</option>
                    <option value="America/Denver">Mountain</option>
                    <option value="America/Los_Angeles">Pacific</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={routingForm.voicemail.enabled} 
                  onChange={e => setRoutingForm({ 
                    ...routingForm, 
                    voicemail: { ...routingForm.voicemail, enabled: e.target.checked } 
                  })}
                />
                <span className="kpi-title">{t('numbers.enable_voicemail') || 'Enable Voicemail'}</span>
              </label>

              {routingForm.voicemail.enabled && (
                <label>
                  <div className="kpi-title">{t('numbers.voicemail_message') || 'Voicemail Message'}</div>
                  <textarea 
                    value={routingForm.voicemail.message} 
                    onChange={e => setRoutingForm({ 
                      ...routingForm, 
                      voicemail: { ...routingForm.voicemail, message: e.target.value } 
                    })}
                    className="input" 
                    rows={3}
                  />
                </label>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setRoutingDrawer({ open: false, number: null })}
                className="btn-secondary flex-1"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button 
                onClick={saveRouting}
                className="btn flex-1"
              >
                {t('common.save') || 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


