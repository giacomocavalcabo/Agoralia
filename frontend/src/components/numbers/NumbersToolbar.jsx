import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/button.jsx'
import { Input } from '../ui/Input.jsx'
import FilterBuilder from '../filters/FilterBuilder'

export default function NumbersToolbar({
  value,
  onChange,
  onBulkAssign,
  onBulkRelease,
  onExport,
  data = []
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

  const providers = useMemo(() => {
    const list = data.map(n => n.provider).filter(Boolean)
    return Array.from(new Set(list)).sort()
  }, [data])

  const capabilities = useMemo(() => {
    const allCaps = data.flatMap(n => n.capabilities || [])
    return Array.from(new Set(allCaps)).sort()
  }, [data])

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => onChange(local), 400)
    return () => clearTimeout(id)
  }, [local.q, local.filters, local.pageSize]) // eslint-disable-line

  return (
    <div className="mt-4 mb-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Input
            data-testid="numbers-search"
            className="w-full md:w-80"
            placeholder={t('numbers.toolbar.search_placeholder')}
            value={local.q}
            onChange={(e) => setLocal(v => ({ ...v, q: e.target.value }))}
          />
          <Button
            data-testid="clear-all-filters"
            variant="ghost"
            onClick={() => setLocal(v => ({ ...v, q: '', filters: {} }))}
          >
            {t('numbers.toolbar.clear_filters')}
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

      <FilterBuilder
        value={local.filters?.rules || []}
        onChange={(rules) => setLocal(v => ({ ...v, filters: { ...v.filters, rules } }))}
        fields={[
          { key: 'country_iso', type: 'select', label: t('numbers.columns.country'), options: countries },
          { key: 'provider', type: 'select', label: t('numbers.columns.provider'), options: providers },
          { key: 'capabilities', type: 'multiselect', label: t('numbers.columns.capabilities'), options: capabilities },
          { key: 'created_at', type: 'date', label: t('numbers.columns.created') }
        ]}
      />
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


