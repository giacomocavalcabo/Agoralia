import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/ui/FormPrimitives.jsx';
import LeadsToolbar from '../components/LeadsToolbar.jsx';
import ServerDataTable from '../components/ServerDataTable.jsx';
import LeadsRowActions from '../components/LeadsRowActions.jsx';
import LeadDetailsDrawer from '../components/LeadDetailsDrawer.jsx';
import ComplianceChip from '../components/ui/ComplianceChip.jsx';
import CountryFlag from '../components/ui/CountryFlag.jsx';
import { useLeads } from '../lib/useLeads.js';
import { formatDateSafe } from '../lib/format.js';

export default function Leads() {
  const { t, i18n } = useTranslation('pages');
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  
  const {
    rows, total,
    page, setPage,
    pageSize, setPageSize,
    sort, dir, sortBy,
    search, setSearch,
    filters, setFilters,
    isLoading, isError,
    resetPage,
  } = useLeads({ page: 1 });

  const [selection, setSelection] = useState({});
  function toggleRow(id, checked) {
    setSelection(s => ({ ...s, [id]: checked }));
  }
  function toggleAll(checked) {
    if (!checked) return setSelection({});
    const map = {};
    rows.forEach(r => { map[r.id] = true; });
    setSelection(map);
  }

  function onBulkDelete() {
    if (!Object.keys(selection).length) return;
    // TODO: Implementare ConfirmDialog per bulk delete
    alert(t('leads.dialogs.delete.success'));
    setSelection({});
  }
  function onBulkAssign() {
    if (!Object.keys(selection).length) return;
    alert(t('leads.dialogs.assign.success'));
    setSelection({});
  }
  function onExport() {
    alert(t('leads.export.starting'));
  }

  const columns = useMemo(() => ([
    { id: 'name', header: t('leads.columns.name'), accessorKey: 'name' },
    { 
      id: 'phone_e164', 
      header: t('leads.columns.phone'), 
      accessorKey: 'phone_e164',
      cell: (r) => <span className="font-mono tabular-nums">{r.phone_e164 || '—'}</span>
    },
    {
      id: 'country',
      header: t('leads.columns.country'),
      cell: (r) => <CountryFlag iso={r.country_iso} />
    },
    {
      id: 'compliance_category',
      header: t('leads.columns.category'),
      cell: ({ row }) => <ComplianceChip value={row.original?.compliance_category} />
    },
    { 
      id: 'status', 
      header: t('leads.columns.status'), 
      accessorKey: 'status',
      cell: ({ row }) => t(`leads.status.${row.original?.status || 'unknown'}`)
    },
    { 
      id: 'stage', 
      header: t('leads.columns.stage'), 
      accessorKey: 'stage',
      cell: ({ row }) => t(`leads.stage.${row.original?.stage || 'unknown'}`)
    },
    { id: 'owner', header: t('leads.columns.owner'), accessorKey: 'owner' },
    {
      id: 'updated_at',
      header: t('leads.columns.updated'),
      cell: ({ row }) => <span className="tabular-nums">{formatDateSafe(row.original?.updated_at, i18n.language)}</span>
    },
    { id: 'score', header: t('leads.columns.score'), accessorKey: 'score' },
    { id: 'actions', header: t('leads.columns.actions'),
      cell: (r) => <LeadsRowActions row={r} onView={(lead) => { setSelected(lead); setOpen(true); }} onAssign={() => {}} onDelete={() => { alert(t('leads.dialogs.delete.success')); }} /> },
  ]), [t, i18n.language]);

  return (
    <div className="px-6 lg:px-8 py-6">
      <PageHeader title={t('leads.title')} />

      <LeadsToolbar
        value={search}
        onSearch={(v) => { setSearch(v); resetPage(); }}
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); resetPage(); setSelection({}); }}
        selectionCount={Object.keys(selection).length}
        onBulkAssign={onBulkAssign}
        onBulkDelete={onBulkDelete}
        onExport={onExport}
      />

      <ServerDataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={(p) => { setPage(p); setSelection({}); }}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); setSelection({}); }}
        sort={sort}
        dir={dir}
        onSort={sortBy}
        selection={selection}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        isLoading={isLoading}
        isError={!!isError}
        onRetry={() => resetPage()}
      />
      
      <LeadDetailsDrawer
        open={open}
        onOpenChange={setOpen}
        lead={selected}
      />
    </div>
  );
}


