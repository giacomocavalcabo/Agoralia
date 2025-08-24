import React from 'react';
import AppShell from '../components/AppShell';
import { PageHeader } from '../components/ui/FormPrimitives';
import ServerDataTable from '../components/ServerDataTable';
import { useTranslation } from 'react-i18next';
import { useCampaigns } from '../lib/useCampaigns';
import { formatDateSafe, formatNumberSafe } from '../lib/format';

export default function Campaigns() {
  const { t } = useTranslation('pages');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState('created_at');
  const [dir, setDir] = React.useState('desc');

  const { rows, total, isLoading, isError, refetch } =
    useCampaigns({ page, pageSize, q, sort, dir });

  const columns = React.useMemo(() => ([
    { 
      id: 'name', 
      header: t('campaigns.table.columns.name'), 
      cell: (r) => r.name || '-'
    },
    { 
      id: 'status', 
      header: t('campaigns.table.columns.status'), 
      cell: (r) => t(`campaigns.status.${r.status || 'draft'}`)
    },
    { 
      id: 'pacing', 
      header: t('campaigns.table.columns.pacing'), 
      cell: (r) => formatNumberSafe(r.pacing) || '-'
    },
    { 
      id: 'budget', 
      header: t('campaigns.table.columns.budget'), 
      cell: (r) => formatNumberSafe(r.budget) || '-'
    },
    { 
      id: 'created_at', 
      header: t('campaigns.table.columns.created_at'), 
      cell: (r) => formatDateSafe(r.created_at) || '-'
    }
  ]), [t]);

  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <PageHeader
          title={t('campaigns.title')}
          description={t('campaigns.description')}
        />
        <ServerDataTable
          columns={columns}
          rows={rows}
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
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
        />
      </div>
    </AppShell>
  );
}