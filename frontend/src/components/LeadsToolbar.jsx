import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import ConfirmDialog from './ConfirmDialog';

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
        className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={t('leads.toolbar.search_placeholder')}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        aria-label={t('leads.toolbar.search_aria')}
      />

      {/* Filters */}
      <select
        aria-label={t('leads.filters.status.any')}
        className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        value={filters.status || ''}
        onChange={(e) => onFiltersChange({ ...filters, status: e.target.value || '' })}
      >
        <option value="">{t('leads.filters.status.any')}</option>
        <option value="new">{t('leads.filters.status.new')}</option>
        <option value="contacted">{t('leads.filters.status.contacted')}</option>
        <option value="qualified">{t('leads.filters.status.qualified')}</option>
        <option value="lost">{t('leads.filters.status.lost')}</option>
      </select>

      <select
        aria-label={t('leads.filters.stage.any')}
        className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        value={filters.stage || ''}
        onChange={(e) => onFiltersChange({ ...filters, stage: e.target.value || '' })}
      >
        <option value="">{t('leads.filters.stage.any')}</option>
        <option value="cold">{t('leads.filters.stage.cold')}</option>
        <option value="warm">{t('leads.filters.stage.warm')}</option>
        <option value="hot">{t('leads.filters.stage.hot')}</option>
      </select>

      <select
        aria-label={t('leads.filters.class.any')}
        className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        value={filters.contact_class || ''}
        onChange={(e) => onFiltersChange({ ...filters, contact_class: e.target.value || '' })}
      >
        <option value="">{t('leads.filters.class.any')}</option>
        <option value="b2b">{t('leads.filters.class.b2b')}</option>
        <option value="b2c">{t('leads.filters.class.b2c')}</option>
        <option value="unknown">{t('leads.filters.class.unknown')}</option>
      </select>

      <select
        aria-label={t('leads.filters.category.any')}
        className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        value={filters.compliance_category || ''}
        onChange={(e) => onFiltersChange({ ...filters, compliance_category: e.target.value || '' })}
      >
        <option value="">{t('leads.filters.category.any')}</option>
        <option value="allowed">{t('leads.filters.category.allowed')}</option>
        <option value="conditional">{t('leads.filters.category.conditional')}</option>
        <option value="blocked">{t('leads.filters.category.blocked')}</option>
      </select>

      <div className="ms-auto flex items-center gap-2">
        <button
          data-testid="bulk-assign"
          disabled={!selectionCount}
          onClick={() => setOpenAssign(true)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
        >
          {t('leads.toolbar.bulk.assign')}
        </button>
        <button
          data-testid="bulk-delete"
          disabled={!selectionCount}
          onClick={() => setOpenBulkDel(true)}
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
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
