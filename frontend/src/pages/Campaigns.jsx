import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useI18n } from '../lib/i18n.jsx'
import TemplatesModal from '../components/TemplatesModal.jsx'

export default function Campaigns() {
  const { t } = useI18n()
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [status, setStatus] = useState('active')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [tplOpen, setTplOpen] = useState(false)

  async function load() {
    const [res, kpi] = await Promise.all([
      apiFetch('/campaigns').then((r) => r.json()),
      apiFetch('/campaigns/kpi').then((r) => r.json()).catch(() => []),
    ])
    const byId = new Map(kpi.map((x) => [x.id, x]))
    setRows(res.map((c) => ({ ...c, ...(byId.get(c.id) || {}) })))
  }
  useEffect(() => { load() }, [])

  async function create() {
    if (!name || creating) return
    setCreating(true)
    try {
      const res = await apiFetch('/campaigns', { method: 'POST', body: { name, status } })
      const data = await res.json()
      if (res.ok) {
        setMsg(t('pages.campaigns.created', { id: data.id }))
        setName('')
        load()
        setTimeout(() => setMsg(''), 3000)
      } else {
        setMsg(data?.detail || t('common.error_code', { code: res.status }))
        setTimeout(() => setMsg(''), 4000)
      }
    } catch (e) {
      setMsg(t('common.network_error'))
      setTimeout(() => setMsg(''), 4000)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <h1>{t('pages.campaigns.title')}</h1>
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: '1fr 180px 120px 140px', gap: 8 }}>
        <input className="input" placeholder={t('pages.campaigns.name_placeholder')} value={name} onChange={(e) => setName(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">{t('pages.campaigns.status.active')}</option>
          <option value="paused">{t('pages.campaigns.status.paused')}</option>
          <option value="done">{t('pages.campaigns.status.done')}</option>
        </select>
        <button className="btn" onClick={create} disabled={!name || creating}>{creating ? t('common.creating') : t('common.create')}</button>
        <button className="btn" onClick={()=> setTplOpen(true)}>Templates…</button>
      </div>
      {msg && <div className="panel" style={{ marginTop: 8, color: '#374151' }}>{msg}</div>}
      <div className="panel" style={{ marginTop: 12 }}>
        <table className="table">
          <thead><tr><th>{t('common.id')}</th><th>{t('common.name')}</th><th>{t('common.status')}</th><th>{t('pages.campaigns.leads')}</th><th>{t('pages.campaigns.calls')}</th><th>{t('pages.campaigns.qualified')}</th><th>{t('pages.campaigns.qualified_rate')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.status || '—'}</td><td>{r.leads ?? '—'}</td><td>{r.calls ?? '—'}</td><td>{r.qualified ?? '—'}</td><td>{r.qualified_rate != null ? r.qualified_rate.toFixed(1) + '%' : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <TemplatesModal open={tplOpen} onClose={()=> setTplOpen(false)} />
    </div>
  )
}


