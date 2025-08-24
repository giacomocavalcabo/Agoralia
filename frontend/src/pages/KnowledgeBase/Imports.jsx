import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Card from '../../components/ui/Card'
import { Button } from '../../components/ui/button'
import { useCanEdit } from '../../lib/workspace'
import { RequireRole } from '../../lib/workspace'
import { ImportManager } from '../../components/ImportManager'
import { ImportStepper } from '../../components/kb/ImportStepper'
import { useStartImport, useImportJob, useCommitImport, useCancelImport } from '../../lib/kbApi'
import { getKBErrorMessage, isRetryableError } from '../../lib/errorHandler'
import { trackKbEvent, KB_EVENTS } from '../../lib/telemetry'
import { CogIcon, DocumentTextIcon, GlobeAltIcon, CheckIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline'
import { useDemoData } from '../../lib/useDemoData'
import { useKbProgress } from '../../lib/useKbProgress'
import EmptyState from '../../components/EmptyState'
import Spinner from '../../components/ui/Spinner'
import ErrorBlock from '../../components/ui/ErrorBlock'

// Funzione per scaricare errori CSV
function downloadErrorsCsv(errors = []) {
  if (!errors?.length) return;
  const headers = Object.keys(errors[0]);
  const csv = [
    headers.join(','),
    ...errors.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kb-import-errors.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Mock data per demo - in produzione verrà da API
const mockJobs = [
  {
    id: 'job-1',
    kind: 'csv',
    source: 'leads.csv',
    status: 'completed',
    progress: 100,
    cost_estimate: 0.15,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'job-2',
    kind: 'url',
    source: 'https://example.com',
    status: 'processing',
    progress: 65,
    cost_estimate: 0.32,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    id: 'job-3',
    kind: 'file',
    source: 'policy.pdf',
    status: 'failed',
    progress: 0,
    cost_estimate: 0.08,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    error: 'File format not supported'
  }
]

export default function Imports() {
  const { t } = useTranslation('pages')
  const [showImportManager, setShowImportManager] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [jobs, setJobs] = useState(mockJobs)
  const canEdit = useCanEdit()
  const { isDemoMode } = useDemoData()
  
  // Hook robusto per KB progress
  const { data: kbData, isLoading: kbLoading, isError: kbError, refetch: kbRefetch } = useKbProgress();
  
  const startImport = useStartImport()
  const commitImport = useCommitImport()
  const cancelImport = useCancelImport()

  // Gestisci stati KB
  if (kbLoading) return <Spinner />;
  if (kbError) return <ErrorBlock onRetry={kbRefetch} />;
  
  // Se non ci sono items, mostra empty state
  const items = kbData?.items || [];
  if (items.length === 0) {
    return (
      <EmptyState
        title={t('kb.imports.empty.title')}
        description={t('kb.imports.empty.description')}
        action={{ label: t('kb.imports.empty.cta'), to: '/knowledge' }}
      />
    );
  }

  // Simula polling per job in processing
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prev => prev.map(job => {
        if (job.status === 'processing' && job.progress < 100) {
          return {
            ...job,
            progress: Math.min(job.progress + Math.random() * 10, 100),
            status: job.progress >= 100 ? 'completed' : 'processing'
          }
        }
        return job
      }))
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const handleStartImport = async (importData) => {
    if (!canEdit) return
    
    try {
      trackKbEvent(KB_EVENTS.IMPORT_START, {
        import_kind: importData.kind,
        source_type: importData.source?.type || 'unknown'
      })

      const result = await startImport.mutateAsync(importData)
      
      if (result?.job_id) {
        // Aggiungi nuovo job alla lista
        const newJob = {
          id: result.job_id,
          kind: importData.kind,
          source: importData.source?.name || importData.source?.url || 'Unknown',
          status: 'processing',
          progress: 0,
          cost_estimate: 0.25,
          created_at: new Date().toISOString()
        }
        
        setJobs(prev => [newJob, ...prev])
        setShowImportManager(false)
        
        trackKbEvent(KB_EVENTS.IMPORT_COMMIT, {
          job_id: result.job_id,
          success: true
        })
      }
    } catch (error) {
      const errorInfo = getKBErrorMessage(error)
      if (import.meta.env.DEV) {
        console.error('Import start failed:', errorInfo)
      }
      
      trackKbEvent(KB_EVENTS.IMPORT_COMMIT, {
        job_id: 'unknown',
        success: false,
        error: errorInfo.message
      })
    }
  }

  const handleCommit = async (jobId) => {
    if (!canEdit) return
    
    try {
      await commitImport.mutateAsync({
        jobId,
        payload: { action: 'commit' }
      })
      
      // Aggiorna status del job
      setJobs(prev => prev.map(job => 
        job.id === jobId ? { ...job, status: 'committed' } : job
      ))
      
      trackKbEvent(KB_EVENTS.IMPORT_COMMIT, {
        job_id: jobId,
        success: true
      })
    } catch (error) {
      const errorInfo = getKBErrorMessage(error)
      if (import.meta.env.DEV) {
        console.error('Import commit failed:', errorInfo)
      }
      
      trackKbEvent(KB_EVENTS.IMPORT_COMMIT, {
        job_id: jobId,
        success: false,
        error: errorInfo.message
      })
    }
  }

  const handleCancel = async (jobId) => {
    if (!canEdit) return
    
    try {
      await cancelImport.mutateAsync({ jobId })
      
      // Aggiorna status del job
      setJobs(prev => prev.map(job => 
        job.id === jobId ? { ...job, status: 'canceled' } : job
      ))
      
      trackKbEvent(KB_EVENTS.IMPORT_CANCEL, {
        job_id: jobId,
        reason: 'user_request'
      })
    } catch (error) {
      const errorInfo = getKBErrorMessage(error)
      if (import.meta.env.DEV) {
        console.error('Import cancel failed:', errorInfo)
      }
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckIcon className="h-5 w-5 text-green-600" />
      case 'processing': return <ClockIcon className="h-5 w-5 text-blue-600 animate-spin" />
      case 'failed': return <XMarkIcon className="h-5 w-5 text-red-600" />
      case 'canceled': return <XMarkIcon className="h-5 w-5 text-gray-600" />
      case 'committed': return <CheckIcon className="h-5 w-5 text-green-600" />
      default: return <CogIcon className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': case 'committed': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'canceled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSourceIcon = (kind) => {
    switch (kind) {
      case 'csv': return <DocumentTextIcon className="h-4 w-4" />
      case 'file': return <DocumentTextIcon className="h-4 w-4" />
      case 'url': return <GlobeAltIcon className="h-4 w-4" />
      default: return <CogIcon className="h-4 w-4" />
    }
  }

  return (
    <RequireRole role="editor">
      <div className="px-6 lg:px-8 py-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{t('kb.imports.title')}</h1>
              <p className="text-sm text-gray-500">
                {t('kb.imports.description')}
              </p>
            </div>
            <Button onClick={() => setShowImportManager(true)} data-testid="new-import">
              <CogIcon className="h-4 w-4 mr-2" />
              {t('kb.imports.actions.new_import')}
            </Button>
          </div>
          
          <Card title={t('kb.imports.title')}>
            {jobs.length === 0 ? (
              <EmptyState
                title={t('kb.imports.empty.title')}
                description={t('kb.imports.empty.description')}
                icon={<CogIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sorgente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progresso
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Costo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Creato
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Azioni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                              {job.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getSourceIcon(job.kind)}
                            <span className="text-sm text-gray-900 capitalize">{job.kind}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 max-w-xs truncate" title={job.source}>
                            {job.source}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-32">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${job.progress}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {job.progress}%
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            ${job.cost_estimate}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {new Date(job.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(job.created_at).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            {job.status === 'completed' && (
                              <Button 
                                onClick={() => handleCommit(job.id)}
                                disabled={commitImport.isPending}
                                size="sm"
                                variant="outline"
                              >
                                {commitImport.isPending ? 'Commit...' : 'Commit'}
                              </Button>
                            )}
                            {job.status === 'processing' && (
                              <Button 
                                onClick={() => handleCancel(job.id)}
                                disabled={cancelImport.isPending}
                                size="sm"
                                variant="outline"
                              >
                                {cancelImport.isPending ? 'Annullamento...' : 'Annulla (best-effort)'}
                              </Button>
                            )}
                            <Button 
                              onClick={() => setSelectedJob(job)}
                              size="sm"
                              variant="ghost"
                            >
                              Dettagli
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Job Detail Modal */}
          {selectedJob && (
            <Card title={`Dettagli Job: ${selectedJob.id}`}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getStatusColor(selectedJob.status)}`}>
                      {selectedJob.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo</label>
                    <span className="text-sm text-gray-900 capitalize">{selectedJob.kind}</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sorgente</label>
                    <span className="text-sm text-gray-900">{selectedJob.source}</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Costo Stimato</label>
                    <span className="text-sm text-gray-900">${selectedJob.cost_estimate}</span>
                  </div>
                </div>
                
                {selectedJob.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-red-800">Errore</h4>
                    <p className="text-sm text-red-700">{selectedJob.error}</p>
                    {/* Bottone per scaricare errori CSV */}
                    <div className="mt-3">
                      <Button 
                        onClick={() => downloadErrorsCsv([
                          { 
                            job_id: selectedJob.id, 
                            source: selectedJob.source, 
                            error: selectedJob.error,
                            timestamp: new Date().toISOString()
                          }
                        ])}
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-300 hover:bg-red-100"
                      >
                        📥 Scarica errori CSV
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedJob(null)}>
                    Chiudi
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {showImportManager && (
            <ImportStepper 
              isOpen={showImportManager}
              onClose={() => setShowImportManager(false)}
              onSuccess={handleStartImport}
            />
          )}
        </div>
      </div>
    </RequireRole>
  )
}
