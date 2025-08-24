import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateSafe } from '../../lib/format'
import NumbersRowActions from './NumbersRowActions.jsx'
import ServerDataTable from '../ServerDataTable.jsx'

export default function NumbersTable({
  data, total, loading, error,
  page, pageSize, onPageChange, onPageSizeChange,
  sorting, onSortingChange,
  onAssign, onRelease, onConfigure, onDetails
}) {
  const { i18n, t } = useTranslation('pages')

  const columns = useMemo(() => [
    {
      id: 'e164',
      header: t('numbers.table.columns.number'),
      accessorKey: 'e164',
      meta: { testid: 'header-number' }
    },
    {
      id: 'country',
      header: t('numbers.table.columns.country'),
      accessorKey: 'country'
    },
    {
      id: 'capabilities',
      header: t('numbers.table.columns.capabilities'),
      cell: ({ row }) => (row.original.capabilities || []).join(', ')
    },
    {
      id: 'status',
      header: t('numbers.table.columns.status'),
      accessorKey: 'status'
    },
    {
      id: 'assigned_to',
      header: t('numbers.table.columns.assigned_to'),
      accessorKey: 'assigned_to'
    },
    {
      id: 'purchased_at',
      header: t('numbers.table.columns.purchased_at'),
      cell: ({ row }) => formatDateSafe(row.original.purchased_at, i18n.language)
    },
    {
      id: 'carrier',
      header: t('numbers.table.columns.carrier'),
      accessorKey: 'carrier'
    },
    {
      id: 'actions',
      header: t('numbers.table.columns.actions'),
      cell: ({ row }) => (
        <NumbersRowActions
          row={row.original}
          onAssign={onAssign}
          onRelease={onRelease}
          onConfigure={onConfigure}
          onDetails={onDetails}
        />
      )
    }
  ], [i18n.language, t, onAssign, onRelease, onConfigure, onDetails])

  return (
    <ServerDataTable
      data={data}
      total={total}
      columns={columns}
      loading={loading}
      error={error}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      testidPrefix="numbers"
      emptyTitle={t('numbers.table.empty.title')}
      emptyDescription={t('numbers.table.empty.description')}
      emptyCta={t('numbers.table.empty.cta_new')}
      errorTitle={t('numbers.table.error.title')}
      errorDescription={t('numbers.table.error.description')}
      errorRetryLabel={t('numbers.table.error.retry')}
    />
  )
}
