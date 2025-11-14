import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch } from '../lib/api.js'

export default function LegalReviewModal({ numbers = [], onCancel, onConfirm }) {
  const { t } = useI18n()
  const [slides, setSlides] = useState([])
  const [consents, setConsents] = useState({})
  const [legalDefaults, setLegalDefaults] = useState({})

  const prefixes = useMemo(() => {
    const uniq = new Set()
    numbers.forEach((e164) => {
      const m = (e164 || '').match(/^\+\d{1,3}/)
      if (m) uniq.add(m[0])
    })
    return Array.from(uniq)
  }, [numbers])

  useEffect(() => {
    async function load() {
      // load defaults from backend to preselect choices
      try {
        const s = await apiFetch('/settings').then((r) => r.json())
        if (s.legal_defaults) setLegalDefaults(s.legal_defaults)
      } catch {}
      const results = await Promise.all(
        prefixes.map((p) => apiFetch(`/legal/notice?e164=${encodeURIComponent(p)}`).then((r) => r.json()))
      )
      // Deduplicate by country ISO so multiple prefixes mapping to the same
      // country (e.g., +390 and +391 -> IT) produce a single slide
      const byIso = new Map()
      for (const r of results) {
        const iso = r.country_iso || 'UNKNOWN'
        if (!byIso.has(iso)) {
          byIso.set(iso, { iso, notice: r.notice })
        }
      }
      const arr = Array.from(byIso.values())
      setSlides(arr)
      // preselect with defaults if present
      const init = {}
      arr.forEach((x) => {
        const v = legalDefaults[x.iso]
        if (v) init[x.iso] = v
      })
      setConsents(init)
    }
    if (prefixes.length) load()
  }, [prefixes])

  const canConfirm = slides.length > 0 && slides.every((s) => !!consents[s.iso])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, width: 720, maxWidth: '90%', padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>{t('pages.import.legal.title')}</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {slides.map((s, idx) => (
            <div key={idx} className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>{s.iso || 'Unknown'}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={`btn ${consents[s.iso]==='ack' ? 'primary' : ''}`} onClick={() => setConsents({ ...consents, [s.iso]: 'ack' })}>{t('pages.import.legal.legal_ok')}</button>
                  <button className={`btn ${consents[s.iso]==='explicit_ai' ? 'primary' : ''}`} onClick={() => setConsents({ ...consents, [s.iso]: 'explicit_ai' })}>{t('pages.import.legal.announce_ai')}</button>
                  <button className={`btn ${consents[s.iso]==='do_not_call' ? 'primary' : ''}`} onClick={() => setConsents({ ...consents, [s.iso]: 'do_not_call' })}>{t('pages.import.legal.do_not_call')}</button>
                </div>
              </div>
              <div style={{ color: '#6b7280', fontSize: 14, marginTop: 8 }}>
                <div><strong>{t('pages.import.legal.disclosure')}:</strong> {s.notice?.disclosure}</div>
                <div><strong>{t('pages.import.legal.dnc')}:</strong> {s.notice?.dnc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={!canConfirm} onClick={() => onConfirm(consents)}>{t('pages.import.legal.confirm_launch')}</button>
        </div>
      </div>
    </div>
  )
}


