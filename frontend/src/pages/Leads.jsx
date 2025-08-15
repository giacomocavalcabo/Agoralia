import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import Modal from '../components/Modal.jsx'
import Drawer from '../components/Drawer.jsx'
import { LANG_OPTIONS, displayLang } from '../lib/languages'
import { useI18n } from '../lib/i18n.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import SkeletonTable from '../components/SkeletonTable.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function Leads() {
  const { t } = useI18n()
  const toast = useToast()
  const [campaigns, setCampaigns] = useState([])
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(25)
  const [offset, setOffset] = useState(0)
  const [agents, setAgents] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [agentId, setAgentId] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', company: '', role: '', preferred_lang: 'it-IT', consent_basis: 'consent', consent_status: 'unknown' })
  const [showModal, setShowModal] = useState(false)
  const [views, setViews] = useState([])
  const [activeView, setActiveView] = useState('')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const [scheduleOffsetMin, setScheduleOffsetMin] = useState(60)
  const [schedulePhones, setSchedulePhones] = useState([])
  const [loading, setLoading] = useState(false)

  async function load() {
    const [cs, as] = await Promise.all([
      apiFetch('/campaigns').then((r) => r.json()),
      apiFetch('/agents').then((r) => r.json()),
    ])
    setCampaigns(cs)
    setAgents(as)
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lead_views')
      const arr = raw ? JSON.parse(raw) : []
      setViews(arr)
    } catch {}
  }, [])

  function saveView() {
    const name = prompt('Nome vista?')
    if (!name) return
    const next = [...views.filter((v) => v.name !== name), { name, rules, selectedCampaign }]
    setViews(next)
    localStorage.setItem('lead_views', JSON.stringify(next))
    setActiveView(name)
  }

  function applyView(name) {
    const v = views.find((x) => x.name === name)
    if (!v) return
    setSelectedCampaign(v.selectedCampaign || '')
    setRules(v.rules || [])
    setActiveView(name)
  }


  async function loadLeads() {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedCampaign) params.set('campaign_id', selectedCampaign)
    if (filters.q) params.set('q', filters.q)
    if (filters.country_iso) params.set('country_iso', filters.country_iso)
    if (filters.preferred_lang) params.set('preferred_lang', filters.preferred_lang)
    if (filters.role) params.set('role', filters.role)
    if (filters.consent_status) params.set('consent_status', filters.consent_status)
    if (filters.created_gte) params.set('created_gte', filters.created_gte)
    if (filters.created_lte) params.set('created_lte', filters.created_lte)
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    const path = `/leads${params.toString() ? `?${params.toString()}` : ''}`
    const res = await apiFetch(path)
    const data = await res.json()
    setLeads(data.items || data)
    setTotal(Number(data.total || 0))
    if (typeof data.limit === 'number') setLimit(data.limit)
    if (typeof data.offset === 'number') setOffset(data.offset)
    setLoading(false)
  }
  useEffect(() => { loadLeads() }, [selectedCampaign])

  async function addLead() {
    const body = { ...form, campaign_id: selectedCampaign ? Number(selectedCampaign) : null }
    await apiFetch('/leads', { method: 'POST', body })
    setForm({ name: '', phone: '', company: '', role: '', preferred_lang: form.preferred_lang, consent_basis: 'consent', consent_status: 'unknown' })
    loadLeads()
    setShowModal(false)
  }

  async function callLead(phone) {
    const res = await apiFetch('/calls/retell/outbound', { method: 'POST', body: { to: phone, agent_id: agentId || undefined, metadata: { legal_accepted: true } } })
    const data = await res.json()
    if (res.ok) toast.success(t('pages.leads.call_created'))
    else toast.error(t('common.error_code', { code: data.detail || res.status }))
  }

  function collectSelectedPhones() {
    const els = Array.from(document.querySelectorAll('input[name="lead-select"]:checked'))
    return els.map((el) => el.value)
  }

  async function confirmSchedule() {
    const delayMs = scheduleAt ? Math.max(0, new Date(scheduleAt).getTime() - Date.now()) : (Math.max(1, Number(scheduleOffsetMin) || 0) * 60 * 1000)
    const items = schedulePhones.map((p) => ({ to: p, delay_ms: delayMs, metadata: { legal_accepted: true }, agent_id: agentId || undefined }))
    const res = await apiFetch('/schedule/bulk', { method: 'POST', body: items })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.detail || `Errore ${res.status}`)
    }
    setScheduleOpen(false)
  }

  const [filters, setFilters] = useState({ q: '', country_iso: '', preferred_lang: '', role: '', consent_status: '', created_gte: '', created_lte: '', campaign_id: '' })
  const [rules, setRules] = useState([]) // [{ field, op, value }]

  function addRule() {
    const defaultField = 'q'
    setRules([...rules, { field: defaultField, op: 'is', value: '' }])
  }
  function removeRule(idx) {
    setRules(rules.filter((_, i) => i !== idx))
  }
  function updateRule(idx, patch) {
    const next = [...rules]
    next[idx] = { ...next[idx], ...patch }
    setRules(next)
    // reflect to simple filters for backend params (last rule wins)
    const f = { ...filters }
    for (const r of next) {
      if (['q','country_iso','preferred_lang','role','consent_status','created_gte','created_lte','campaign_id'].includes(r.field)) {
        if (r.op === 'is') f[r.field] = r.value
        if (r.op === 'is_not') f[r.field] = ''
      }
    }
    setFilters(f)
  }

  function debounced(fn, delay) {
    let t
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay) }
  }
  const applyFilters = useMemo(() => debounced(() => {
    const url = new URL(window.location.href)
    Object.entries(filters).forEach(([k,v]) => { if (v) url.searchParams.set(k, v); else url.searchParams.delete(k) })
    if (selectedCampaign) url.searchParams.set('campaign_id', selectedCampaign); else url.searchParams.delete('campaign_id')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))
    window.history.replaceState({}, '', url.toString())
    loadLeads()
  }, 300), [selectedCampaign, filters])
  useEffect(() => { applyFilters() }, [filters])
  useEffect(() => { loadLeads() }, [limit, offset])
  useEffect(() => {
    const url = new URL(window.location.href)
    const init = { ...filters }
    for (const k of Object.keys(init)) init[k] = url.searchParams.get(k) || ''
    const cid = url.searchParams.get('campaign_id') || ''
    const lim = parseInt(url.searchParams.get('limit') || '25', 10)
    const off = parseInt(url.searchParams.get('offset') || '0', 10)
    setFilters(init)
    setSelectedCampaign(cid)
    setLimit(isNaN(lim) ? 25 : lim)
    setOffset(isNaN(off) ? 0 : off)
  }, [])

  return (
    <div>
      <h1>{t('pages.leads.title')}</h1>
      <div className="panel" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input
            className="input"
            style={{ maxWidth: 360 }}
            placeholder={t('pages.leads.filters.search')}
            value={filters.q}
            onChange={(e)=> setFilters({ ...filters, q: e.target.value })}
            aria-label={t('pages.leads.filters.search')}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={saveView}>{t('common.save')}</button>
            <button className="btn" onClick={() => { setActiveView(''); setRules([]); setFilters({ q: '', country_iso: '', preferred_lang: '', role: '', consent_status: '', created_gte: '', created_lte: '', campaign_id: '' }) }}>{t('common.clear')}</button>
            <select className="input" value={activeView} onChange={(e) => applyView(e.target.value)}>
              <option value="">—</option>
              {views.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => { const phones = collectSelectedPhones(); if (!phones.length) { toast.error(t('pages.leads.select_at_least_one')); return } setSchedulePhones(phones); setScheduleAt(''); setScheduleOffsetMin(60); setScheduleOpen(true) }}>{t('pages.leads.schedule_selected')}</button>
            <button className="btn primary" style={{ width: 180 }} onClick={() => setShowModal(true)}>{t('pages.leads.add_lead')}</button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {rules.map((r, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '200px 140px 1fr 80px', gap: 8, alignItems: 'center' }}>
              <select className="input" value={r.field} onChange={(e) => updateRule(idx, { field: e.target.value, value: '' })}>
                <option value="q">{t('pages.leads.filters.search')}</option>
                <option value="campaign_id">{t('pages.leads.filters.campaign')}</option>
                <option value="country_iso">{t('pages.leads.filters.country')}</option>
                <option value="preferred_lang">{t('pages.leads.filters.language')}</option>
                <option value="role">{t('pages.leads.filters.role')}</option>
                <option value="consent_status">{t('pages.leads.filters.consent')}</option>
                <option value="created_gte">{t('pages.leads.filters.created_after')}</option>
                <option value="created_lte">{t('pages.leads.filters.created_before')}</option>
              </select>
              <select className="input" value={r.op} onChange={(e) => updateRule(idx, { op: e.target.value })}>
                <option value="is">{t('common.is')}</option>
                <option value="is_not">{t('common.is_not')}</option>
              </select>
              {r.field === 'preferred_lang' ? (
                <select className="input" value={r.value} onChange={(e) => updateRule(idx, { value: e.target.value })}>
                  <option value="">—</option>
                  {LANG_OPTIONS.map((l) => <option key={l.locale} value={l.locale}>{displayLang(l.locale)}</option>)}
                </select>
              ) : r.field === 'consent_status' ? (
                <select className="input" value={r.value} onChange={(e) => updateRule(idx, { value: e.target.value })}>
                  <option value="">{t('common.any')}</option>
                  <option value="unknown">{t('pages.leads.consent.unknown')}</option>
                  <option value="granted">{t('pages.leads.consent.granted')}</option>
                  <option value="denied">{t('pages.leads.consent.denied')}</option>
                </select>
              ) : r.field === 'campaign_id' ? (
                <select className="input" value={r.value} onChange={(e) => updateRule(idx, { value: e.target.value })}>
                  <option value="">{t('common.all')}</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : r.field === 'created_gte' || r.field === 'created_lte' ? (
                <input className="input" type="datetime-local" value={r.value} onChange={(e) => updateRule(idx, { value: e.target.value })} />
              ) : (
                <input className="input" value={r.value} onChange={(e) => updateRule(idx, { value: e.target.value })} placeholder={r.field === 'country_iso' ? t('pages.leads.country_placeholder') : ''} />
              )}
              <button className="btn" onClick={() => removeRule(idx)}>{t('common.remove')}</button>
            </div>
          ))}
          <div><button className="btn" onClick={addRule}>{t('pages.leads.add_filter')}</button></div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div className="kpi-title">{t('pages.leads.total')}: {total}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(filters).filter(([k,v]) => !!v).map(([k,v]) => (
              <span key={k} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {k}: {v} <button className="btn" onClick={()=> setFilters({ ...filters, [k]: '' })}>×</button>
              </span>
            ))}
          </div>
        </div>
        {loading ? <SkeletonTable rows={6} /> : (
        <table className="table" style={{ position: 'relative' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            <tr>
              <th><input type="checkbox" onChange={(e) => {
                const checked = e.target.checked
                document.querySelectorAll('input[name="lead-select"]').forEach((el) => el.checked = checked)
              }} /></th>
              <th>{t('common.name')}</th><th>{t('common.company')}</th><th>{t('common.phone')}</th><th>{t('common.country')}</th><th>{t('common.lang')}</th><th>{t('common.role')}</th><th>{t('common.consent')}</th><th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td><input type="checkbox" name="lead-select" value={l.phone} /></td>
                <td>{l.name}</td>
                <td>{l.company || '—'}</td>
                <td className="preserve-ltr">{l.phone}</td>
                <td>{l.country_iso || '—'}</td>
                <td>{displayLang(l.preferred_lang) || '—'}</td>
                <td>{l.role || '—'}</td>
                <td>{l.consent_status || '—'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn" onClick={() => callLead(l.phone)} disabled={l.consent_status === 'denied'}>{t('pages.leads.call')}</button>
                  <button className="btn" onClick={() => { setSchedulePhones([l.phone]); setScheduleAt(''); setScheduleOffsetMin(60); setScheduleOpen(true) }}>{t('pages.leads.schedule')}</button>
                  <button className="btn" onClick={async () => { await apiFetch(`/leads/${l.id}`, { method: 'DELETE' }); loadLeads() }}>{t('common.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        {!loading && leads.length === 0 && (
          <EmptyState
            title={t('pages.leads.no_leads')}
            description={t('pages.leads.select_at_least_one')}
            actions={[
              <a key="import" className="btn" href="/import">{t('pages.import.import_csv')}</a>,
              <button key="add" className="btn primary" onClick={() => setShowModal(true)}>{t('pages.leads.add_lead')}</button>
            ]}
          />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="kpi-title">{t('pages.leads.rows_per_page')}</span>
            <select className="input" value={limit} onChange={(e)=>{ setOffset(0); setLimit(parseInt(e.target.value,10)) }}>
              {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn" onClick={()=> setOffset(Math.max(0, offset - limit))} disabled={offset<=0}>{t('common.prev')}</button>
            <span className="kpi-title">{Math.floor(offset/limit)+1} / {Math.max(1, Math.ceil(total/limit))}</span>
            <button className="btn" onClick={()=> setOffset(Math.min(total, offset + limit))} disabled={offset + limit >= total}>{t('common.next')}</button>
          </div>
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={t('pages.leads.add_lead')}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
            <button className="btn primary" onClick={addLead}>{t('common.add')}</button>
          </div>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input className="input" placeholder={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder={t('common.company')} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="input" placeholder="E.164 +39.." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <select className="input" value={form.preferred_lang} onChange={(e) => setForm({ ...form, preferred_lang: e.target.value })}>
            {LANG_OPTIONS.map((l) => <option key={l.locale} value={l.locale}>{displayLang(l.locale)}</option>)}
          </select>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="">—</option>
            <option>{t('pages.leads.roles.supplier')}</option>
            <option>{t('pages.leads.roles.supplied')}</option>
          </select>
          <select className="input" value={form.consent_status} onChange={(e) => setForm({ ...form, consent_status: e.target.value })}>
            <option>{t('pages.leads.consent.unknown')}</option>
            <option>{t('pages.leads.consent.granted')}</option>
            <option>{t('pages.leads.consent.denied')}</option>
          </select>
        </div>
      </Modal>

      <Drawer
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title={t('pages.leads.schedule_calls', { n: schedulePhones.length || collectSelectedPhones().length })}
        footer={<div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}><button className="btn" onClick={()=> setScheduleOpen(false)}>{t('common.cancel')}</button><button className="btn primary" onClick={confirmSchedule}>{t('pages.leads.schedule')}</button></div>}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <label className="kpi-title">{t('pages.leads.in')}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" type="number" min={1} value={scheduleOffsetMin} onChange={(e) => setScheduleOffsetMin(parseInt(e.target.value || '1', 10))} style={{ width: 120 }} />
            <span>{t('pages.leads.minutes')}</span>
          </div>
          <div className="kpi-title" style={{ textAlign:'center' }}>{t('common.or')}</div>
          <label className="kpi-title">{t('pages.leads.at')}</label>
          <input className="input" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
        </div>
      </Drawer>
    </div>
  )
}


