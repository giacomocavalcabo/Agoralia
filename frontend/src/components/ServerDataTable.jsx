import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ServerDataTable({
  columns,
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sort,
  dir,
  onSort,
  selection,
  onToggleRow,
  onToggleAll,
  isLoading,
  isError,
  onRetry,
}) {
  const { t } = useTranslation('pages');
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm">
        <div className="font-semibold">{t('leads.error.title')}</div>
        <div className="mt-1 text-gray-700">{t('leads.error.description')}</div>
        <button onClick={onRetry} className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-white">
          {t('leads.error.retry')}
        </button>
      </div>
    );
  }

  if (!isLoading && total === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <div className="text-lg font-semibold">{t('leads.empty.title')}</div>
        <p className="mt-1 text-gray-600">{t('leads.empty.description')}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button className="rounded-lg border px-3 py-2 text-sm">{t('leads.empty.cta_import')}</button>
          <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">{t('leads.empty.cta_add')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white" data-testid="leads-table">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  aria-label="select all"
                  type="checkbox"
                  onChange={(e) => onToggleAll?.(e.target.checked)}
                />
              </th>
              {columns.map((col) => (
                <th key={col.id} className="px-3 py-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => onSort?.(col.id)}
                    aria-label={dir === 'asc' ? t('leads.table.sorting.asc') : t('leads.table.sorting.desc')}
                  >
                    {col.header}
                    {sort === col.id ? <span>{dir === 'asc' ? '↑' : '↓'}</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={columns.length + 1} className="px-3 py-6 text-center text-gray-500">Loading…</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} data-testid="leads-row" className="border-t">
                  <td className="px-3 py-2">
                    <input
                      data-testid="select-checkbox"
                      type="checkbox"
                      checked={!!selection[row.id]}
                      onChange={(e) => onToggleRow?.(row.id, e.target.checked)}
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col.id} className="px-3 py-2">
                      {col.cell ? col.cell(row) : row[col.id]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between border-t bg-gray-50 px-3 py-2 text-sm">
        <div>
          {t('leads.table.pagination.showing', { from, to, total })}
        </div>
        <div className="flex items-center gap-2">
          <select
            data-testid="page-size"
            className="rounded-lg border border-gray-300 bg-white px-2 py-1"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{t('leads.table.pagination.page_size')} {n}</option>)}
          </select>
          <button disabled={page <= 1} onClick={() => onPageChange?.(page - 1)} className="rounded border px-2 py-1 disabled:opacity-50">Prev</button>
          <span>{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => onPageChange?.(page + 1)} className="rounded border px-2 py-1 disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
