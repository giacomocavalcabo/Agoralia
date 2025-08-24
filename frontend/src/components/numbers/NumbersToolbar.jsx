import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../ui/button.jsx'
import { Input } from '../ui/Input.jsx'

export default function NumbersToolbar({
  value,
  onChange,
  onBulkAssign,
  onBulkRelease,
  onExport,
  data = [] // aggiungo i dati per popolare i filtri
}) {
  const { t } = useTranslation('pages')
  const navigate = useNavigate()
  const [local, setLocal] = useState(value)

  useEffect(() => setLocal(value), [value])

  // Popola i filtri dai dati reali/demo
  const countries = useMemo(() => {
    const list = data.map(n => n.country_iso || n.country).filter(Boolean)
    return Array.from(new Set(list)).sort()
  }, [data])

  const statuses = useMemo(() => {
    const list = data.map(n => n.status).filter(Boolean)
    return Array.from(new Set(list)).sort()
  }, [data])

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => onChange(local), 400)
    return () => clearTimeout(id)
  }, [local.q, local.filters, local.pageSize]) // eslint-disable-line

  return (
    <div className="mt-4 mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between overflow-visible">
      <div className="flex items-center gap-3 flex-1">
        <Input
          data-testid="numbers-search"
          className="w-full md:w-80"
          placeholder={t('numbers.toolbar.search_placeholder')}
          value={local.q}
          onChange={(e) => setLocal(v => ({ ...v, q: e.target.value }))}
        />
        <select
          data-testid="filter-country"
          value={local.filters.country ?? ''}
          onChange={(e) => setLocal(v => ({ ...v, filters: { ...v.filters, country: e.target.value || undefined } }))}
          className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-primary-300"
          aria-label={t('numbers.toolbar.filters.country')}
        >
          <option value="">{t('numbers.toolbar.filters.country')}</option>
          {countries.map(iso => (
            <option key={iso} value={iso}>{iso}</option>
          ))}
        </select>
                         <select
          value={local.filters.status ?? ''}
          onChange={(e) => setLocal(v => ({ ...v, filters: { ...v.filters, status: e.target.value || undefined } }))}
          className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-primary-300"
          aria-label={t('numbers.toolbar.filters.status')}
          data-testid="filter-status"
          disabled={!statuses.length}
        >
          <option value="">{t('numbers.toolbar.filters.status')}</option>
          {statuses.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Button
          data-testid="clear-all-filters"
          variant="ghost"
          onClick={() => setLocal(v => ({ ...v, q: '', filters: {} }))}
        >
          {t('numbers.toolbar.clear_all')}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <LeadsShortcuts t={t} />
        <Button data-testid="bulk-assign" variant="secondary" onClick={onBulkAssign}>
          {t('numbers.toolbar.bulk.assign')}
        </Button>
        <Button data-testid="bulk-release" variant="outline" onClick={onBulkRelease}>
          {t('numbers.toolbar.bulk.release')}
        </Button>
        <Button data-testid="bulk-export" variant="outline" onClick={onExport}>
          {t('numbers.toolbar.bulk.export')}
        </Button>
      </div>
    </div>
  )
}

// Componente LeadsShortcuts con useNavigate
function LeadsShortcuts({ t }) {
  const navigate = useNavigate()
  return (
    <div className="flex gap-3">
      <Button
        variant="secondary"
        onClick={() => navigate('/leads/import')}
        data-testid="btn-import-leads"
      >
        {t('leads.actions.import', { ns: 'pages' })}
      </Button>
      <Button
        variant="primary"
        onClick={() => navigate('/leads/new')}
        data-testid="btn-add-lead"
      >
        {t('leads.actions.add', { ns: 'pages' })}
      </Button>
    </div>
  )
}


