import { useState, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useI18n } from '../lib/i18n.jsx'
import { api } from '../lib/api'
import { Button } from './ui/button'
import { Card } from './ui/Card'
import { ProgressBar } from './ui/ProgressBar'
import { Badge } from './ui/Badge'

export function ImportManager({ onImportComplete }) {
  const { t } = useI18n('pages')
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef()
  
  // Import mutation
  const importMutation = useMutation({
    mutationFn: (data) => api.post('/kb/imports', data),
    onSuccess: (data) => {
      setIsUploading(false)
      onImportComplete?.(data)
    },
    onError: (error) => {
      setIsUploading(false)
      console.error('Import failed:', error)
    }
  })
  
  // Poll for job status
  const { data: jobStatus } = useQuery({
    queryKey: ['import-job-status'],
    queryFn: () => api.get(`/kb/imports/${importMutation.data?.job_id}`),
    enabled: !!importMutation.data?.job_id,
    refetchInterval: 2000,
    refetchIntervalInBackground: true
  })
  
  const handleFileUpload = (event) => {
    const selectedFile = event.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }
  
  const handleImport = async () => {
    setIsUploading(true)
    
    const sourceData = {
      kind: 'file',
      filename: file.name,
      meta_json: { 
        size_bytes: file.size,
        mime_type: file.type
      }
    }
    
    try {
      await importMutation.mutateAsync({
        source: sourceData,
        template: 'generic',
        idempotency_key: `import_${Date.now()}`
      })
    } catch (error) {
      setIsUploading(false)
    }
  }
  
  const resetForm = () => {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Import Form */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('import.csv.title') || 'Import CSV File'}</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('import.csv.file_upload') || 'CSV File Upload'}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept=".csv"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {file && (
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{file.name}</span>
                  <button
                    onClick={() => setFile(null)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6 flex space-x-3">
            <Button
              onClick={handleImport}
              disabled={isUploading || !file}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? (t('common.importing') || 'Importing...') : (t('import.csv.start_import') || 'Start Import')}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              {t('common.reset') || 'Reset'}
            </Button>
          </div>
        </div>
      </Card>
      
      {/* Import Progress */}
      {importMutation.data && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Import Progress</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Job ID:</span>
                <span className="font-mono">{importMutation.data.job_id}</span>
              </div>
              
              {jobStatus && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Status:</span>
                    <Badge variant={
                      jobStatus.status === 'completed' ? 'success' :
                      jobStatus.status === 'failed' ? 'danger' :
                      jobStatus.status === 'pending' ? 'warning' : 'default'
                    }>
                      {jobStatus.status}
                    </Badge>
                  </div>
                  
                  {jobStatus.progress_pct !== undefined && (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress:</span>
                        <span>{jobStatus.progress_pct}%</span>
                      </div>
                      <ProgressBar value={jobStatus.progress_pct} />
                    </div>
                  )}
                  
                  {jobStatus.error_message && (
                    <div className="text-red-600 text-sm">
                      Error: {jobStatus.error_message}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
