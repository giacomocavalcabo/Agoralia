import { useState, useEffect } from 'react'
import { PlusIcon, DocumentTextIcon, CogIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ProgressBar } from '../components/ui/ProgressBar'
import Card from '../components/ui/Card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/Badge'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function KnowledgeBase() {
  const [selectedView, setSelectedView] = useState('overview')
  
  // Fetch KB overview data
  const { data: kbData, isLoading } = useQuery({
    queryKey: ['kb-overview'],
    queryFn: () => api.get('/kb/progress'),
    staleTime: 30000
  })
  
  // Fetch KB list
  const { data: kbList } = useQuery({
    queryKey: ['kb-list'],
    queryFn: () => api.get('/kb'),
    staleTime: 60000
  })
  
  const views = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'company', name: 'Company KB', icon: DocumentTextIcon },
    { id: 'offers', name: 'Offer Packs', icon: DocumentTextIcon },
    { id: 'imports', name: 'Imports', icon: CogIcon }
  ]
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
              <LanguageSwitcher />
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <PlusIcon className="h-4 w-4 mr-2" />
              Create KB
            </Button>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {views.map((view) => (
              <button
                key={view.id}
                onClick={() => setSelectedView(view.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedView === view.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <view.icon className="h-5 w-5 inline mr-2" />
                {view.name}
              </button>
            ))}
          </nav>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedView === 'overview' && (
          <div className="space-y-6">
            {/* Progress Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Overall Progress</h3>
                  <div className="space-y-4">
                    {kbData?.progress?.map((kb) => (
                      <div key={kb.kb_id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{kb.name}</span>
                          <span className="text-gray-500">{kb.completeness_pct}%</span>
                        </div>
                        <ProgressBar value={kb.completeness_pct} />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{kb.sections_count} sections</span>
                          <span>{kb.fields_count} fields</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Freshness Score</h3>
                  <div className="space-y-4">
                    {kbData?.progress?.map((kb) => (
                      <div key={kb.kb_id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{kb.name}</span>
                          <span className={`font-medium ${
                            kb.freshness_score >= 80 ? 'text-green-600' :
                            kb.freshness_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {kb.freshness_score}/100
                          </span>
                        </div>
                        <ProgressBar 
                          value={kb.freshness_score} 
                          color={kb.freshness_score >= 80 ? 'green' : kb.freshness_score >= 60 ? 'yellow' : 'red'}
                        />
                        <div className="text-xs text-gray-500">
                          Updated {new Date(kb.last_updated).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      <DocumentTextIcon className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <CogIcon className="h-4 w-4 mr-2" />
                      Manage Assignments
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <ChartBarIcon className="h-4 w-4 mr-2" />
                      View Analytics
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
            
            {/* KB List */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Knowledge Bases</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Progress
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {kbList?.results?.map((kb) => (
                        <tr key={kb.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{kb.name}</div>
                            <div className="text-sm text-gray-500">{kb.kind}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={kb.type === 'company' ? 'default' : 'secondary'}>
                              {kb.type || 'generic'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={kb.status === 'published' ? 'success' : 'warning'}>
                              {kb.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="w-32">
                              <ProgressBar value={kb.completeness_pct} />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {kb.completeness_pct}% complete
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <Button variant="ghost" size="sm">Edit</Button>
                            <Button variant="ghost" size="sm">View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        )}
        
        {selectedView === 'company' && (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Company KB</h3>
            <p className="mt-1 text-sm text-gray-500">Company knowledge base management</p>
            <div className="mt-6">
              <Button>Create Company KB</Button>
            </div>
          </div>
        )}
        
        {selectedView === 'offers' && (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Offer Packs</h3>
            <p className="mt-1 text-sm text-gray-500">Manage offer pack templates</p>
            <div className="mt-6">
              <Button>Create Offer Pack</Button>
            </div>
          </div>
        )}
        
        {selectedView === 'imports' && (
          <div className="text-center py-12">
            <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Imports</h3>
            <p className="mt-1 text-sm text-gray-500">Manage data imports</p>
            <div className="mt-6">
              <Button>Start Import</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
