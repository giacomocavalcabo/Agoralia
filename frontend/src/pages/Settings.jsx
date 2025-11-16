import { useEffect, useMemo, useState } from 'react'
import { apiFetch, apiRequest } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import Agents from './Agents.jsx'
import KnowledgeBases from './KnowledgeBases.jsx'
import Numbers from './Numbers.jsx'
import Compliance from './Compliance.jsx'
import CrmMapping from './CrmMapping.jsx'
import TenantAgents from './TenantAgents.jsx'
import { LANG_OPTIONS } from '../lib/languages.js'
import { useI18n } from '../lib/i18n.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import WebCallButton from '../components/WebCallButton.jsx'
import SettingsTabs from '../components/SettingsTabs.jsx'
import SaveBar from '../components/SaveBar.jsx'
import CountryRulesBuilder from '../components/CountryRulesBuilder.jsx'

export default function Settings() {
  const { t } = useI18n()
  const toast = useToast()
  const [agentId, setAgentId] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [fromNumber, setFromNumber] = useState('')
  const [spacingMs, setSpacingMs] = useState(1000)
  const [requireLegal, setRequireLegal] = useState(true)
  const [legalDefaults, setLegalDefaults] = useState('{}')
  const [countryRulesArr, setCountryRulesArr] = useState([])
  const [saving, setSaving] = useState(false)
  const [setupTab, setSetupTab] = useState('agents')
  const [gcRedirect, setGcRedirect] = useState(window.location.origin + '/google/callback')
  const [defaultLang, setDefaultLang] = useState('')
  const [supportedLangs, setSupportedLangs] = useState([])
  const [detectLang, setDetectLang] = useState(false)
  const [entitlements, setEntitlements] = useState({ languages_allowance: 1, integrations: ['csv'] })
  const [wsName, setWsName] = useState('')
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [brandColor, setBrandColor] = useState('#10a37f')
  const [brandLogo, setBrandLogo] = useState('')
  const [numbers, setNumbers] = useState([])
  const langOptions = useMemo(() => LANG_OPTIONS, [])

  useEffect(() => {
    const saved = localStorage.getItem('retell_agent_id')
    if (saved) setAgentId(saved)
    const t = localStorage.getItem('tenant_id')
    if (t) setTenantId(t)
    // load sectioned settings
    Promise.all([
      apiRequest('/settings/general').then(r=> r.ok ? r.data : null),
      apiRequest('/settings/languages').then(r=> r.ok ? r.data : null),
      apiRequest('/settings/telephony').then(r=> r.ok ? r.data : null),
      apiRequest('/settings/compliance').then(r=> r.ok ? r.data : null),
      apiRequest(endpoints.billing.entitlements).then(r=> r.ok ? r.data : null),
      apiRequest('/numbers').then(r=> r.ok ? r.data : []),
    ]).then(([g, l, tel, comp, ent, nums]) => {
      if (g) {
        if (g.ui_locale) setDefaultLang(g.ui_locale)
        if (g.workspace_name) setWsName(g.workspace_name)
        if (g.timezone) setTz(g.timezone)
        if (g.brand) { setBrandLogo(g.brand.logo_url || ''); setBrandColor(g.brand.color || '#10a37f') }
      }
      if (l) {
        if (l.default_lang) setDefaultLang(l.default_lang)
        if (Array.isArray(l.supported_langs)) setSupportedLangs(l.supported_langs)
        setDetectLang(!!l.prefer_detect)
      }
      if (tel) {
        if (tel.default_from_number) setFromNumber(tel.default_from_number)
        if (typeof tel.spacing_ms === 'number') setSpacingMs(tel.spacing_ms)
      }
      if (comp) {
        setRequireLegal(!!comp.require_legal_review)
        if (comp.country_rules) {
          setLegalDefaults(JSON.stringify(comp.country_rules, null, 2))
          // Convert dict {ISO: {...}} to array rows if needed
          if (!Array.isArray(comp.country_rules)) {
            const rows = Object.entries(comp.country_rules).map(([iso, v]) => ({ iso, disclosure: v?.disclosure || '', quiet_hours: v?.quiet_hours || '21:00-08:00', dnc: !!v?.dnc }))
            setCountryRulesArr(rows)
          } else {
            setCountryRulesArr(comp.country_rules)
          }
        }
      }
      if (ent) setEntitlements(ent)
      if (Array.isArray(nums)) setNumbers(nums)
    })
  }, [])

  function save() {
    localStorage.setItem('retell_agent_id', agentId)
    if (tenantId) localStorage.setItem('tenant_id', tenantId); else localStorage.removeItem('tenant_id')
    toast.success('Salvato')
  }

  async function startWebCall() {
    if (!agentId) return toast.error('Imposta prima agent_id')
    const res = await apiFetch(endpoints.calls.outboundRetell.replace('/retell/outbound','/retell/web'), {
      method: 'POST',
      body: { agent_id: agentId }
    })
    const data = await res.json()
    if (res.ok) toast.success(`Web call: ${JSON.stringify(data)}`)
    else toast.error(t('common.error_code', { code: data.detail || res.status }))
  }

  async function saveBackendSettings() {
    setSaving(true)
    let parsed = {}
    try { parsed = JSON.parse(legalDefaults || '{}') } catch { parsed = {} }
    // If builder array present, prefer it by converting to dict keyed by ISO
    if (Array.isArray(countryRulesArr) && countryRulesArr.length) {
      const dict = {}
      for (const r of countryRulesArr) {
        if (!r.iso) continue
        dict[r.iso] = { disclosure: r.disclosure || '', quiet_hours: r.quiet_hours || '21:00-08:00', dnc: !!r.dnc }
      }
      parsed = dict
    }
    try {
      const results = await Promise.all([
        apiRequest('/settings/general', { method: 'PUT', body: { ui_locale: defaultLang, workspace_name: wsName, timezone: tz, brand: { logo_url: brandLogo, color: brandColor } } }),
        apiRequest('/settings/languages', { method: 'PUT', body: { default_lang: defaultLang, supported_langs: supportedLangs, prefer_detect: detectLang } }),
        apiRequest('/settings/telephony', { method: 'PUT', body: { default_from_number: fromNumber, spacing_ms: spacingMs } }),
        apiRequest('/settings/compliance', { method: 'PUT', body: { require_legal_review: requireLegal, country_rules: parsed } }),
      ])
      const failed = results.find(r => !r.ok)
      if (failed) {
        toast.error(`Save failed: ${failed.error}`)
      } else {
        toast.success('Settings salvate')
      }
    } finally {
      setSaving(false)
    }
  }

  const [dirty, setDirty] = useState(false)
  useEffect(() => { setDirty(true) }, [agentId, tenantId, fromNumber, spacingMs, requireLegal, legalDefaults, defaultLang, supportedLangs, detectLang])

  function resetAll() { window.location.reload() }

  const tabs = [
    { id: 'general', label: t('pages.settings.tabs2.general') },
    { id: 'languages', label: t('pages.settings.tabs2.languages') },
    { id: 'agents', label: t('pages.settings.tabs2.agents') },
    { id: 'telephony', label: t('pages.settings.tabs2.telephony') },
    { id: 'compliance', label: t('pages.settings.tabs2.compliance') },
    { id: 'integrations', label: t('pages.settings.tabs2.integrations') },
    { id: 'billing', label: t('pages.settings.tabs2.billing') },
    { id: 'team', label: t('pages.settings.tabs2.team') },
    ...(entitlements?.roles_enabled ? [{ id: 'developer', label: t('pages.settings.tabs2.developer') }] : []),
  ]

  return (
    <div>
      <h1 style={{ marginBottom: 12 }}>{t('app.Settings')}</h1>
      <SettingsTabs tabs={tabs} initialTab="general">
        {(active) => (
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 320px', gap:12, alignItems:'start', maxWidth:'100%', overflow:'hidden' }}>
            <div className="panel" style={{ display: 'grid', gap: 12, minWidth: 0, maxWidth:'100%' }}>
              {active === 'general' && (
                <>
                  <div className="kpi-title">{t('pages.settings.general.title')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                    <label>{t('pages.settings.general.workspace_name')}</label>
                    <input className="input" placeholder="Acme Inc" value={wsName} onChange={(e)=> setWsName(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                    <label>{t('pages.settings.general.timezone')}</label>
                    <input className="input" value={tz} onChange={(e)=> setTz(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                    <label>{t('pages.settings.general.brand_color')}</label>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <input className="input" type="color" value={brandColor} onChange={(e)=> setBrandColor(e.target.value)} />
                      <input className="input" placeholder="Logo URL" value={brandLogo} onChange={(e)=> setBrandLogo(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                    <label>{t('pages.settings.general.ui_locale')}</label>
                    <select className="input" value={defaultLang} onChange={(e)=> setDefaultLang(e.target.value)}>
                      <option value="">—</option>
                      {langOptions.map(({ locale }) => <option key={locale} value={locale}>{locale}</option>)}
                    </select>
                  </div>
                  {brandLogo && (
                    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:12, alignItems:'center' }}>
                      <label>Preview</label>
                      <img src={brandLogo} alt="logo" style={{ height:48, width:48, objectFit:'contain', borderRadius:8, border:'1px solid var(--border)', background:'#fff' }} />
                    </div>
                  )}
                </>
              )}

              {active === 'languages' && (
                <>
                  <div className="kpi-title">{t('pages.settings.languages2.title')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                    <label>{t('pages.settings.languages2.default_conv')}</label>
                    <select className="input" value={defaultLang} onChange={(e)=> setDefaultLang(e.target.value)}>
                      <option value="">—</option>
                      {langOptions.map(({ locale }) => <option key={locale} value={locale}>{locale}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                    <label>{t('pages.settings.languages2.supported')}</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {langOptions.map(({ locale: l }) => (
                        <label key={l} style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <input type="checkbox" checked={supportedLangs.includes(l)} onChange={(e)=> setSupportedLangs(prev => e.target.checked ? Array.from(new Set([...prev, l])) : prev.filter(x=>x!==l))} /> {l}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                    <label>{t('pages.settings.languages2.detect')}</label>
                    <div>
                      <input type="checkbox" checked={detectLang} onChange={(e)=> setDetectLang(e.target.checked)} />
                      {detectLang && defaultLang && !supportedLangs.includes(defaultLang) && (
                        <div className="kpi-title" style={{ color:'#b91c1c', marginTop:6 }}>{t('pages.settings.supported_must_include_default')}</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {active === 'agents' && (
                <>
                  <Agents />
                  <KnowledgeBases />
                </>
              )}

              {active === 'telephony' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                    <label>{t('pages.settings.telephony2.caller_id')}</label>
                    <input className="input" value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} placeholder="+39…" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                    <label>{t('pages.settings.telephony2.spacing_sec')}</label>
                    <input className="input" type="number" min={0} step={1} value={Math.round(spacingMs/1000)} onChange={(e) => setSpacingMs(Number(e.target.value)*1000)} />
                  </div>
                  <div className="panel" style={{ marginTop: 8, overflowX: 'auto' }}>
                    <table className="table">
                      <thead><tr><th>ID</th><th>Number</th><th>Type</th><th>Verified</th><th>Country</th></tr></thead>
                      <tbody>
                        {numbers && numbers.length ? numbers.map((n) => (
                          <tr key={n.id}><td>{n.id}</td><td className="preserve-ltr">{n.e164}</td><td>{n.type}</td><td>{n.verified ? 'yes' : 'no'}</td><td>{n.country || '—'}</td></tr>
                        )) : (<tr><td colSpan="5" className="kpi-title">—</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {active === 'compliance' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                    <label>{t('pages.settings.compliance2.require_review')}</label>
                    <input type="checkbox" checked={requireLegal} onChange={(e) => setRequireLegal(e.target.checked)} />
                  </div>
                  <CountryRulesBuilder value={countryRulesArr} onChange={setCountryRulesArr} />
                  <div>
                    <div className="kpi-title">{t('pages.settings.compliance2.advanced_json')}</div>
                    <textarea className="input" rows={6} value={legalDefaults} onChange={(e) => setLegalDefaults(e.target.value)} placeholder='{"IT":"explicit_ai","FR":"ack"}' />
                  </div>
                </>
              )}

              {active === 'integrations' && (
                <>
                  {!entitlements?.integrations || entitlements.integrations.length <= 1 ? (
                    <div className="panel" style={{ background:'#fff7ed', borderColor:'#fdba74' }}>
                      {t('pages.billing.upgrade_required')} – {t('pages.billing.upgrade_languages_reason')}
                    </div>
                  ) : <CrmMapping />}
                </>
              )}

              {active === 'billing' && (
                <>
                  {String(entitlements?.plan || '').toLowerCase() === 'free' ? (
                    <div className="panel" style={{ background:'#fff7ed', borderColor:'#fdba74' }}>
                      {t('pages.billing.upgrade_required')}
                    </div>
                  ) : null}
                  <div className="kpi-title">{t('pages.billing.go_to_billing')}</div>
                </>
              )}

              {active === 'team' && (
                <div className="kpi-title">Team management coming soon</div>
              )}

              {active === 'developer' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', gap: 12, alignItems: 'center' }}>
                    <label>{t('pages.settings.webhook_tester')}</label>
                    <input className="input" id="test-call-id" placeholder={t('pages.settings.call_id_optional')} />
                    <button className="btn" onClick={async ()=>{
                      const callId = document.getElementById('test-call-id').value
                      const r = await apiRequest('/webhooks/test', { method: 'POST', body: { call_id: callId || null } })
                      if (r.ok) toast.success(t('pages.settings.webhook_sent'))
                      else toast.error(`Webhook error: ${r.error}`)
                    }}>{t('common.send')}</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', gap: 12, alignItems: 'center' }}>
                    <label>Tenant ID</label>
                    <input className="input" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="1" />
                    <button className="btn" onClick={()=>{ if (tenantId) localStorage.setItem('tenant_id', tenantId); else localStorage.removeItem('tenant_id'); toast.success('Saved locally') }}>Save local</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center' }}>
                    <label>Retell agent_id</label>
                    <input className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="agent_xxx" />
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <WebCallButton label={t('pages.settings.start_web_call')} className="btn" />
                  </div>
                </div>
              )}
            </div>
            <div style={{ position:'sticky', top: 12, alignSelf:'start', maxWidth: '100%' }}>
              <SaveBar dirty={dirty} saving={saving} onSave={saveBackendSettings} onReset={resetAll} />
            </div>
          </div>
        )}
      </SettingsTabs>
    </div>
  )
}


