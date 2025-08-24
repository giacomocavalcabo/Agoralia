import React from 'react';
// ⚠️ Non usare AppShell/GlobalSearch qui: già provvede il layout.
import { PageHeader } from '../components/ui/FormPrimitives';
import ServerDataTable from '../components/ServerDataTable';
import { useI18n } from '../lib/i18n.jsx';
import { useCampaigns } from '../lib/useCampaigns';
import { formatDateSafe, formatNumberSafe } from '../lib/format';

export default function Campaigns() {
  const { t } = useI18n('pages');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState('created_at');
  const [dir, setDir] = React.useState('desc');

  const { data, total, loading, error, refetch } =
    useCampaigns({ page, pageSize, q, sortBy: sort, sortDir: dir });

  const columns = React.useMemo(() => ([
    { 
      id: 'name', 
      header: t('campaigns.table.columns.name'), 
      accessorKey: 'name'
    },
    { 
      id: 'status', 
      header: t('campaigns.table.columns.status'), 
      accessorKey: 'status',
      cell: (r) => t(`campaigns.status.${r.status || 'draft'}`)
    },
    { 
      id: 'pacing', 
      header: t('campaigns.table.columns.pacing'), 
      accessorKey: 'pacing',
      cell: (r) => formatNumberSafe(r.pacing) || '-'
    },
    { 
      id: 'budget', 
      header: t('campaigns.table.columns.budget'), 
      accessorKey: 'budget',
      cell: (r) => formatNumberSafe(r.budget) || '-'
    },
    { 
      id: 'created_at', 
      header: t('campaigns.table.columns.created_at'), 
      accessorKey: 'created_at',
      cell: (r) => formatDateSafe(r.created_at) || '-'
    }
  ]), [t]);

  return (
    <div className="px-6 lg:px-8 py-6">
      <PageHeader
        title={t('campaigns.title')}
        description={t('campaigns.description')}
      />
      <ServerDataTable
        columns={columns}
        rows={data}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sort={sort}
        dir={dir}
        onSort={(column) => {
          if (sort !== column) {
            setSort(column);
            setDir('asc');
            } else {
            setDir(dir === 'asc' ? 'desc' : 'asc');
          }
        }}
        isLoading={loading}
        isError={error}
        onRetry={refetch}
        // i18n props
        errorTitle={t('campaigns.table.error.title')}
        errorDescription={t('campaigns.table.error.description')}
        retryLabel={t('campaigns.table.error.retry')}
        emptyTitle={t('campaigns.table.empty.title')}
        emptyDescription={t('campaigns.table.empty.description')}
        emptyCtaImport={t('campaigns.table.empty.cta_import')}
        emptyCtaAdd={t('campaigns.table.empty.cta_new')}
        loadingLabel={t('campaigns.table.loading')}
        sortAscLabel={t('campaigns.table.sorting.asc')}
        sortDescLabel={t('campaigns.table.sorting.desc')}
        selectAllLabel={t('campaigns.table.select_all')}
      />
    </div>
  );
}