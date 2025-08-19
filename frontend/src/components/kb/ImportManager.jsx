import { useState } from 'react';
import { Button } from '../ui/button';
import { useStartImport, useImportJob, useCommitImport, useCancelImport } from '../../lib/kbApi';
import { getKBErrorMessage, isRetryableError } from '../../lib/errorHandler';
import { CogIcon, DocumentTextIcon, GlobeAltIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

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
  
  const startImport = useStartImport();
  const { data: job } = useImportJob(jobId);
  const commitImport = useCommitImport();
  const cancelImport = useCancelImport();

  const handleStartImport = async () => {
    if (!importData.source) return;
    
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
      console.error('Import start failed:', errorInfo);
    }
  };

  const handleCommit = async () => {
    if (!jobId) return;
    
    try {
      await commitImport.mutateAsync({
        jobId,
        payload: { action: 'commit' }
      });
      
      onSuccess?.(jobId);
      onClose();
    } catch (error) {
      const errorInfo = getKBErrorMessage(error);
      console.error('Import commit failed:', errorInfo);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    
    try {
      await cancelImport.mutateAsync({ jobId });
      onClose();
    } catch (error) {
      const errorInfo = getKBErrorMessage(error);
      console.error('Import cancel failed:', errorInfo);
    }
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
              <span className={`ml-2 text-sm font-medium ${
                index <= currentStep ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <div className={`w-16 h-0.5 mx-4 ${
                  index < currentStep ? 'bg-blue-500' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo di import
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'csv', label: 'CSV', icon: DocumentTextIcon },
                  { id: 'file', label: 'File', icon: DocumentTextIcon },
                  { id: 'url', label: 'Sito', icon: GlobeAltIcon }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setImportData(prev => ({ ...prev, kind: type.id }))}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      importData.kind === type.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <type.icon className="h-5 w-5 mx-auto mb-1" />
                    <div className="text-xs font-medium">{type.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {importData.kind === 'url' ? 'URL del sito' : 'File'}
              </label>
              {importData.kind === 'url' ? (
                <input
                  type="url"
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  onChange={(e) => setImportData(prev => ({ ...prev, source: e.target.value }))}
                />
              ) : (
                <input
                  type="file"
                  accept={importData.kind === 'csv' ? '.csv' : '.pdf,.docx,.txt,.md'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  onChange={(e) => setImportData(prev => ({ ...prev, source: e.target.files[0] }))}
                />
              )}
            </div>

            <Button 
              onClick={() => setCurrentStep(1)}
              disabled={!importData.source}
              className="w-full"
            >
              Avanti
            </Button>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Mapping automatico dei campi. Puoi modificare le associazioni se necessario.
            </p>
            
            {/* TODO: Implement mapping table */}
            <div className="text-center py-8 text-gray-500">
              <CogIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Mapping automatico in corso...</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                Indietro
              </Button>
              <Button onClick={handleStartImport} disabled={startImport.isPending}>
                {startImport.isPending ? 'Avvio...' : 'Avvia Import'}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && job && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Status Import</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${
                    job.status === 'completed' ? 'text-green-600' : 
                    job.status === 'failed' ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {job.status}
                  </span>
                </div>
                
                {job.progress && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                )}
                
                {job.cost_estimate && (
                  <div className="text-sm text-gray-600">
                    Costo stimato: ${job.cost_estimate}
                  </div>
                )}
              </div>
            </div>

            {job.status === 'completed' && (
              <div className="flex gap-2">
                <Button 
                  onClick={handleCommit}
                  disabled={commitImport.isPending}
                  className="flex-1"
                >
                  {commitImport.isPending ? 'Commit...' : 'Commit Import'}
                </Button>
                <Button 
                  onClick={handleCancel}
                  variant="outline"
                  disabled={cancelImport.isPending}
                >
                  {cancelImport.isPending ? 'Annullamento...' : 'Annulla (best-effort)'}
                </Button>
              </div>
            )}

            {job.status === 'failed' && (
              <div className="text-red-600 text-sm">
                Import fallito. Riprova o contatta il supporto.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
