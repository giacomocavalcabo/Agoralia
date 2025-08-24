import { useMemo } from 'react'
import { useI18n } from '../../lib/i18n.jsx'
import { formatDateSafe } from '../../lib/format'
import NumbersRowActions from './NumbersRowActions.jsx'
import ServerDataTable from '../ServerDataTable.jsx'

export default function NumbersTable({
  data, total, loading, error,
  page, pageSize, onPageChange, onPageSizeChange,
  sorting, onSortingChange,
  onAssign, onRelease, onConfigure, onDetails
}) {
  const { i18n, t } = useI18n('pages')

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
      rows={data}
      total={total}
      columns={columns}
      isLoading={loading}
      isError={error}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      sort={sorting?.sortBy}
      dir={sorting?.sortDir}
      onSort={onSortingChange}
      onRetry={() => window.location.reload()}
      // i18n props
      errorTitle={t('numbers.table.error.title')}
      errorDescription={t('numbers.table.error.description')}
      retryLabel={t('numbers.table.error.retry')}
      emptyTitle={t('numbers.table.empty.title')}
      emptyDescription={t('numbers.table.empty.description')}
      emptyCtaImport={t('numbers.table.empty.cta_import')}
      emptyCtaAdd={t('numbers.table.empty.cta_new')}
      loadingLabel={t('numbers.table.loading')}
      sortAscLabel={t('numbers.table.sorting.asc')}
      sortDescLabel={t('numbers.table.sorting.desc')}
      selectAllLabel={t('numbers.table.select_all')}
    />
  )
}
