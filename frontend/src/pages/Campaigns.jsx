import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCampaigns, usePatchCampaign } from '../lib/useCampaigns';
import ServerDataTable from '../components/ServerDataTable';
import CampaignCreateDialog from '../components/campaigns/CampaignCreateDialog';
import { formatDateSafe } from '../lib/format';
import { useNavigate } from 'react-router-dom';

export default function Campaigns(){
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const perPage = 25;
  const { data, isLoading, isError } = useCampaigns({ page, perPage, q, status });
  const patch = usePatchCampaign();

  const columns = [
    { id: 'name', header: t('campaigns.columns.name'), accessorKey: 'name',
      cell: ({ row }) =>
        <button
          className="text-primary-600 hover:underline"
          onClick={() => navigate(`/campaigns/${row?.original?.id}`)}
        >
          {row?.original?.name || '—'}
        </button>
    },
    { id: 'status', header: t('campaigns.columns.status'),
      cell: ({ row }) => {
        const s = row?.original?.status || 'draft';
        const map = {
          draft:  t('campaigns.status.draft'),
          active: t('campaigns.status.active'),
          paused: t('campaigns.status.paused'),
          completed: t('campaigns.status.completed')
        };
        const tone = s === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                   : s === 'paused' ? 'bg-amber-50 text-amber-700 ring-amber-200'
                   : s === 'completed' ? 'bg-gray-50 text-gray-700 ring-gray-200'
                   : 'bg-sky-50 text-sky-700 ring-sky-200';
        return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${tone}`}>{map[s]}</span>;
      }
    },
    { id: 'created_at', header: t('campaigns.columns.created_at'),
      cell: ({ row }) => <span className="tabular-nums">{formatDateSafe(row?.original?.created_at)}</span>
    },
    { id: 'actions', header: t('campaigns.columns.actions'),
      cell: ({ row }) => {
        const c = row?.original;
        const next = c?.status === 'active' ? 'paused'
                   : c?.status === 'paused' ? 'active'
                   : c?.status === 'draft' ? 'active'
                   : 'paused';
        const btnLabel = c?.status === 'active' ? t('campaigns.actions.pause')
                       : c?.status === 'paused' ? t('campaigns.actions.resume')
                       : c?.status === 'draft' ? t('campaigns.actions.activate')
                       : t('campaigns.actions.pause');
        return (
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
              onClick={() => patch.mutate({ id: c.id, patch: { status: next } })}
              aria-label={btnLabel}
            >
              {btnLabel}
            </button>
            <button
              className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
              onClick={() => navigate(`/campaigns/${c.id}`)}
            >
              {t('campaigns.actions.view')}
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="px-6 lg:px-8 py-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="w-64 rounded-lg border px-3 py-2 text-sm"
          placeholder={t('campaigns.toolbar.search_placeholder')}
          aria-label={t('campaigns.toolbar.search_aria')}
          value={q}
          onChange={(e)=>{ setPage(1); setQ(e.target.value) }}
        />
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={status}
          onChange={(e)=>{ setPage(1); setStatus(e.target.value) }}
        >
          <option value="">{t('campaigns.toolbar.status_any')}</option>
          <option value="draft">{t('campaigns.status.draft')}</option>
          <option value="active">{t('campaigns.status.active')}</option>
          <option value="paused">{t('campaigns.status.paused')}</option>
          <option value="completed">{t('campaigns.status.completed')}</option>
        </select>
        
        <div className="ml-auto flex items-center gap-2">
          <button
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            onClick={() => setOpenCreate(true)}
          >
            {t('campaigns.actions.create')}
          </button>
        </div>
      </div>

      <ServerDataTable
        columns={columns}
        rows={data?.results || []}
        total={data?.total || 0}
        page={data?.page || page}
        pageSize={data?.per_page || perPage}
        onPageChange={setPage}
        onPageSizeChange={() => {}} // Non implementato per ora
        isLoading={isLoading}
        isError={isError}
        onRetry={() => {}} // Non implementato per ora
        // i18n props
        errorTitle={t('campaigns.error.title')}
        errorDescription={t('campaigns.error.description')}
        retryLabel={t('common.retry')}
        emptyTitle={t('campaigns.empty.title')}
        emptyDescription={t('campaigns.empty.description')}
        emptyCtaImport={t('campaigns.empty.cta_import')}
        emptyCtaAdd={t('campaigns.empty.cta_add')}
        loadingLabel={t('common.loading')}
        sortAscLabel={t('common.sort_asc')}
        sortDescLabel={t('common.sort_desc')}
        selectAllLabel={t('common.select_all')}
      />
      
      <CampaignCreateDialog 
        open={openCreate} 
        onClose={() => setOpenCreate(false)} 
      />
    </div>
  );
}