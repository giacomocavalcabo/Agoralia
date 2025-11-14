import { useEffect, useMemo, useRef, useState } from 'react'
import LegalReviewModal from '../components/LegalReviewModal.jsx'
import { apiFetch } from '../lib/api'
import { useI18n } from '../lib/i18n.jsx'
import { useToast } from '../components/ToastProvider.jsx'

export default function ImportPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [text, setText] = useState('')
  const [fromNum, setFromNum] = useState('')
  const [spacing, setSpacing] = useState(1000)
  const [status, setStatus] = useState('')
  const [showReview, setShowReview] = useState(false)
  const [consents, setConsents] = useState({})
  const [requireLegal, setRequireLegal] = useState(true)
  const [legalDefaults, setLegalDefaults] = useState({})
  const [agents, setAgents] = useState([])
  const [agentId, setAgentId] = useState('')
  const [kbId, setKbId] = useState('')
  const [kbs, setKbs] = useState([])

  // CSV state
  const [delimiter, setDelimiter] = useState(',')
  const [csvCols, setCsvCols] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [mapTo, setMapTo] = useState({ to: 'to', from: 'from', agent: 'agent', delay: 'delay_ms' })
  const [metaCols, setMetaCols] = useState([])
  const fileInput = useRef(null)

  const prefixes = useMemo(() => {
    const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    const uniq = new Set()
    lines.forEach((e164) => {
      const m = e164.match(/^\+\d{1,3}/)
      if (m) uniq.add(m[0])
    })
    return Array.from(uniq)
  }, [text])

  useEffect(() => {
    // defaults
    apiFetch('/settings').then((r) => r.json()).then((s) => {
      if (s.default_from_number) setFromNum(s.default_from_number)
      if (s.default_spacing_ms != null) setSpacing(s.default_spacing_ms)
      if (typeof s.require_legal_review === 'boolean') setRequireLegal(s.require_legal_review)
      if (s.legal_defaults) setLegalDefaults(s.legal_defaults)
    }).catch(() => {})
    apiFetch('/agents').then((r) => r.json()).then(setAgents).catch(() => {})
    apiFetch('/kbs').then((r) => r.json()).then(setKbs).catch(() => {})
    // prefill from Leads bulk action
    const pre = localStorage.getItem('batch_prefill')
    if (pre) {
      setText(pre)
      localStorage.removeItem('batch_prefill')
    }
  }, [])

  async function loadNotices(prefixList) {
    const results = await Promise.all(
      prefixList.map((p) => apiFetch(`/legal/notice?e164=${encodeURIComponent(p)}`).then((r) => r.json()).catch(() => ({ country_iso: 'UNKNOWN', notice: '' })))
    )
    return results
  }

  function parseCsvText(txt) {
    const lines = txt.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length === 0) { setCsvCols([]); setCsvRows([]); return }
    const sep = delimiter || ','
    const split = (line) => line.split(sep).map((s) => s.trim())
    const first = split(lines[0])
    // if first row likely header
    const hasHeader = first.some((c) => /[a-zA-Z]/.test(c))
    const cols = hasHeader ? first : ['to']
    const rows = (hasHeader ? lines.slice(1) : lines).map(split)
    setCsvCols(cols)
    setCsvRows(rows)
    // default mapping suggestions
    const low = cols.map((c) => c.toLowerCase())
    const find = (cands) => {
      for (const c of cands) { const i = low.indexOf(c); if (i !== -1) return cols[i] }
      return ''
    }
    setMapTo({
      to: find(['to', 'to_number', 'phone', 'number']) || cols[0] || '',
      from: find(['from', 'from_number', 'caller_id']) || '',
      agent: find(['agent', 'agent_id']) || '',
      delay: find(['delay', 'delay_ms', 'spacing_ms']) || '',
    })
    const meta = cols.filter((c) => {
      const l = c.toLowerCase()
      return ![ 'to','to_number','phone','number','from','from_number','caller_id','agent','agent_id','delay','delay_ms','spacing_ms' ].includes(l)
    })
    setMetaCols(meta)
  }

  async function onPickCsv(e) {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const txt = await f.text()
    parseCsvText(txt)
  }

  function normalizeE164(raw) {
    if (!raw) return null
    const s = String(raw).replace(/[\s\-().]/g, '')
    if (!s) return null
    // Basic E.164: + and up to 15 digits
    if (/^\+\d{6,15}$/.test(s)) return s
    if (/^\d{6,15}$/.test(s)) return `+${s}`
    return null
  }

  function buildItemsFromCsv() {
    if (!csvRows.length) return []
    const colIndex = (name) => (csvCols.indexOf(name))
    const idxTo = colIndex(mapTo.to)
    const idxFrom = colIndex(mapTo.from)
    const idxAgent = colIndex(mapTo.agent)
    const idxDelay = colIndex(mapTo.delay)
    const items = []
    csvRows.forEach((row, i) => {
      const to = normalizeE164(idxTo >= 0 ? row[idxTo] : row[0])
      if (!to) return
      const item = {
        to,
        from_number: idxFrom >= 0 ? normalizeE164(row[idxFrom]) || undefined : (fromNum || undefined),
        delay_ms: (() => { if (idxDelay >= 0) { const v = parseInt(row[idxDelay], 10); return Number.isFinite(v) ? v : i * spacing } return i * spacing })(),
        agent_id: idxAgent >= 0 ? (row[idxAgent] || undefined) : (agentId || undefined),
        metadata: {},
      }
      metaCols.forEach((mc) => {
        const mi = colIndex(mc)
        if (mi >= 0 && row[mi] !== undefined && row[mi] !== '') item.metadata[mc.toLowerCase()] = row[mi]
      })
      if (Object.keys(item.metadata).length === 0) delete item.metadata
      items.push(item)
    })
    return items
  }

  async function submit(items) {
    // Legal grouping by country
    const lines = items.map((it) => it.to)
    const prefSet = new Set()
    lines.forEach((e164) => { const m = e164.match(/^\+\d{1,3}/); if (m) prefSet.add(m[0]) })
    const prefixList = Array.from(prefSet)
    const isoResults = await loadNotices(prefixList)
    const prefixToIso = new Map(prefixList.map((p, i) => [p, isoResults[i].country_iso || 'UNKNOWN']))
    const isoForNumber = (e164) => { let best = null; for (const p of prefixList) { if (e164.startsWith(p) && (!best || p.length > best.length)) best = p } return best ? prefixToIso.get(best) : 'UNKNOWN' }

    const final = items.map((it, i) => {
      const iso = isoForNumber(it.to)
      const mode = (consents[iso] || legalDefaults[iso] || 'ack')
      if (mode === 'do_not_call') return null
      return {
        ...it,
        delay_ms: typeof it.delay_ms === 'number' ? it.delay_ms : i * spacing,
        metadata: {
          ...(it.metadata || {}),
          legal_country_iso: iso,
          legal_mode: mode,
          legal_accepted: mode !== 'do_not_call',
        },
      }
    }).filter(Boolean)

    const res = await apiFetch('/batch', { method: 'POST', body: final })
    const data = await res.json()
    if (res.ok) toast.success(t('common.accepted', { n: data.accepted }))
    else toast.error(t('common.error_code', { code: data.detail || res.status }))
    setStatus('')
  }

  function openReview(items) {
    setShowReview(true)
    setPendingItems(items)
  }

  const [pendingItems, setPendingItems] = useState([])

  return (
    <div>
      <h1>{t('pages.import.title')}</h1>

      <div className="panel" style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label>{t('pages.import.agent')}</label>
          <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">{t('common.default')}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.lang})</option>
            ))}
          </select>
          <label>{t('pages.import.knowledge')}</label>
          <select className="input" value={kbId} onChange={(e) => setKbId(e.target.value)}>
            <option value="">{t('common.none')}</option>
            {kbs.map((k) => (
              <option key={k.id} value={k.id}>{k.lang || 'any'} · {k.scope || 'global'} · #{k.id}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => fileInput.current?.click()}>{t('pages.import.import_csv')}</button>
          <input ref={fileInput} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onPickCsv} />
          <input className="input" style={{ width: 100 }} placeholder="," value={delimiter} onChange={(e) => setDelimiter(e.target.value)} />
          <span style={{ color: '#6b7280' }}>{t('pages.import.or_paste_numbers')}</span>
        </div>

        <textarea className="input" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('pages.import.one_per_line')} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder={t('pages.import.caller_id_optional')} value={fromNum} onChange={(e) => setFromNum(e.target.value)} />
          <input className="input" type="number" min={0} step={250} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} />
          <button className="btn primary" onClick={() => {
            const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean)
            const items = lines.map((to, i) => ({ to, from_number: fromNum || undefined, delay_ms: i * spacing, agent_id: agentId || undefined, kb_id: kbId || undefined }))
            setPendingItems(items)
            setShowReview(true)
          }}>{t('common.start')}</button>
        </div>
        {status && <div style={{ color: '#6b7280' }}>{status}</div>}
      </div>

      {csvCols.length > 0 && (
        <div className="panel" style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontWeight: 600 }}>{t('pages.import.csv_mapping')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label>{t('common.to')}
              <select className="input" value={mapTo.to} onChange={(e) => setMapTo({ ...mapTo, to: e.target.value })}>
                {csvCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>{t('common.from')}
              <select className="input" value={mapTo.from} onChange={(e) => setMapTo({ ...mapTo, from: e.target.value })}>
                <option value="">(none)</option>
                {csvCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>{t('pages.import.agent')}
              <select className="input" value={mapTo.agent} onChange={(e) => setMapTo({ ...mapTo, agent: e.target.value })}>
                <option value="">(none)</option>
                {csvCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>{t('pages.import.delay_ms')}
              <select className="input" value={mapTo.delay} onChange={(e) => setMapTo({ ...mapTo, delay: e.target.value })}>
                <option value="">(none)</option>
                {csvCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div>
            <div style={{ marginBottom: 4, color: '#6b7280' }}>{t('pages.import.metadata_columns')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {csvCols.map((c) => (
                <label key={c} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 6px', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                  <input type="checkbox" checked={metaCols.includes(c)} onChange={(e) => {
                    setMetaCols((prev) => e.target.checked ? Array.from(new Set([...prev, c])) : prev.filter((x) => x !== c))
                  }} />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => {
              const items = buildItemsFromCsv().map((it)=> ({ ...it, kb_id: kbId || it.kb_id }))
              setPendingItems(items)
            }}>{t('common.preview')}</button>
            <button className="btn primary" disabled={!mapTo.to} onClick={() => {
              const items = buildItemsFromCsv().map((it)=> ({ ...it, kb_id: kbId || it.kb_id }))
              setPendingItems(items)
              setShowReview(true)
            }}>{t('common.start')}</button>
          </div>
          {pendingItems.length > 0 && (
            <div style={{ color: '#6b7280' }}>
              {t('pages.import.valid')}: {pendingItems.filter(i => i.to).length} · {t('pages.import.invalid')}: {csvRows.length - pendingItems.length}
            </div>
          )}
          {pendingItems.length > 0 && (
            <div style={{ color: '#6b7280' }}>{t('pages.import.preview_n', { n: pendingItems.length })} {JSON.stringify(pendingItems.slice(0, 5))}</div>
          )}
        </div>
      )}

      {showReview && requireLegal && (
        <LegalReviewModal
          numbers={(pendingItems.length ? pendingItems : text.split(/\n+/).map((s) => s.trim()).filter(Boolean)).map((it) => (typeof it === 'string' ? it : it.to))}
          onCancel={() => setShowReview(false)}
          onConfirm={(c) => { setConsents(c); setShowReview(false); submit(pendingItems.length ? pendingItems : text.split(/\n+/).map((s, i) => ({ to: s, from_number: fromNum || undefined, delay_ms: i * spacing, agent_id: agentId || undefined }))) }}
        />
      )}
      {!requireLegal && (
        <div style={{ marginTop: 8, color: '#6b7280' }}>{t('pages.import.legal_disabled_note')}</div>
      )}

    </div>
  )
}


