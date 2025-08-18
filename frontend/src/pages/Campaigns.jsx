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

  useEffect(()=>{ (async()=>{
    try { const res = await apiFetch('/i18n/locales'); setLocales(res) } catch(e){}
  })() },[])

  const callUnsupported = useMemo(()=> locales.call_supported && !locales.call_supported.includes(form.lang_default), [locales, form.lang_default])

  async function submit(){
    if (callUnsupported){ toast(t('app.notices.call_lang_not_supported', { lang: form.lang_default })); return }
    try{
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
    <div style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        {[1,2,3,4].map((s)=> (
          <button key={s} onClick={()=> setStep(s)} aria-current={step===s? 'page': undefined} style={{ padding:'6px 10px', border:'1px solid var(--border)', background: step===s? 'var(--surface)': 'transparent', borderRadius:8 }}>Step {s}</button>
        ))}
        <div className="kpi-title" style={{ marginLeft:'auto' }}>{t('pages.campaigns.title')}</div>
      </div>

      {step===1 && (
        <div className="panel" style={{ display:'grid', gap:10 }}>
          <div style={{ fontWeight:700 }}>{t('pages.campaigns.steps.details')}</div>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.name')}</div>
            <input value={form.name} onChange={e=> setForm({ ...form, name:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.goal')}</div>
              <select value={form.goal} onChange={e=> setForm({ ...form, goal:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }}>
                {GOALS.map(g=> (<option key={g} value={g}>{g}</option>))}
              </select>
            </label>
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.role')}</div>
              <select value={form.role} onChange={e=> setForm({ ...form, role:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }}>
                {ROLES.map(r=> (<option key={r} value={r}>{r}</option>))}
              </select>
            </label>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.lang')}</div>
              <select value={form.lang_default} onChange={e=> setForm({ ...form, lang_default:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }}>
                {(locales.call_supported || []).map(l=> (<option key={l} value={l}>{l}</option>))}
              </select>
            </label>
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.from')}</div>
              <input value={form.from_number} onChange={e=> setForm({ ...form, from_number:e.target.value })} placeholder={'+12025550123'} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
            </label>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.agent')}</div>
              <input value={form.agent_id} onChange={e=> setForm({ ...form, agent_id:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
            </label>
            <label>
              <div className="kpi-title">{t('pages.campaigns.fields.kb')}</div>
              <input value={form.kb_id} onChange={e=> setForm({ ...form, kb_id:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
            </label>
          </div>

          {callUnsupported && (
            <div role="alert" className="panel" style={{ border:'1px solid #F59E0B', background:'#FFFBEB', color:'#92400E' }}>
              {t('app.notices.call_lang_not_supported', { lang: form.lang_default })}
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button onClick={()=> setStep(2)} style={{ padding:'8px 12px', border:'1px solid var(--brand)', background:'var(--brand)', color:'white', borderRadius:8, fontWeight:700 }}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {step===2 && (
        <div className="panel" style={{ display:'grid', gap:10 }}>
          <div style={{ fontWeight:700 }}>{t('pages.campaigns.steps.audience')}</div>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.audience')||'Audience (lead ids comma-separated)'}</div>
            <input value={form.audience.lead_ids?.join(',')||''} onChange={e=> setForm({ ...form, audience:{ lead_ids: e.target.value.split(',').map(s=> s.trim()).filter(Boolean) } })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.pacing')}</div>
            <input type="number" min="1" value={form.pacing_npm} onChange={e=> setForm({ ...form, pacing_npm:e.target.value })} style={{ width:200, padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.budget')}</div>
            <input type="number" min="0" value={form.budget_cap_cents} onChange={e=> setForm({ ...form, budget_cap_cents:e.target.value })} style={{ width:200, padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
            <button onClick={()=> setStep(1)} style={{ padding:'8px 12px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.prev')}</button>
            <button onClick={()=> setStep(3)} style={{ padding:'8px 12px', border:'1px solid var(--brand)', background:'var(--brand)', color:'white', borderRadius:8, fontWeight:700 }}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {step===3 && (
        <div className="panel" style={{ display:'grid', gap:10 }}>
          <div style={{ fontWeight:700 }}>{t('pages.campaigns.steps.windows')}</div>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.dow')||'Days of week (1=Mon...7=Sun)'}</div>
            <input value={(form.window.dow||[]).join(',')} onChange={e=> setForm({ ...form, window:{ ...form.window, dow: e.target.value.split(',').map(s=> parseInt(s)).filter(n=> !isNaN(n)) } })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <input type="checkbox" checked={form.window.quiet_hours} onChange={e=> setForm({ ...form, window:{ ...form.window, quiet_hours:e.target.checked } })} />
            <span className="kpi-title">{t('pages.campaigns.fields.quiet_hours')}</span>
          </label>
          <label>
            <div className="kpi-title">{t('pages.campaigns.fields.start_at')||'Start date/time'}</div>
            <input type="datetime-local" value={form.window.start_at || ''} onChange={e=> setForm({ ...form, window:{ ...form.window, start_at: e.target.value } })} style={{ width:260, padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          </label>
          <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
            <button onClick={()=> setStep(2)} style={{ padding:'8px 12px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.prev')}</button>
            <button onClick={()=> setStep(4)} style={{ padding:'8px 12px', border:'1px solid var(--brand)', background:'var(--brand)', color:'white', borderRadius:8, fontWeight:700 }}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {step===4 && (
        <div className="panel" style={{ display:'grid', gap:10 }}>
          <div style={{ fontWeight:700 }}>{t('pages.campaigns.steps.review')}</div>
          <div className="kpi-title">{form.name} • {form.goal} • {form.role} • {form.lang_default}</div>
          <div className="kpi-title">{t('pages.campaigns.fields.audience')||'Audience'}: {(form.audience.lead_ids||[]).length} {t('pages.leads.title')||'leads'}</div>
          <div className="kpi-title">{t('pages.campaigns.fields.pacing')}: {form.pacing_npm}/min • {t('pages.campaigns.fields.budget')}: {form.budget_cap_cents||'-'}</div>
          <div className="kpi-title">{t('pages.campaigns.fields.start_at')||'Start'}: {form.window.start_at||'-'}; DoW: {(form.window.dow||[]).join(',')}</div>
          <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
            <button onClick={()=> setStep(3)} style={{ padding:'8px 12px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.prev')}</button>
            <button onClick={submit} style={{ padding:'8px 12px', border:'1px solid var(--brand)', background:'var(--brand)', color:'white', borderRadius:8, fontWeight:700 }}>{t('pages.campaigns.actions.create_schedule')}</button>
          </div>
        </div>
      )}
    </div>
  )
}


