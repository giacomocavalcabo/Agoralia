import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'
import { useToast } from '../components/ToastProvider.jsx'
import { useI18n } from '../lib/i18n.jsx'

export default function History() {
  const { t } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [leads, setLeads] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [groupByCompany, setGroupByCompany] = useState(false)

  async function load() {
    setLoading(true)
    const [callsRes, leadsRes] = await Promise.all([
      apiRequest('/calls'),
      apiRequest('/leads'),
    ])
    if (!callsRes.ok) toast.error(`Calls: ${callsRes.error}`)
    if (!leadsRes.ok) toast.error(`Leads: ${leadsRes.error}`)
    setRows(callsRes.ok ? (callsRes.data || []) : [])
    setLeads(leadsRes.ok ? (leadsRes.data || []) : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const groups = useMemo(() => {
    const map = new Map()
    const phoneToCompany = new Map(leads.map((l) => [l.phone, l.company || '']))
    for (const r of rows) {
      const phone = r.to || r.from || '—'
      const company = phoneToCompany.get(phone) || ''
      const key = groupByCompany ? (company || '—') : phone
      const cur = map.get(key) || { key, phone, company: groupByCompany ? key : company, count: 0, lastAt: null, lastId: null, country_iso: r.country_iso }
      cur.count += 1
      const at = new Date(r.created_at)
      if (!cur.lastAt || at > cur.lastAt) { cur.lastAt = at; cur.lastId = r.id }
      map.set(key, cur)
    }
    let arr = Array.from(map.values())
    if (q) {
      const ql = q.toLowerCase()
      arr = arr.filter((g) => (g.key || '').toLowerCase().includes(ql) || (g.phone || '').toLowerCase().includes(ql) || (g.company || '').toLowerCase().includes(ql))
    }
    arr.sort((a, b) => (b.lastAt?.getTime() || 0) - (a.lastAt?.getTime() || 0))
    return arr
  }, [rows, q])

  return (
    <div>
      <h1>{t('pages.history.title')}</h1>
      <div className="panel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input className="input" placeholder={t('pages.history.search_phone')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={load} disabled={loading}>{loading ? t('common.loading') : t('common.refresh')}</button>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={groupByCompany} onChange={(e) => setGroupByCompany(e.target.checked)} /> {t('pages.history.group_by_company')}
        </label>
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              {groupByCompany ? <th>{t('common.company')}</th> : <th>{t('common.phone')}</th>}
              <th>{t('common.country')}</th><th>{t('pages.history.total_calls')}</th><th>{t('pages.history.last_at')}</th><th>{t('common.detail')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.phone}>
                <td className={groupByCompany ? '' : 'preserve-ltr'}>{groupByCompany ? (g.company || '—') : g.phone}</td>
                <td>{g.country_iso || '—'}</td>
                <td>{g.count}</td>
                <td className="preserve-ltr">{g.lastAt ? g.lastAt.toLocaleString() : '—'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <a className="btn" href={`/calls/${g.lastId}`}>{t('pages.history.open_last')}</a>
                  {!groupByCompany && <a className="btn" href={`/history/${encodeURIComponent(g.phone)}`}>{t('pages.history.view_all')}</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


