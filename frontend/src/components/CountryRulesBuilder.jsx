import { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'

export default function CountryRulesBuilder({ value, onChange }) {
  const { t } = useI18n()
  const [rows, setRows] = useState(() => Array.isArray(value) ? value : [])
  useEffect(() => { onChange?.(rows) }, [rows, onChange])
  function add() { setRows([...rows, { iso: '', disclosure: '', quiet_hours: '21:00-08:00', dnc: false }]) }
  function remove(i) { setRows(rows.filter((_, idx) => idx !== i)) }
  function update(i, patch) { const next = [...rows]; next[i] = { ...next[i], ...patch }; setRows(next) }
  return (
    <div className="panel" style={{ display:'grid', gap:8 }}>
      <table className="table">
        <thead><tr><th>ISO</th><th>{t('pages.import.legal.disclosure')}</th><th>Quiet hours</th><th>DNC</th><th></th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input className="input" value={r.iso} onChange={(e)=> update(i, { iso: e.target.value.toUpperCase() })} placeholder="IT" style={{ width:80 }} /></td>
              <td><input className="input" value={r.disclosure} onChange={(e)=> update(i, { disclosure: e.target.value })} placeholder={t('pages.import.legal.disclosure')} /></td>
              <td><input className="input" value={r.quiet_hours} onChange={(e)=> update(i, { quiet_hours: e.target.value })} placeholder="21:00-08:00" style={{ width:140 }} /></td>
              <td><input type="checkbox" checked={!!r.dnc} onChange={(e)=> update(i, { dnc: e.target.checked })} /></td>
              <td><button className="btn" onClick={()=> remove(i)}>{t('common.remove')}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div><button className="btn" onClick={add}>{t('common.add')}</button></div>
    </div>
  )
}


