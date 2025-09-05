import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import ConfirmDialog from './ConfirmDialog';
import FilterBuilder from './filters/FilterBuilder';

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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [local, setLocal] = useState(value);
  const [openAssign, setOpenAssign] = useState(false);
  const [openBulkDel, setOpenBulkDel] = useState(false);
  const [agentId, setAgentId] = useState('');

  const bulkAssign = useMutation({
    mutationFn: () => api.post('/leads/bulk-update', { ids: Object.keys(selection), owner_id: agentId }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey:['leads'] }); 
      // TODO: Add toast when available
      setOpenAssign(false);
    }
  });
  
  const bulkDelete = useMutation({
    mutationFn: () => api.post('/leads/bulk-delete', { ids: Object.keys(selection) }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey:['leads'] }); 
      // TODO: Add toast when available
      setOpenBulkDel(false);
    }
  });

  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const id = setTimeout(() => onSearch?.(local), 400);
    return () => clearTimeout(id);
  }, [local]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        data-testid="leads-search"
        type="search"
        className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        placeholder={t('leads.toolbar.search_placeholder')}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        aria-label={t('leads.toolbar.search_aria')}
      />

      {/* Advanced Filters */}
      <div className="w-full">
        <FilterBuilder 
          schema={[
            { id: 'compliance_category', label: t('leads.filters.category') },
            { id: 'contact_class', label: t('leads.filters.class') },
            { id: 'status', label: t('leads.filters.status') },
            { id: 'stage', label: t('leads.filters.stage') },
            { id: 'country_iso', label: t('leads.filters.country') },
            { id: 'created_at', label: t('leads.filters.added') },
            { id: 'updated_at', label: t('leads.filters.updated') },
          ]}
          value={filters.segment}
          onChange={(segment) => onFiltersChange({ ...filters, segment })}
          i18n={{
            empty: t('leads.filters.empty'),
            select_field: t('leads.filters.select_field'),
            value_placeholder: t('leads.filters.value_placeholder'),
            add: t('leads.filters.add'),
            save_segment: t('leads.filters.save_segment'),
            load_segment: t('leads.filters.load_segment'),
            clear: t('common.clear'),
            apply: t('common.apply'),
            multiselect_hint: t('leads.filters.multiselect_hint'),
            op: {
              is: t('filters.ops.is'),
              is_not: t('filters.ops.is_not'),
              in: t('filters.ops.in'),
              not_in: t('filters.ops.not_in'),
              before: t('filters.ops.before'),
              after: t('filters.ops.after'),
              between: t('filters.ops.between'),
            }
          }}
          onClear={() => onFiltersChange({ ...filters, segment: { all: [] } })}
          onApply={() => onFiltersChange(filters)}
        />
      </div>

      <div className="ms-auto flex items-center gap-2">
        <button
          data-testid="add-lead"
          onClick={() => navigate('/leads/new')}
          className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          {t('leads.actions.add')}
        </button>
        <button
          data-testid="bulk-assign"
          disabled={!selectionCount}
          onClick={() => setOpenAssign(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <span className="material-icons text-base">person_add</span>
          {t('leads.toolbar.bulk.assign')}
        </button>
        <button
          data-testid="bulk-delete"
          disabled={!selectionCount}
          onClick={() => setOpenBulkDel(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-red-50 text-red-700 font-medium rounded-lg border border-red-300 hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          <span className="material-icons text-base">delete</span>
          {t('leads.toolbar.bulk.delete')}
        </button>
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <span className="material-icons text-base">download</span>
          {t('leads.toolbar.bulk.export')}
        </button>
      </div>
      
      <ConfirmDialog
        open={openAssign}
        title={t('leads.dialogs.assign.title')}
        confirmLabel={t('leads.dialogs.assign.confirm')}
        cancelLabel={t('leads.dialogs.assign.cancel')}
        onConfirm={() => bulkAssign.mutate()}
        onClose={() => setOpenAssign(false)}
      >
        <label className="block text-sm mb-1">{t('leads.dialogs.assign.agent')}</label>
        <select className="w-full rounded border px-2 py-1" value={agentId} onChange={e=>setAgentId(e.target.value)}>
          <option value="">{t('common.select')}</option>
          {/* TODO: popolare da /agents */}
          <option value="u_1">Giulia</option>
          <option value="u_2">Marco</option>
        </select>
      </ConfirmDialog>

      <ConfirmDialog
        open={openBulkDel}
        title={t('leads.dialogs.delete.title')}
        body={t('leads.dialogs.delete.body')}
        confirmLabel={t('leads.dialogs.delete.confirm')}
        cancelLabel={t('leads.dialogs.delete.cancel')}
        onConfirm={() => bulkDelete.mutate()}
        onClose={() => setOpenBulkDel(false)}
      />
    </div>
  );
}
