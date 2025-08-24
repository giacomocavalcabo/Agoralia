import { PlusIcon, DocumentTextIcon, CogIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import Card from '../components/ui/Card'
import { Button } from '../components/ui/button'
import { useKbList } from '../lib/kbApi'
import { CompletenessMeter } from '../components/kb/CompletenessMeter'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n.jsx'
import { useAuth } from '../lib/useAuth'
import { useIsDemo } from '../lib/useDemoData'

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const { t } = useI18n('pages');
  const { user } = useAuth();
  const isDemo = useIsDemo();
  
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
  const { data: kbList } = useKbList({ enabled });
  const items = kbList?.items ?? [];
  
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
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Knowledge</h1>
        </div>
        <Card>
          <div className="text-center py-8">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Demo Mode</h3>
            <p className="text-gray-600">{t('kb.empty.workspace_blocked')}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Knowledge</h1>
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
        <h1 className="text-2xl font-semibold">Knowledge</h1>
        <div className="flex gap-2">
          <Button onClick={handleImport} variant="outline">
            <CogIcon className="h-4 w-4 mr-2" />
            Importa
          </Button>
          <Button onClick={handleCreateOfferPack} variant="secondary">
            <PlusIcon className="h-4 w-4 mr-2" />
            Nuovo Offer Pack
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title={
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5" />
            Company
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
                    Apri
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  Crea la knowledge base della tua azienda
                </p>
                <Button onClick={handleCreateCompany} size="sm">
                  Crea Company KB
                </Button>
              </>
            )}
        </Card>

        <Card title={
          <div className="flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5" />
            Offer Packs
          </div>
        }>
            <div className="text-3xl font-semibold">{offers.length}</div>
            <p className="text-sm text-gray-500 mb-3">
              {offers.length === 0 ? 'Nessun offer pack creato' : 'Offer pack disponibili'}
            </p>
            <Button onClick={handleCreateOfferPack} size="sm" variant="outline">
              {offers.length === 0 ? 'Crea il primo' : 'Gestisci'}
            </Button>
        </Card>

        <Card title={
          <div className="flex items-center gap-2">
            <CogIcon className="h-5 w-5" />
            Assignments
          </div>
        }>
            <p className="text-sm text-gray-500 mb-3">
              Configura la KB per numeri, campagne e agenti
            </p>
            <Button onClick={handleAssignments} size="sm" variant="outline">
              Apri
            </Button>
        </Card>
      </div>

      {items.length > 0 && (
        <Card title="Knowledge Bases">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progresso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
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
                          {kb.kind === 'company' ? 'Apri' : 'Modifica'}
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
