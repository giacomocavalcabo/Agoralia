import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import FilterBuilder from './filters/FilterBuilder';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from './ToastProvider';

export default function NumbersToolbar({ 
  filters, 
  onFiltersChange, 
  onSearch, 
  selectionCount = 0,
  onExport 
}) {
  const { t } = useTranslation('pages');
  const { toast } = useToast();
  const [local, setLocal] = useState(filters?.q || '');
  const [openRelease, setOpenRelease] = useState(false);
  const [releaseId, setReleaseId] = useState(null);
  const qc = useQueryClient();

  // Schema per il FilterBuilder
  const schema = [
    { id: 'country_iso', label: t('numbers.filters.country') },
    { id: 'provider', label: t('numbers.filters.provider') },
    { id: 'capabilities', label: t('numbers.filters.capabilities') },
    { id: 'created_at', label: t('numbers.filters.created') },
    { id: 'status', label: t('numbers.filters.status') }
  ];

  // i18n per FilterBuilder
  const i18nFB = {
    empty: t('numbers.filters.empty'),
    select_field: t('numbers.filters.select_field'),
    value_placeholder: t('numbers.filters.value_placeholder'),
    add: t('numbers.filters.add'),
    save_segment: t('numbers.filters.save_segment'),
    load_segment: t('numbers.filters.load_segment'),
    clear: t('common.clear'),
    apply: t('common.apply'),
    multiselect_hint: t('numbers.filters.multiselect_hint'),
    op: {
      is: t('filters.ops.is'),
      is_not: t('filters.ops.is_not'),
      in: t('filters.ops.in'),
      not_in: t('filters.ops.not_in'),
      before: t('filters.ops.before'),
      after: t('filters.ops.after'),
      between: t('filters.ops.between'),
    }
  };

  // Bulk release mutation
  const bulkRelease = useMutation({
    mutationFn: async (ids) => {
      const promises = ids.map(id => api.delete(`/numbers/${id}`));
      return Promise.all(promises);
    },
    onSuccess: () => {
      qc.invalidateQueries(['numbers']);
      toast.success(t('numbers.dialogs.release.success'));
      setOpenRelease(false);
    },
    onError: () => {
      toast.error(t('numbers.dialogs.release.error'));
    }
  });

  // Handle search with debounce
  useEffect(() => setLocal(filters?.q || ''), [filters?.q]);
  useEffect(() => {
    const id = setTimeout(() => onSearch?.(local), 400);
    return () => clearTimeout(id);
  }, [local]);

  return (
    <div className="mb-4 space-y-3">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <input
          data-testid="numbers-search"
          type="search"
          className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('numbers.toolbar.search_placeholder')}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          aria-label={t('numbers.toolbar.search_placeholder')}
        />
        
        <button
          className="text-sm text-gray-600 hover:text-gray-800"
          onClick={() => onFiltersChange({ ...filters, showFilters: !filters?.showFilters })}
        >
          {filters?.showFilters ? '🔽' : '🔽'} {t('numbers.toolbar.open_filters')}
        </button>
      </div>

      {/* Advanced Filters */}
      {filters?.showFilters && (
        <div className="w-full">
          <FilterBuilder 
            schema={schema}
            value={filters.segment}
            onChange={(segment) => onFiltersChange({ ...filters, segment })}
            i18n={i18nFB}
            onClear={() => onFiltersChange({ ...filters, segment: { all: [] } })}
            onApply={() => onFiltersChange(filters)}
          />
        </div>
      )}

      {/* Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {selectionCount > 0 && `${selectionCount} selected`}
        </div>
        
        <div className="flex gap-2">
          <button
            data-testid="bulk-assign"
            disabled={!selectionCount}
            onClick={() => {/* TODO: Implement bulk assign */}}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            {t('numbers.toolbar.bulk.assign')}
          </button>
          
          <button
            data-testid="bulk-release"
            disabled={!selectionCount}
            onClick={() => setOpenRelease(true)}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {t('numbers.toolbar.bulk.release')}
          </button>
          
          <button
            onClick={onExport}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            {t('numbers.toolbar.bulk.export')}
          </button>
        </div>
      </div>

      {/* Release confirmation dialog */}
      <ConfirmDialog
        open={openRelease}
        title={t('numbers.dialogs.release.title')}
        body={t('numbers.dialogs.release.body')}
        confirmLabel={t('numbers.dialogs.release.confirm')}
        cancelLabel={t('numbers.dialogs.release.cancel')}
        onConfirm={() => {
          // TODO: Get selected IDs from parent
          bulkRelease.mutate(['demo_1', 'demo_2']);
        }}
        onClose={() => setOpenRelease(false)}
      />
    </div>
  );
}
