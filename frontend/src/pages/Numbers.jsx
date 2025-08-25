import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/FormPrimitives.jsx'
import NumbersTable from '../components/NumbersTable'
import { useNumbers } from '../lib/useNumbers'
import { useIsDemo } from '../lib/useDemoData'
import { useToast } from '../components/ToastProvider.jsx'

export default function Numbers() {
  const { t } = useTranslation('pages')
  const isDemo = useIsDemo()
  const { toast } = useToast?.() ?? { toast: () => {} }

  const [filters, setFilters] = useState({
    q: '',
    showFilters: false,
    segment: { all: [] }
  })

  const { data, total, loading, error, refetch } = useNumbers(filters)

  const onFiltersChange = (newFilters) => setFilters(newFilters)
  const onSearch = (q) => setFilters(f => ({ ...f, q }))

  const bulkExport = () => {
    // always safe to export dummy CSV client-side
    const header = ['number','country','provider','capabilities']
    const rows = data.map(x => [x.e164, x.country_iso, x.provider, (x.capabilities || []).join(';')].join(','))
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'numbers.csv'; a.click()
  }

  return (
    <div className="px-6 lg:px-8 py-6">
      <PageHeader
        title={t('numbers.title')}
        description={t('numbers.description')}
      />

      <NumbersTable
        data={data}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onSearch={onSearch}
        onExport={bulkExport}
      />
    </div>
  )
}


