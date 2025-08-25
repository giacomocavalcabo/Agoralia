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
  const { t } = useTranslation('pages')

  const columns = useMemo(() => [
    {
      id: 'e164',
      header: t('numbers.columns.number'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.e164 || '—'}</span>
          <button
            className="text-xs underline text-blue-600 hover:text-blue-800"
            aria-label={t('numbers.toast.copied')}
            onClick={() => {
              navigator.clipboard.writeText(row.original.e164)
                .then(() => {
                  // Toast will be handled by parent component
                  if (window.toast) {
                    window.toast.success(t('numbers.toast.copied'))
                  }
                })
                .catch(() => {})
            }}
          >
            copy
          </button>
        </div>
      )
    },
    {
      id: 'country',
      header: t('numbers.columns.country'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{row.original.country_iso || '—'}</span>
        </div>
      )
    },
    {
      id: 'provider',
      header: t('numbers.columns.provider'),
      accessorKey: 'provider'
    },
    {
      id: 'capabilities',
      header: t('numbers.columns.capabilities'),
      cell: ({ row }) => (row.original.capabilities || []).join(', ') || '—'
    },
    {
      id: 'created_at',
      header: t('numbers.columns.created'),
      cell: ({ row }) => formatDateSafe(row.original.created_at) || '—'
    },
    {
      id: 'actions',
      header: t('numbers.columns.actions'),
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
  ], [t, onAssign, onRelease, onConfigure, onDetails])

  return (
    <ServerDataTable
      rows={data}
      total={total}
      columns={columns}
      isLoading={loading}
      isError={error}
      page={page}
      pageSize={onPageSizeChange}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      sort={sorting?.column}
      dir={sorting?.dir}
      onSort={onSortingChange}
      onRetry={() => window.location.reload()}
      // i18n props
      errorTitle={t('numbers.error.title')}
      errorDescription={t('numbers.error.description')}
      retryLabel={t('common.retry')}
      emptyTitle={t('numbers.empty.title')}
      emptyDescription={t('numbers.empty.description')}
      emptyCtaImport={t('common.import')}
      emptyCtaAdd={t('common.add')}
      loadingLabel={t('common.loading')}
      sortAscLabel={t('common.sort')}
      sortDescLabel={t('common.sort')}
      selectAllLabel={t('common.select')}
    />
  )
}
