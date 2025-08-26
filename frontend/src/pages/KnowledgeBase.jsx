import { PlusIcon, DocumentTextIcon, CogIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import Card from '../components/ui/Card'
import { Button } from '../components/ui/button'
import { useKbList } from '../lib/kbApi'
import { CompletenessMeter } from '../components/kb/CompletenessMeter'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../lib/i18n.jsx'
import { useAuth } from '../lib/useAuth'
import { useIsDemo } from '../lib/useDemoData'
import { makeDemoKnowledgeBase } from '../lib/demo/fakes'
import KBToolbar from '../components/kb/KBToolbar'

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n('pages');
  const { user } = useAuth();
  const isDemo = useIsDemo();
  
  // Read initial filters from URL for deep-linking
  const q = searchParams.get('q') || '';
  const kind = searchParams.get('kind') || undefined;
  const status = searchParams.get('status') || undefined;
  
  // Check if KB should be enabled
  const enabled = user?.id && !isDemo;
  
  // Fetch KB overview data only if enabled
  const { data: kbData, isLoading, isError } = useQuery({
    queryKey: ['kb-overview'],
    queryFn: () => api.get('/kb/progress'),
    staleTime: 30000,
    enabled: enabled
  })
  
  // Fetch KB list using new hook only if enabled
  const { data: kbList } = useKbList({ enabled, q, kind, status });
  const items = kbList?.items ?? [];
  
  // Handle filter changes from toolbar
  const handleFiltersChange = (newFilters) => {
    // The toolbar now handles URL updates directly
    // We just need to trigger a refetch if needed
    if (newFilters.q !== q || newFilters.status !== status) {
      // The useKbList hook will automatically refetch with new params
    }
  };
  
  const company = items.find(i => i.kind === 'company');
  const offers = items.filter(i => i.kind === 'offer_pack');

  const handleCreateCompany = () => {
    // TODO: Implement create company KB
    if (import.meta.env.DEV) {
      console.log('Create company KB');
    }
  };

  const handleCreateOfferPack = () => {
    navigate('/knowledge/offers?new=true');
  };

  const handleImport = () => {
    navigate('/knowledge/imports');
  };

  const handleAssignments = () => {
    navigate('/knowledge/assignments');
  };

  // Handle different states
  if (!user?.id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t('kb.auth.title')}</h1>
        </div>
        <Card>
          <div className="text-center py-8">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('kb.auth.title')}</h3>
            <p className="text-gray-600">{t('kb.auth.description')}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (isDemo) {
    const demo = makeDemoKnowledgeBase();
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Knowledge</h1>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
              {t('kb.demo')}
            </span>
            <Button onClick={handleImport} variant="outline">
              <CogIcon className="h-4 w-4 mr-2" />
              {t('kb.overview.actions.import_documents')}
            </Button>
            <Button onClick={handleCreateOfferPack} variant="secondary">
              <PlusIcon className="h-4 w-4 mr-2" />
              {t('kb.overview.actions.add_source')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title={
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5" />
              {t('kb.overview.kpi.company.title')}
            </div>
          }>
            <CompletenessMeter 
              completeness={demo.company.completeness_pct}
              freshness={demo.company.freshness_score}
              lastUpdated={demo.company.updated_at}
              showDetails={false}
            />
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline">
                {t('kb.overview.actions.open')}
              </Button>
            </div>
          </Card>

          <Card title={
            <div className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5" />
              {t('kb.overview.kpi.offer_packs.title')}
            </div>
          }>
            <CompletenessMeter 
              completeness={demo.offers[0].completeness_pct}
              freshness={demo.offers[0].freshness_score}
              lastUpdated={demo.offers[0].updated_at}
              showDetails={false}
            />
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline">
                {t('kb.overview.actions.open')}
              </Button>
            </div>
          </Card>

          <Card title={
            <div className="flex items-center gap-2">
              <CogIcon className="h-5 w-5" />
              {t('kb.overview.kpi.documents.title')}
            </div>
          }>
            <div className="text-center py-4">
              <div className="text-2xl font-bold text-blue-600">{demo.progress}%</div>
              <div className="text-sm text-gray-600">{t('kb.overview.kpi.documents.complete')}</div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={handleImport} size="sm">
                {t('kb.overview.actions.import_documents')}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (isError) {
    // Se l'errore precedente era 422 (normalizzato in getKbProgress) torniamo data vuota
    if (!kbData || (Array.isArray(kbData?.items) && kbData.items.length === 0)) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{t('kb.overview.title')}</h1>
              <p className="text-gray-600 mt-1">{t('kb.overview.subtitle')}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleImport} variant="outline">
                <CogIcon className="h-4 w-4 mr-2" />
                {t('kb.overview.actions.import_documents')}
              </Button>
              <Button onClick={handleCreateOfferPack} variant="secondary">
                <PlusIcon className="h-4 w-4 mr-2" />
                {t('kb.overview.actions.add_source')}
              </Button>
            </div>
          </div>
          <Card>
            <div className="text-center py-8">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('kb.empty.no_data')}</h3>
              <p className="text-gray-600 mb-4">{t('kb.empty.how_to_start')}</p>
              <Button onClick={handleImport}>
                {t('kb.empty.import')}
              </Button>
            </div>
          </Card>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t('kb.overview.title')}</h1>
            <p className="text-gray-600 mt-1">{t('kb.overview.subtitle')}</p>
          </div>
        </div>
        <Card>
          <div className="text-center py-8">
            <DocumentTextIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('kb.error.title')}</h3>
            <p className="text-gray-600 mb-4">{t('kb.error.description')}</p>
            <Button onClick={() => window.location.reload()}>
              {t('kb.error.retry')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('kb.overview.title')}</h1>
          <p className="text-gray-600 mt-1">{t('kb.overview.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleImport} variant="outline">
            <CogIcon className="h-4 w-4 mr-2" />
            {t('kb.overview.actions.import_documents')}
          </Button>
          <Button onClick={handleCreateOfferPack} variant="secondary">
            <PlusIcon className="h-4 w-4 mr-2" />
            {t('kb.overview.actions.add_source')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title={
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5" />
            {t('kb.overview.kpi.company.title')}
          </div>
        }>
            {company ? (
              <>
                <CompletenessMeter 
                  completeness={company.completeness_pct || 0}
                  freshness={company.freshness_score || 0}
                  lastUpdated={company.updated_at}
                  showDetails={false}
                />
                <div className="mt-3 flex gap-2">
                  <Button 
                    onClick={() => navigate(`/knowledge/company/${company.id}`)}
                    size="sm"
                  >
                    {t('kb.overview.actions.open')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  {t('kb.overview.kpi.company.description')}
                </p>
                <Button onClick={handleCreateCompany} size="sm">
                  {t('kb.overview.kpi.company.create')}
                </Button>
              </>
            )}
        </Card>

        <Card title={
          <div className="flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5" />
            {t('kb.overview.kpi.offer_packs.title')}
          </div>
        }>
            <div className="text-3xl font-semibold">{offers.length}</div>
            <p className="text-sm text-gray-500 mb-3">
              {offers.length === 0 ? t('kb.overview.kpi.offer_packs.empty') : t('kb.overview.kpi.offer_packs.available')}
            </p>
            <Button onClick={handleCreateOfferPack} size="sm" variant="outline">
              {offers.length === 0 ? t('kb.overview.kpi.offer_packs.create_first') : t('kb.overview.kpi.offer_packs.manage')}
            </Button>
        </Card>

        <Card title={
          <div className="flex items-center gap-2">
            <CogIcon className="h-5 w-5" />
            {t('kb.overview.kpi.assignments.title')}
          </div>
        }>
            <p className="text-sm text-gray-500 mb-3">
              {t('kb.overview.kpi.assignments.description')}
            </p>
            <Button onClick={handleAssignments} size="sm" variant="outline">
              {t('kb.overview.actions.open')}
            </Button>
        </Card>
      </div>

      {items.length > 0 && (
        <Card title={t('kb.overview.table.title')}>
            {/* Toolbar con search e filtri */}
            <div className="mb-4">
              <KBToolbar 
                onChange={handleFiltersChange}
                initial={{ q, status }}
              />
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('kb.overview.table.columns.name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('kb.overview.table.columns.type')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('kb.overview.table.columns.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('kb.overview.table.columns.progress')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('kb.overview.table.columns.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((kb) => (
                    <tr key={kb.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{kb.name}</div>
                        <div className="text-sm text-gray-500">{kb.kind}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {kb.type || 'generic'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          kb.status === 'published' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {kb.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-32">
                          <CompletenessMeter 
                            completeness={kb.completeness_pct || 0}
                            freshness={kb.freshness_score || 0}
                            showDetails={false}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/knowledge/${kb.kind === 'company' ? 'company' : 'offers'}/${kb.id}`)}
                        >
                          {kb.kind === 'company' ? t('kb.overview.actions.open') : t('kb.overview.actions.edit')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </Card>
      )}
    </div>
  );
}
