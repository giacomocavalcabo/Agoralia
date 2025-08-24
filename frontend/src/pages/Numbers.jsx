import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/FormPrimitives.jsx'
import NumbersToolbar from '../components/numbers/NumbersToolbar.jsx'
import NumbersTable from '../components/numbers/NumbersTable.jsx'
import { useNumbers } from '../lib/useNumbers'
import { useIsDemo } from '../lib/useDemoData'
import { useToast } from '../components/ToastProvider.jsx'

export default function Numbers() {
  const { t } = useTranslation('pages')
  const isDemo = useIsDemo()
  const { toast } = useToast?.() ?? { toast: () => {} }

  const [state, setState] = useState({
    page: 1,
    pageSize: 25,
    q: '',
    sortBy: 'e164',
    sortDir: 'asc',
    filters: {}
  })

  const { data, total, loading, error, refetch } = useNumbers(state)

  const onToolbarChange = (v) => setState(s => ({ ...s, ...v, page: 1 }))
  const onPageChange = (p) => setState(s => ({ ...s, page: p }))
  const onPageSizeChange = (ps) => setState(s => ({ ...s, pageSize: ps, page: 1 }))
  const onSortingChange = (col, dir) => setState(s => ({ ...s, sortBy: col, sortDir: dir }))

  const bulkAssign = () => {
    if (isDemo) {
      if (import.meta.env.DEV) console.debug('[numbers] demo bulk assign')
      toast?.success?.('Assignment simulated')
      return
    }
    // TODO: implement real bulk assign
  }
  const bulkRelease = () => {
    if (isDemo) {
      if (import.meta.env.DEV) console.debug('[numbers] demo bulk release')
      toast?.success?.('Release simulated')
      return
    }
  }
  const bulkExport = () => {
    // always safe to export dummy CSV client-side
    const header = ['number','country','status','carrier']
    const rows = data.map(x => [x.e164, x.country, x.status, x.carrier].join(','))
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'numbers.csv'; a.click()
  }

  const rowAssign = (row) => bulkAssign()
  const rowRelease = (row) => bulkRelease()
  const rowConfigure = (row) => {/* open modal in future */}
  const rowDetails = (row) => {/* open drawer in future */}

  return (
    <div className="px-6 lg:px-8 py-6">
      <PageHeader
        title={t('numbers.title')}
        description={t('numbers.description')}
      />

      <NumbersToolbar
        value={state}
        onChange={onToolbarChange}
        data={data}
        onBulkAssign={bulkAssign}
        onBulkRelease={bulkRelease}
        onExport={bulkExport}
      />

      <NumbersTable
        data={data}
        total={total}
        loading={loading}
        error={error}
        page={state.page}
        pageSize={state.pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        sorting={{ column: state.sortBy, dir: state.sortDir }}
        onSortingChange={onSortingChange}
        onAssign={rowAssign}
        onRelease={rowRelease}
        onConfigure={rowConfigure}
        onDetails={rowDetails}
      />
    </div>
  )
}


