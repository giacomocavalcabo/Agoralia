import { useState } from 'react';
import { Button } from '../ui/button';
import { useStartImport, useImportJob, useCommitImport, useCancelImport } from '../../lib/kbApi';
import { getKBErrorMessage, isRetryableError } from '../../lib/errorHandler';
import { CogIcon, DocumentTextIcon, GlobeAltIcon, CheckIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const STEPS = [
  { id: 'source', label: 'Sorgente', icon: DocumentTextIcon },
  { id: 'mapping', label: 'Mapping', icon: CogIcon },
  { id: 'review', label: 'Review & Commit', icon: CheckIcon }
];

export function ImportManager({ isOpen, onClose, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [importData, setImportData] = useState({
    kind: 'csv',
    source: null,
    mapping: {},
    targetKbId: null
  });
  const [jobId, setJobId] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const startImport = useStartImport();
  const { data: job } = useImportJob(jobId);
  const commitImport = useCommitImport();
  const cancelImport = useCancelImport();

  const handleStartImport = async () => {
    if (!importData.source) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await startImport.mutateAsync({
        kind: importData.kind,
        source: importData.source,
        target_kb_id: importData.targetKbId
      });
      
      if (result?.job_id) {
        setJobId(result.job_id);
        setCurrentStep(2); // Vai direttamente alla review
      }
    } catch (error) {
      const errorInfo = getKBErrorMessage(error);
      setError(errorInfo);
      console.error('Import start failed:', errorInfo);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (!jobId) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      await commitImport.mutateAsync({
        jobId,
        payload: { action: 'commit' }
      });
      
      onSuccess?.(jobId);
      onClose();
    } catch (error) {
      const errorInfo = getKBErrorMessage(error);
      setError(errorInfo);
      console.error('Import commit failed:', errorInfo);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      await cancelImport.mutateAsync({ jobId });
      onClose();
    } catch (error) {
      const errorInfo = getKBErrorMessage(error);
      setError(errorInfo);
      console.error('Import cancel failed:', errorInfo);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSourceChange = (kind, source) => {
    setImportData(prev => ({
      ...prev,
      kind,
      source
    }));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleSourceChange('file', {
        type: 'file',
        name: file.name,
        size: file.size,
        file: file
      });
    }
  };

  const handleUrlInput = (event) => {
    const url = event.target.value;
    if (url) {
      handleSourceChange('url', {
        type: 'url',
        url: url
      });
    }
  };

  const handleCsvUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleSourceChange('csv', {
        type: 'csv',
        name: file.name,
        size: file.size,
        file: file
      });
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setImportData({
      kind: 'csv',
      source: null,
      mapping: {},
      targetKbId: null
    });
    setJobId(null);
    setError(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Import Knowledge Base</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                index <= currentStep ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 text-gray-500'
              }`}>
                {index < currentStep ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
              </div>
              {index < STEPS.length - 1 && (
                <div className={`w-16 h-0.5 mx-2 ${
                  index < currentStep ? 'bg-blue-500' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-800">
              <ExclamationTriangleIcon className="h-4 w-4" />
              <div>
                <div className="font-medium">{error.title}</div>
                <div className="text-sm">{error.message}</div>
                {error.details && (
                  <div className="text-xs mt-1">{error.details}</div>
                )}
              </div>
            </div>
            {error.retry && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => setError(null)}
              >
                Riprova
              </Button>
            )}
          </div>
        )}

        {/* Step Content */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Seleziona la sorgente</h3>
            
            <div className="grid grid-cols-1 gap-4">
              {/* CSV Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <div className="text-center">
                    <DocumentTextIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <div className="font-medium">Carica file CSV</div>
                    <div className="text-sm text-gray-500">Leads, prodotti, policy</div>
                  </div>
                </label>
              </div>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="text-center">
                    <DocumentTextIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <div className="font-medium">Carica documento</div>
                    <div className="text-sm text-gray-500">PDF, DOCX, TXT, MD</div>
                  </div>
                </label>
              </div>

              {/* URL Input */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                <div className="text-center">
                  <GlobeAltIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <div className="font-medium">Inserisci URL</div>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    onChange={handleUrlInput}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Source Preview */}
            {importData.source && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-sm text-blue-800">
                  <div className="font-medium">Sorgente selezionata:</div>
                  <div className="mt-1">
                    {importData.source.type === 'file' && (
                      <>📁 {importData.source.name} ({(importData.source.size / 1024).toFixed(1)} KB)</>
                    )}
                    {importData.source.type === 'url' && (
                      <>🌐 {importData.source.url}</>
                    )}
                    {importData.source.type === 'csv' && (
                      <>📊 {importData.source.name} ({(importData.source.size / 1024).toFixed(1)} KB)</>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Annulla
              </Button>
              <Button 
                onClick={() => setCurrentStep(1)}
                disabled={!importData.source}
              >
                Avanti
              </Button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Configura il mapping</h3>
            
            <div className="text-sm text-gray-600">
              <p>Configurazione del mapping in fase di sviluppo.</p>
              <p>Per ora procediamo direttamente all'import.</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                Indietro
              </Button>
              <Button onClick={handleStartImport} disabled={isProcessing}>
                {isProcessing ? 'Avvio...' : 'Avvia Import'}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && job && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Review & Commit</h3>
            
            {/* Job Status */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Status: {job.status}</span>
                {job.progress_pct !== undefined && (
                  <span className="text-sm text-gray-500">{job.progress_pct}%</span>
                )}
              </div>
              
              {job.progress_pct !== undefined && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${job.progress_pct}%` }}
                  ></div>
                </div>
              )}

              {job.cost_estimated_cents && (
                <div className="mt-2 text-sm text-gray-600">
                  Costo stimato: €{(job.cost_estimated_cents / 100).toFixed(2)}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={isProcessing}
              >
                {isProcessing ? 'Annullamento...' : 'Annulla (best-effort)'}
              </Button>
              <Button 
                onClick={handleCommit}
                disabled={isProcessing || job.status !== 'completed'}
              >
                {isProcessing ? 'Commit...' : 'Commit Import'}
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            <p>L'import verrà processato in background. Puoi chiudere questa finestra.</p>
            <p>Riceverai una notifica quando il processo sarà completato.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
