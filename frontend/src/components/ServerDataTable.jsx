import React from 'react';

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
  // i18n props for labels
  errorTitle = 'Error loading data',
  errorDescription = 'An error occurred while loading the data. Please try again.',
  retryLabel = 'Retry',
  emptyTitle = 'No data available',
  emptyDescription = 'There are no items to display.',
  emptyCtaImport = 'Import',
  emptyCtaAdd = 'Add New',
  loadingLabel = 'Loading...',
  sortAscLabel = 'Sort ascending',
  sortDescLabel = 'Sort descending',
  selectAllLabel = 'Select all'
}) {
  // Safety checks - prevent crash on undefined data
  const safeData = (Array.isArray(rows) ? rows : []).filter(Boolean);
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeTotal = typeof total === 'number' ? total : 0;
  const safePage = typeof page === 'number' ? page : 1;
  const safePageSize = typeof pageSize === 'number' ? pageSize : 25;
  
  const from = (safePage - 1) * safePageSize + 1;
  const to = Math.min(safePage * safePageSize, safeTotal);
  const pages = Math.max(1, Math.ceil(safeTotal / safePageSize));

  // Safe cell value extractor
  const getCellValue = (row, col) => {
    if (typeof col.cell === 'function') return col.cell(row);
    if (col.accessorKey && row?.[col.accessorKey] !== undefined) return row[col.accessorKey];
    if (col.accessor && typeof col.accessor === 'function') return col.accessor(row);
    return undefined;
  };

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm">
        <div className="font-semibold">{errorTitle}</div>
        <div className="mt-1 text-gray-700">{errorDescription}</div>
        <button onClick={onRetry} className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-white">
          {retryLabel}
        </button>
      </div>
    );
  }

  if (!isLoading && safeTotal === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <div className="font-semibold">{emptyTitle}</div>
        <p className="mt-1 text-gray-600">{emptyDescription}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button className="rounded-lg border px-3 py-2 text-sm">{emptyCtaImport}</button>
          <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">{emptyCtaAdd}</button>
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
                  aria-label={selectAllLabel}
                  type="checkbox"
                  onChange={(e) => onToggleAll?.(e.target.checked)}
                />
              </th>
              {safeColumns.map((col) => (
                <th key={col.id} className="px-3 py-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => onSort?.(col.id)}
                    aria-label={dir === 'asc' ? sortAscLabel : sortDescLabel}
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
              <tr><td colSpan={safeColumns.length + 1} className="px-3 py-6 text-center text-gray-500">{loadingLabel}</td></tr>
            ) : (
              safeData.map((row, rIdx) => (
                <tr key={row?.id ?? rIdx} data-testid="leads-row" className="border-t">
                  <td className="px-3 py-2">
                    <input
                      data-testid="select-checkbox"
                      type="checkbox"
                      checked={!!selection[row?.id]}
                      onChange={(e) => onToggleRow?.(row?.id, e.target.checked)}
                    />
                  </td>
                  {safeColumns.map((col, cIdx) => (
                    <td key={cIdx} className="px-3 py-2">
                      {row ? (getCellValue(row, col) ?? '-') : '-'}
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
          Showing {from} to {to} of {safeTotal} results
        </div>
        <div className="flex items-center gap-2">
          <select
            data-testid="page-size"
            className="rounded-lg border border-gray-300 bg-white px-2 py-1"
            value={String(safePageSize)}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>Show {n}</option>)}
          </select>
          <button disabled={safePage <= 1} onClick={() => onPageChange?.(safePage - 1)} className="rounded border px-2 py-1 disabled:opacity-50">Prev</button>
          <span>{safePage} / {pages}</span>
          <button disabled={safePage >= pages} onClick={() => onPageChange?.(safePage + 1)} className="rounded border px-2 py-1 disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
