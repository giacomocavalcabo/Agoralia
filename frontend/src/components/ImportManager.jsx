import { useState, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowUpTrayIcon, DocumentTextIcon, GlobeAltIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { api } from '../lib/api'
import { Button } from './ui/button'
import { Card } from './ui/Card'
import { ProgressBar } from './ui/ProgressBar'
import { Badge } from './ui/Badge'

export function ImportManager({ onImportComplete }) {
  const [importType, setImportType] = useState('csv')
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState('')
  const [csvData, setCsvData] = useState('')
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
      setImportType('file')
    }
  }
  
  const handleCsvInput = (event) => {
    setCsvData(event.target.value)
    setImportType('csv')
  }
  
  const handleUrlInput = (event) => {
    setUrl(event.target.value)
    setImportType('url')
  }
  
  const handleImport = async () => {
    setIsUploading(true)
    
    let sourceData = {}
    
    switch (importType) {
      case 'csv':
        sourceData = {
          kind: 'csv',
          content: csvData,
          meta_json: { row_count: csvData.split('\n').length - 1 }
        }
        break
      case 'file':
        sourceData = {
          kind: 'file',
          filename: file.name,
          meta_json: { 
            size_bytes: file.size,
            mime_type: file.type
          }
        }
        break
      case 'url':
        sourceData = {
          kind: 'url',
          url: url,
          meta_json: { url: url }
        }
        break
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
    setUrl('')
    setCsvData('')
    setImportType('csv')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Import Type Selection */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Import Source</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setImportType('csv')}
              className={`p-4 border-2 rounded-lg text-center transition-colors ${
                importType === 'csv'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <DocumentTextIcon className="h-8 w-8 mx-auto mb-2 text-gray-600" />
              <div className="font-medium">CSV Data</div>
              <div className="text-sm text-gray-500">Paste CSV content</div>
            </button>
            
            <button
              onClick={() => setImportType('file')}
              className={`p-4 border-2 rounded-lg text-center transition-colors ${
                importType === 'file'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <ArrowUpTrayIcon className="h-8 w-8 mx-auto mb-2 text-gray-600" />
              <div className="font-medium">File Upload</div>
              <div className="text-sm text-gray-500">PDF, DOC, TXT</div>
            </button>
            
            <button
              onClick={() => setImportType('url')}
              className={`p-4 border-2 rounded-lg text-center transition-colors ${
                importType === 'url'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <GlobeAltIcon className="h-8 w-8 mx-auto mb-2 text-gray-600" />
              <div className="font-medium">Website</div>
              <div className="text-sm text-gray-500">Crawl URL</div>
            </button>
          </div>
        </div>
      </Card>
      
      {/* Import Form */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Import Details</h3>
          
          {importType === 'csv' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CSV Content
                </label>
                <textarea
                  value={csvData}
                  onChange={handleCsvInput}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste your CSV data here..."
                />
              </div>
            </div>
          )}
          
          {importType === 'file' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Upload
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.txt,.md"
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
          )}
          
          {importType === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={handleUrlInput}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
          
          <div className="mt-6 flex space-x-3">
            <Button
              onClick={handleImport}
              disabled={isUploading || (!csvData && !file && !url)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? 'Importing...' : 'Start Import'}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Reset
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
