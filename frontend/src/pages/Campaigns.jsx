import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch } from '../lib/api.js'
import { useToast } from '../components/ToastProvider.jsx'

const GOALS = ['rfq','demo','reorder','survey']
const ROLES = ['supplier','supplied']

export default function Campaigns(){
  const { t } = useI18n()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [locales, setLocales] = useState({ call_supported: [], call_default: 'en-US' })
  const [form, setForm] = useState({
    name:'', goal:'rfq', role:'supplier', lang_default:'en-US', agent_id:'', kb_id:'', from_number:'',
    pacing_npm: 10, budget_cap_cents: '', window:{ dow:[1,2,3,4,5], quiet_hours:true, tz: 'UTC' },
    audience: { lead_ids: [] }
  })
  const [scripts, setScripts] = useState(null)
  const [attestOk, setAttestOk] = useState(false)

  useEffect(()=>{ (async()=>{
    try { const res = await apiFetch('/i18n/locales'); setLocales(res) } catch(e){}
  })() },[])

  const callUnsupported = useMemo(()=> locales.call_supported && !locales.call_supported.includes(form.lang_default), [locales, form.lang_default])

  async function submit(){
    if (callUnsupported){ toast(t('app.notices.call_lang_not_supported', { lang: form.lang_default })); return }
    if (!attestOk){ toast(t('compliance.attest') || 'Please confirm compliance attestation'); return }
    try{
      // create attestation (demo)
      await apiFetch('/attestations', { method:'POST', body: { campaign_preview: { name: form.name, lang_default: form.lang_default } } })
      const payload = {
        name: form.name, goal: form.goal, role: form.role, lang_default: form.lang_default,
        agent_id: form.agent_id, kb_id: form.kb_id, from_number: form.from_number,
        pacing_npm: Number(form.pacing_npm)||0, budget_cap_cents: form.budget_cap_cents? Number(form.budget_cap_cents): undefined,
        window: form.window, audience: form.audience
      }
      const res = await apiFetch('/campaigns', { method:'POST', body: payload })
      toast(t('pages.campaigns.toasts.created', { id: res.id || '' }))
      setStep(4)
    } catch(err){ toast(String(err?.message || err)) }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-1.5">
        {[1,2,3,4].map((s)=> (
          <button key={s} onClick={()=> setStep(s)} aria-current={step===s? 'page': undefined} className={`rounded-lg border border-line px-2.5 py-1.5 ${step===s? 'bg-bg-app':''}`}>{t('pages.campaigns.step', { s }) || `Step ${s}`}</button>
        ))}
        <div className="kpi-title ml-auto">{t('pages.campaigns.title')}</div>
      </div>

      {step===1 && (
        <div className="panel grid gap-2.5">
          <div className="font-semibold">{t('pages.campaigns.steps.details')}</div>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.name')}</div>
            <input value={form.name} onChange={e=> setForm({ ...form, name:e.target.value })} className="input" />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.goal')}</div>
              <select value={form.goal} onChange={e=> setForm({ ...form, goal:e.target.value })} className="input">
                {GOALS.map(g=> (<option key={g} value={g}>{g}</option>))}
              </select>
            </label>
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.role')}</div>
              <select value={form.role} onChange={e=> setForm({ ...form, role:e.target.value })} className="input">
                {ROLES.map(r=> (<option key={r} value={r}>{r}</option>))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.lang')}</div>
              <select value={form.lang_default} onChange={e=> setForm({ ...form, lang_default:e.target.value })} className="input">
                {(locales.call_supported || []).map(l=> (<option key={l} value={l}>{l}</option>))}
              </select>
            </label>
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.from')}</div>
              <input value={form.from_number} onChange={e=> setForm({ ...form, from_number:e.target.value })} placeholder={'+12025550123'} className="input" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.agent')}</div>
              <input value={form.agent_id} onChange={e=> setForm({ ...form, agent_id:e.target.value })} className="input" />
            </label>
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.kb')}</div>
              <input value={form.kb_id} onChange={e=> setForm({ ...form, kb_id:e.target.value })} className="input" />
            </label>
          </div>

          {callUnsupported && (
            <div role="alert" className="rounded-xl border border-warn bg-warn/10 text-ink-900 px-3 py-2">
              <div className="text-sm">{t('app.notices.call_lang_not_supported', { lang: form.lang_default })}</div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={()=> setStep(2)} className="btn">{t('common.next')}</button>
          </div>
        </div>
      )}

      {step===2 && (
        <div className="panel grid gap-2.5">
          <div className="font-semibold">{t('pages.campaigns.steps.audience')}</div>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.audience')||'Audience (lead ids comma-separated)'}</div>
            <input value={form.audience.lead_ids?.join(',')||''} onChange={e=> setForm({ ...form, audience:{ lead_ids: e.target.value.split(',').map(s=> s.trim()).filter(Boolean) } })} className="input" />
          </label>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.pacing')}</div>
            <input type="number" min="1" value={form.pacing_npm} onChange={e=> setForm({ ...form, pacing_npm:e.target.value })} className="input w-[200px]" />
          </label>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.budget')}</div>
            <input type="number" min="0" value={form.budget_cap_cents} onChange={e=> setForm({ ...form, budget_cap_cents:e.target.value })} className="input w-[200px]" />
          </label>
          <div className="flex justify-between gap-2">
            <button onClick={()=> setStep(1)} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">{t('common.prev')}</button>
            <button onClick={()=> setStep(3)} className="btn">{t('common.next')}</button>
          </div>
        </div>
      )}

      {step===3 && (
        <div className="panel grid gap-2.5">
          <div className="font-semibold">{t('pages.campaigns.steps.windows')}</div>
          {/* Compliance scripts preview */}
          <div className="panel border border-line">
            <div className="kpi-title mb-1.5">{t('pages.campaigns.compliance') || 'Compliance'}</div>
            <div className="kpi-title">{scripts?.disclosure || t('pages.campaigns.compliance_disclosure') || 'Disclosure text…'}</div>
            <div className="kpi-title">{scripts?.record_consent || t('pages.campaigns.compliance_record') || 'Recording consent…'}</div>
          </div>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.dow')||'Days of week (1=Mon...7=Sun)'}</div>
            <input value={(form.window.dow||[]).join(',')} onChange={e=> setForm({ ...form, window:{ ...form.window, dow: e.target.value.split(',').map(s=> parseInt(s)).filter(n=> !isNaN(n)) } })} className="input" />
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.window.quiet_hours} onChange={e=> setForm({ ...form, window:{ ...form.window, quiet_hours:e.target.checked } })} />
            <span className="kpi-title">{t('pages.campaigns.fields.quiet_hours')}</span>
          </label>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.start_at')||'Start date/time'}</div>
            <input type="datetime-local" value={form.window.start_at || ''} onChange={e=> setForm({ ...form, window:{ ...form.window, start_at: e.target.value } })} className="input w-[260px]" />
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={attestOk} onChange={e=> setAttestOk(e.target.checked)} />
            <span className="kpi-title">{t('compliance.attest') || 'I confirm compliance responsibilities and local rules were verified.'}</span>
          </label>
          <div className="flex justify-between gap-2">
            <button onClick={()=> setStep(2)} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">{t('common.prev')}</button>
            <button onClick={()=> setStep(4)} className="btn">{t('common.next')}</button>
          </div>
        </div>
      )}

      {step===4 && (
        <div className="panel grid gap-2.5">
          <div className="font-semibold">{t('pages.campaigns.steps.review')}</div>
          <div className="kpi-title">{form.name} • {form.goal} • {form.role} • {form.lang_default}</div>
          <div className="kpi-title">{t('pages.campaigns.fields.audience')||'Audience'}: {(form.audience.lead_ids||[]).length} {t('pages.leads.title')||'leads'}</div>
          <div className="kpi-title">{t('pages.campaigns.fields.pacing')}: {form.pacing_npm}/min • {t('pages.campaigns.fields.budget')}: {form.budget_cap_cents||'-'}</div>
          <div className="kpi-title">{t('pages.campaigns.fields.start_at')||'Start'}: {form.window.start_at||'-'}; DoW: {(form.window.dow||[]).join(',')}</div>
          <div className="flex justify-between gap-2">
            <button onClick={()=> setStep(3)} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">{t('common.prev')}</button>
            <button onClick={submit} className="btn">{t('pages.campaigns.actions.create_schedule')}</button>
          </div>
        </div>
      )}
    </div>
  )
}


