import { PlusIcon, DocumentTextIcon, CogIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import Card from '../../components/ui/Card'
import { Button } from '../../components/ui/button'
import { useKbList, useCreateKb } from '../../lib/kbApi'
import { CompletenessMeter } from '../../components/kb/CompletenessMeter'
import KBToolbar from '../../components/kb/KBToolbar'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { trackKbEvent, KB_EVENTS } from '../../lib/telemetry'
import { useDemoData } from '../../lib/useDemoData'
import { useAuth } from '../../lib/useAuth'

export default function KnowledgeBase() {
  const { t } = useTranslation('pages')
  const navigate = useNavigate()
  const { user, workspace } = useAuth()
  const [isCreatingCompany, setIsCreatingCompany] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({ status: '' })
  const { isDemoMode } = useDemoData()
  
  // Fetch KB overview data
  const { data: kbData, isLoading, error } = useQuery({
    queryKey: ['kb-overview'],
    queryFn: () => api.get('/kb/progress'),
    staleTime: 30000
  })
  
  // Fetch KB list using new hook
  const { data: kbList } = useKbList({})
  const createKb = useCreateKb()
  const items = kbList?.items ?? []
  
  const company = items.find(i => i.kind === 'company')
  const offers = items.filter(i => i.kind === 'offer_pack')

  const handleCreateCompany = async () => {
    if (isCreatingCompany) return
    
    setIsCreatingCompany(true)
    try {
      const result = await createKb.mutateAsync({
        kind: 'company',
        name: 'Company Knowledge Base',
        type: 'company',
        locale_default: 'it-IT'
      })
      
      if (result?.id) {
        trackKbEvent(KB_EVENTS.CREATE, { kind: 'company', type: 'company', success: true })
        navigate(`/knowledge/company/${result.id}`)
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error creating company KB:', error)
      }
      trackKbEvent(KB_EVENTS.CREATE, { kind: 'company', type: 'company', success: false })
      // TODO: Show error toast
    } finally {
      setIsCreatingCompany(false)
    }
  }

  const handleCreateOfferPack = () => {
    navigate('/knowledge/offers?new=true')
  }

  const handleImport = () => {
    navigate('/knowledge/imports')
  }

  const handleAssignments = () => {
    navigate('/knowledge/assignments')
  }

  // Filter items based on search and filters
  const filteredItems = items.filter(item => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = !filters.status || item.status === filters.status
    
    return matchesSearch && matchesStatus
  })

  // Check authentication
  if (!user?.id) {
    return (
      <div className="px-6 lg:px-8 py-6">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('kb.auth.title')}
          </h3>
          <p className="text-gray-500 mb-4">
            {t('kb.auth.description')}
          </p>
          <Button onClick={() => navigate('/login')}>
            {t('common.login', { ns: 'pages' })}
          </Button>
        </div>
      </div>
    )
  }

  // Check demo mode
  if (isDemoMode) {
    return (
      <div className="px-6 lg:px-8 py-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('kb.empty.workspace_blocked')}
          </h3>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-6 lg:px-8 py-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('kb.error.title')}
          </h3>
          <p className="text-gray-500 mb-4">
            {t('kb.error.description')}
          </p>
          <Button onClick={() => window.location.reload()}>
            {t('kb.error.retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 lg:px-8 py-6">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t('kb.overview.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('kb.overview.description')}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleImport} variant="outline">
              <CogIcon className="h-4 w-4 mr-2" />
              {t('kb.overview.toolbar.bulk.import')}
            </Button>
            <Button onClick={handleCreateOfferPack} variant="secondary">
              <PlusIcon className="h-4 w-4 mr-2" />
              {t('kb.overview.toolbar.bulk.new_offer_pack')}
            </Button>
          </div>
        </div>
        
        {/* KB Toolbar */}
        <KBToolbar 
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          bulkActions={filteredItems.length > 0}
        />

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
                      {t('common.open')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-3">
                    {t('kb.overview.table.empty.description')}
                  </p>
                  <Button 
                    onClick={handleCreateCompany} 
                    size="sm"
                    disabled={isCreatingCompany}
                  >
                    {isCreatingCompany ? t('kb.editor.actions.saving') : t('kb.overview.table.empty.cta_new')}
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
            <p className="text-sm text-gray-500 mt-1">
              {offers.length === 0 ? t('kb.overview.table.empty.description') : t('kb.overview.table.empty.description')}
            </p>
            <Button className="mt-3" onClick={handleCreateOfferPack} size="sm">
              {offers.length === 0 ? t('kb.overview.table.empty.cta_new') : t('common.manage')}
            </Button>
          </Card>

          <Card title={
            <div className="flex items-center gap-2">
              <CogIcon className="h-5 w-5" />
              Assignments
            </div>
          }>
            <p className="text-sm text-gray-500 mb-3">
              {t('kb.assignments.description')}
            </p>
            <Button className="mt-3" onClick={handleAssignments} size="sm">
              {t('common.open')}
            </Button>
          </Card>
        </div>

        {/* Quick Stats */}
        {kbData && (
          <Card title={t('kb.overview.title')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-semibold">{kbData.total_kbs || 0}</div>
                <div className="text-sm text-gray-500">{t('kb.title')}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{kbData.avg_completeness || 0}%</div>
                <div className="text-sm text-gray-500">{t('kb.overview.description')}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{kbData.published_count || 0}</div>
                <div className="text-sm text-gray-500">{t('kb.overview.toolbar.filter.published')}</div>
              </div>
            </div>
          </Card>
        )}

        {/* KB Table */}
        {filteredItems.length > 0 && (
          <Card title={t('kb.title')}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200" data-testid="kb-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('kb.overview.table.columns.title')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('kb.overview.table.columns.category')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('kb.overview.table.columns.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('kb.overview.table.columns.updated_at')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('kb.overview.table.columns.owner')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50" data-testid="kb-row">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input type="checkbox" data-testid="select-checkbox" className="mr-2" />
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{item.kind}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'published' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.status || 'draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.owner || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {filteredItems.length === 0 && searchQuery && (
          <Card>
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('kb.overview.table.empty.title')}
              </h3>
              <p className="text-gray-500">
                {t('kb.overview.table.empty.description')}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
