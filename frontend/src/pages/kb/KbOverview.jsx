import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, DocumentTextIcon, GlobeAltIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { CompletenessMeter } from '../../components/kb/CompletenessMeter';
import { useKbList } from '../../lib/kbApi';
import { useIsDemo } from '../../lib/useDemoData';

export default function KbOverview() {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const isDemo = useIsDemo();
  
  // Fetch KB data
  const { data: kbList, isLoading } = useKbList({ enabled: true });
  const items = kbList?.items ?? [];
  
  const company = items.find(i => i.kind === 'company');
  const offers = items.filter(i => i.kind === 'offer_pack');
  
  // Calculate overall completeness (placeholder - will come from API)
  const overallCompleteness = company?.completeness_pct || 0;
  const overallFreshness = company?.freshness_score || 100;
  const lastUpdated = company?.updated_at;
  
  // Mock data for demo
  const recentChanges = isDemo ? [
    { id: 1, type: 'source', label: 'Company Website', action: 'added', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    { id: 2, type: 'document', label: 'Terms of Service.pdf', action: 'imported', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000) },
    { id: 3, type: 'chunk', label: '15 new chunks', action: 'created', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000) }
  ] : [];
  
  const nextSteps = [
            { id: 1, title: t('pages.kb.overview.next_steps_items.add_company.title'), description: t('pages.kb.overview.next_steps_items.add_company.description'), action: 'add_company', icon: PlusIcon },
        { id: 2, title: t('pages.kb.overview.next_steps_items.import_documents.title'), description: t('pages.kb.overview.next_steps_items.import_documents.description'), action: 'import', icon: CloudArrowUpIcon },
        { id: 3, title: t('pages.kb.overview.next_steps_items.add_sources.title'), description: t('pages.kb.overview.next_steps_items.add_sources.description'), action: 'add_sources', icon: GlobeAltIcon }
  ];

  const handleAction = (action) => {
    switch (action) {
      case 'add_company':
        navigate('/knowledge/company/new');
        break;
      case 'import':
        navigate('/knowledge/import');
        break;
      case 'add_sources':
        navigate('/knowledge/sources');
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{t('pages.kb.title')}</h1>
        <p className="text-gray-600 mt-1">{t('pages.kb.overview.title')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/knowledge/sources')}>
            <GlobeAltIcon className="h-4 w-4 mr-2" />
            {t('pages.kb.sources.add_source')}
          </Button>
          <Button onClick={() => navigate('/knowledge/import')}>
            <CloudArrowUpIcon className="h-4 w-4 mr-2" />
            {t('pages.kb.import.title')}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="flex flex-row gap-6 flex-wrap">
        <Card>
          <div className="p-6 text-center">
            <DocumentTextIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-semibold text-gray-900">{items.length || 0}</div>
            <div className="text-sm text-gray-600">{t('pages.kb.overview.sources_count', { count: items.length || 0 })}</div>
          </div>
        </Card>
        
        <Card>
          <div className="p-6 text-center">
            <CloudArrowUpIcon className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-semibold text-gray-900">0</div>
            <div className="text-sm text-gray-600">{t('pages.kb.overview.documents_count', { count: 0 })}</div>
          </div>
        </Card>
        
        <Card>
          <div className="p-6 text-center">
            <DocumentTextIcon className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-semibold text-gray-900">0</div>
            <div className="text-sm text-gray-600">{t('pages.kb.overview.chunks_count', { count: 0 })}</div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completeness Meter */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('pages.kb.overview.completeness')}</h3>
            <CompletenessMeter 
              completeness={overallCompleteness}
              freshness={overallFreshness}
              lastUpdated={lastUpdated}
              showDetails={true}
            />
          </div>
        </Card>

        {/* Next Steps */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('pages.kb.overview.next_steps')}</h3>
            <div className="space-y-3">
              {nextSteps.map((step) => (
                <div key={step.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <step.icon className="h-5 w-5 text-gray-400 mr-3" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{step.title}</div>
                    <div className="text-xs text-gray-600">{step.description}</div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleAction(step.action)}
                  >
                    {step.action === 'add_company' ? t('common.add') : 
                     step.action === 'import' ? t('pages.kb.import.title') : 
                     t('pages.kb.sources.add_source')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Changes */}
      {recentChanges.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('pages.kb.overview.recent_changes')}</h3>
            <div className="space-y-3">
              {recentChanges.map((change) => (
                <div key={change.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{change.label}</div>
                      <div className="text-xs text-gray-600">{change.action}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {change.timestamp.toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {items.length === 0 && !isDemo && (
        <Card>
          <div className="text-center py-12">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('pages.kb.overview.no_data')}</h3>
            <div className="flex justify-center gap-3 mt-4">
              <Button onClick={() => navigate('/knowledge/company/new')}>
                <PlusIcon className="h-4 w-4 mr-2" />
                {t('pages.kb.overview.next_steps')}
              </Button>
              <Button variant="outline" onClick={() => navigate('/knowledge/import')}>
                <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                {t('pages.kb.import.title')}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
