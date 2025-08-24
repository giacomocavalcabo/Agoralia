import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function LeadsToolbar({
  value = '',
  onSearch,
  filters,
  onFiltersChange,
  selectionCount = 0,
  onBulkAssign,
  onBulkDelete,
  onExport,
}) {
  const { t } = useTranslation('pages');
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const id = setTimeout(() => onSearch?.(local), 450);
    return () => clearTimeout(id);
  }, [local]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        data-testid="leads-search"
        type="search"
        className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={t('leads.toolbar.search_placeholder')}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />

      {/* Filters */}
      <select
        aria-label={t('leads.toolbar.filters.status')}
        className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        value={filters.status || ''}
        onChange={(e) => onFiltersChange({ ...filters, status: e.target.value || '' })}
      >
        <option value="">{t('leads.toolbar.filters.any')}</option>
        <option value="new">New</option>
        <option value="contacted">Contacted</option>
        <option value="qualified">Qualified</option>
        <option value="lost">Lost</option>
      </select>

      <select
        aria-label={t('leads.toolbar.filters.campaign')}
        className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        value={filters.campaign || ''}
        onChange={(e) => onFiltersChange({ ...filters, campaign: e.target.value || '' })}
      >
        <option value="">{t('leads.toolbar.filters.any')}</option>
        <option value="Summer">Summer</option>
        <option value="Launch">Launch</option>
        <option value="Retarget">Retarget</option>
      </select>

      <select
        aria-label={t('leads.toolbar.filters.owner')}
        className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        value={filters.owner || ''}
        onChange={(e) => onFiltersChange({ ...filters, owner: e.target.value || '' })}
      >
        <option value="">{t('leads.toolbar.filters.any')}</option>
        <option value="Giulia">Giulia</option>
        <option value="Marco">Marco</option>
      </select>

      <select
        aria-label={t('leads.toolbar.filters.stage')}
        className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        value={filters.stage || ''}
        onChange={(e) => onFiltersChange({ ...filters, stage: e.target.value || '' })}
      >
        <option value="">{t('leads.toolbar.filters.any')}</option>
        <option value="cold">Cold</option>
        <option value="warm">Warm</option>
        <option value="hot">Hot</option>
      </select>

      <div className="ms-auto flex items-center gap-2">
        <button
          data-testid="bulk-assign"
          disabled={!selectionCount}
          onClick={onBulkAssign}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
        >
          {t('leads.toolbar.bulk.assign')}
        </button>
        <button
          data-testid="bulk-delete"
          disabled={!selectionCount}
          onClick={onBulkDelete}
          className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {t('leads.toolbar.bulk.delete')}
        </button>
        <button
          onClick={onExport}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          {t('leads.toolbar.bulk.export')}
        </button>
      </div>
    </div>
  );
}
