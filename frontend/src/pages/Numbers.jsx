import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { useToast } from '../components/ToastProvider.jsx'

export default function Numbers(){
  const { t } = useI18n()
  const { toast } = useToast()
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
  const [kycDrawer, setKycDrawer] = useState({ open: false, country: '', requirements: [] })
  const [kycForm, setKycForm] = useState({
    company_name: '',
    company_address: '',
    contact_email: '',
    contact_phone: '',
    document_file: null
  })

  // Country compliance rules (simplified)
  const COUNTRY_RULES = {
    'US': {
      kyc_required: true,
      quiet_hours: { 
        'Mon-Fri': [['08:00', '21:00']], 
        'Sat': [['09:00', '17:00']], 
        'Sun': [] 
      },
      dnc_required: true,
      caller_id_rules: 'Valid returnable CLI required',
      restrictions: ['No mobile numbers for marketing', 'TCPA compliance required']
    },
    'IT': {
      kyc_required: false,
      quiet_hours: { 
        'Mon-Fri': [['09:00', '20:00']], 
        'Sat': [['09:00', '18:00']], 
        'Sun': [] 
      },
      dnc_required: true,
      caller_id_rules: 'No anonymous CLI allowed',
      restrictions: ['GDPR consent required', 'Italian language preferred']
    },
    'UK': {
      kyc_required: true,
      quiet_hours: { 
        'Mon-Fri': [['08:00', '21:00']], 
        'Sat': [['09:00', '17:00']], 
        'Sun': [] 
      },
      dnc_required: true,
      caller_id_rules: 'Valid returnable CLI required',
      restrictions: ['PECR compliance required', 'Opt-out mechanism mandatory']
    }
  }

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

  function openKyc(country) {
    const rules = COUNTRY_RULES[country] || {}
    setKycDrawer({ 
      open: true, 
      country, 
      requirements: rules.restrictions || []
    })
    setKycForm({
      company_name: '',
      company_address: '',
      contact_email: '',
      contact_phone: '',
      document_file: null
    })
  }

  async function submitKyc() {
    try {
      // Simulate KYC submission
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast('KYC submitted successfully')
      setKycDrawer({ open: false, country: '', requirements: [] })
      // Now allow number purchase
      await buyNumber()
    } catch (e) {
      toast('KYC submission failed')
    }
  }

  async function buyNumber() {
    try {
      const rules = COUNTRY_RULES[buyIso] || {}
      if (rules.kyc_required) {
        openKyc(buyIso)
        return
      }
      
      const r = await fetch(`${api}/numbers/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_iso: buyIso })
      })
      const j = await r.json()
      await load()
      alert(`Bought ${j.e164}`)
    } catch (e) {
      alert('Failed to buy number')
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
          <div className="kpi-title mb-4">{t('numbers.buy_number')||'Buy a number'}</div>
          
          {/* Country selection with compliance info */}
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <div className="text-sm text-gray-600 mb-1">Country</div>
                <select 
                  value={buyIso} 
                  onChange={e => setBuyIso(e.target.value)} 
                  className="input"
                >
                  <option value="US">United States</option>
                  <option value="IT">Italy</option>
                  <option value="UK">United Kingdom</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                </select>
              </label>
              
              <label>
                <div className="text-sm text-gray-600 mb-1">Number Type</div>
                <select className="input">
                  <option value="geographic">Geographic</option>
                  <option value="national">National</option>
                  <option value="toll-free">Toll-free</option>
                </select>
              </label>
            </div>

            {/* Compliance preflight check */}
            {buyIso && COUNTRY_RULES[buyIso] && (
              <div className="panel border border-blue-200 bg-blue-50">
                <div className="kpi-title mb-3 text-blue-800">Compliance Requirements for {buyIso}</div>
                <div className="space-y-2 text-sm text-blue-700">
                  {COUNTRY_RULES[buyIso].kyc_required && (
                    <div className="flex items-center gap-2">
                      <span className="text-red-600">⚠</span>
                      <span>KYC verification required</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">ℹ</span>
                    <span>Quiet hours: {JSON.stringify(COUNTRY_RULES[buyIso].quiet_hours)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">ℹ</span>
                    <span>DNC check: {COUNTRY_RULES[buyIso].dnc_required ? 'Required' : 'Not required'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">ℹ</span>
                    <span>Caller ID: {COUNTRY_RULES[buyIso].caller_id_rules}</span>
                  </div>
                  {COUNTRY_RULES[buyIso].restrictions.map((restriction, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-orange-600">⚠</span>
                      <span>{restriction}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button 
                className="btn" 
                onClick={buyNumber}
                disabled={!buyIso}
              >
                {t('numbers.buy_number')||'Buy a number'}
              </button>
              
              {buyIso && COUNTRY_RULES[buyIso]?.kyc_required && (
                <button 
                  className="btn-secondary" 
                  onClick={() => openKyc(buyIso)}
                >
                  Complete KYC
                </button>
              )}
            </div>
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

      {/* KYC Drawer */}
      {kycDrawer.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">
                KYC Verification for {kycDrawer.country}
              </h3>
              <button 
                onClick={() => setKycDrawer({ open: false, country: '', requirements: [] })}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="panel">
                <div className="kpi-title mb-3">Requirements</div>
                <ul className="space-y-1 text-sm">
                  {kycDrawer.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-orange-600">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <div className="text-sm text-gray-600 mb-1">Company Name *</div>
                  <input 
                    value={kycForm.company_name} 
                    onChange={e => setKycForm({ ...kycForm, company_name: e.target.value })}
                    className="input" 
                    required
                  />
                </label>
                
                <label>
                  <div className="text-sm text-gray-600 mb-1">Contact Email *</div>
                  <input 
                    type="email"
                    value={kycForm.contact_email} 
                    onChange={e => setKycForm({ ...kycForm, contact_email: e.target.value })}
                    className="input" 
                    required
                  />
                </label>
              </div>

              <label>
                <div className="text-sm text-gray-600 mb-1">Company Address *</div>
                <textarea 
                  value={kycForm.company_address} 
                  onChange={e => setKycForm({ ...kycForm, company_address: e.target.value })}
                  className="input" 
                  rows={3}
                  required
                />
              </label>

              <label>
                <div className="text-sm text-gray-600 mb-1">Contact Phone</div>
                <input 
                  value={kycForm.contact_phone} 
                  onChange={e => setKycForm({ ...kycForm, contact_phone: e.target.value })}
                  className="input" 
                  placeholder="+1234567890"
                />
              </label>

              <label>
                <div className="text-sm text-gray-600 mb-1">Business Document *</div>
                <input 
                  type="file" 
                  onChange={e => setKycForm({ ...kycForm, document_file: e.target.files[0] })}
                  className="input" 
                  accept=".pdf,.jpg,.png"
                  required
                />
                <div className="text-xs text-gray-500 mt-1">
                  Upload business license, registration, or similar document
                </div>
              </label>
            </div>

            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setKycDrawer({ open: false, country: '', requirements: [] })}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button 
                onClick={submitKyc}
                className="btn flex-1"
                disabled={!kycForm.company_name || !kycForm.company_address || !kycForm.contact_email || !kycForm.document_file}
              >
                Submit KYC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


