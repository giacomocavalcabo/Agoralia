import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, DocumentTextIcon, GlobeAltIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ToastProvider';
import { useIsDemo } from '../../lib/useDemoData';

export default function KbImportWizard() {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const { toast } = useToast?.() ?? { toast: () => {} };
  const isDemo = useIsDemo();
  
  const [activeTab, setActiveTab] = useState('paste');
  const [currentStep, setCurrentStep] = useState('select');
  const [importData, setImportData] = useState({
    paste: '',
    file: null,
    url: '',
    depth: 2,
    maxPages: 10
  });
  
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ parsing: 0, chunking: 0, embedding: 0 });
  
  const tabs = [
            { id: 'paste', label: t('pages.kb.import.tabs.paste'), icon: ClipboardDocumentIcon },
        { id: 'file', label: t('pages.kb.import.tabs.file'), icon: DocumentTextIcon },
        { id: 'url', label: t('pages.kb.import.tabs.url'), icon: GlobeAltIcon }
  ];
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImportData({ ...importData, file });
    }
  };
  
  const handleStartImport = async () => {
    if (!importData[activeTab] || (activeTab === 'file' && !importData.file)) {
      toast?.error?.('Please provide content to import');
      return;
    }
    
    setProcessing(true);
    setCurrentStep('processing');
    
    // Simulate import process
    if (isDemo) {
      // Simulate parsing
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setProgress(prev => ({ ...prev, parsing: i }));
      }
      
      // Simulate chunking
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setProgress(prev => ({ ...prev, chunking: i }));
      }
      
      // Simulate embedding
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setProgress(prev => ({ ...prev, embedding: i }));
      }
      
      setCurrentStep('review');
              toast?.success?.(t('pages.kb.toasts.import_started'));
    }
    
    setProcessing(false);
  };
  
  const handleCommit = () => {
    // TODO: API call to commit import
    toast?.success?.('Import completed successfully');
    navigate('/knowledge');
  };
  
  const handleCancel = () => {
    navigate('/knowledge');
  };
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'paste':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste your content
              </label>
              <textarea
                value={importData.paste}
                onChange={(e) => setImportData({ ...importData, paste: e.target.value })}
                placeholder="Paste your text content here..."
                className="w-full h-32 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                disabled={processing}
              />
            </div>
          </div>
        );
        
      case 'file':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('pages.kb.import.file_upload.title')}
              </label>
              <p className="text-sm text-gray-600 mb-4">{t('pages.kb.import.file_upload.subtitle')}</p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">{t('pages.kb.import.file_upload.drag_drop')}</p>
                <p className="text-xs text-gray-500 mb-4">{t('pages.kb.import.file_upload.or_click')}</p>
                <p className="text-xs text-gray-500">{t('pages.kb.import.file_upload.supported_formats')}</p>
                
                <input
                  type="file"
                  accept=".pdf,.docx,.md,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={processing}
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" asChild>
                    <span>Select File</span>
                  </Button>
                </label>
              </div>
              
              {importData.file && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">
                    Selected: {importData.file.name} ({(importData.file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                </div>
              )}
            </div>
          </div>
        );
        
      case 'url':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('pages.kb.import.url_crawl.title')}
              </label>
              <p className="text-sm text-gray-600 mb-4">{t('pages.kb.import.url_crawl.subtitle')}</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL *
                  </label>
                  <Input
                    value={importData.url}
                    onChange={(e) => setImportData({ ...importData, url: e.target.value })}
                    placeholder={t('pages.kb.import.url_crawl.placeholder')}
                    disabled={processing}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('pages.kb.import.url_crawl.depth')}
                    </label>
                    <select
                      value={importData.depth}
                      onChange={(e) => setImportData({ ...importData, depth: parseInt(e.target.value) })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      disabled={processing}
                    >
                      <option value={1}>1 level</option>
                      <option value={2}>2 levels</option>
                      <option value={3}>3 levels</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('pages.kb.import.url_crawl.max_pages')}
                    </label>
                    <select
                      value={importData.maxPages}
                      onChange={(e) => setImportData({ ...importData, maxPages: parseInt(e.target.value) })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      disabled={processing}
                    >
                      <option value={5}>5 pages</option>
                      <option value={10}>10 pages</option>
                      <option value={20}>20 pages</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  const renderProcessingStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Processing your content...</h3>
        <p className="text-gray-600">This may take a few minutes depending on the content size.</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>{t('pages.kb.import.progress.parsing')}</span>
            <span>{progress.parsing}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress.parsing}%` }}></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>{t('pages.kb.import.progress.chunking')}</span>
            <span>{progress.chunking}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full" style={{ width: `${progress.chunking}%` }}></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>{t('pages.kb.import.progress.embedding')}</span>
            <span>{progress.embedding}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${progress.embedding}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Import completed successfully!</h3>
        <p className="text-gray-600">Your content has been processed and is ready to be added to your knowledge base.</p>
      </div>
      
      <div className="bg-green-50 p-4 rounded-lg">
        <div className="flex items-center">
          <DocumentTextIcon className="h-5 w-5 text-green-600 mr-2" />
          <span className="text-sm text-green-800">
            Content processed: {activeTab === 'paste' ? 'Text content' : 
                               activeTab === 'file' ? importData.file?.name : 
                               importData.url}
          </span>
        </div>
      </div>
      
      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={handleCancel}>
          {t('pages.kb.import.actions.cancel')}
        </Button>
        <Button onClick={handleCommit}>
          {t('pages.kb.import.actions.commit')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/knowledge')}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('pages.kb.import.title')}</h1>
            <p className="text-gray-600 mt-1">Import content into your knowledge base</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <div className="p-6">
          {currentStep === 'select' && (
            <>
              {/* Tabs */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  {tabs.map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <TabIcon className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              {renderTabContent()}

              {/* Actions */}
              <div className="flex justify-end space-x-3 mt-6">
                <Button variant="outline" onClick={handleCancel}>
                  {t('kb.import.actions.cancel')}
                </Button>
                <Button onClick={handleStartImport} disabled={processing}>
                                      {t('kb.import.actions.start')}
                </Button>
              </div>
            </>
          )}

          {currentStep === 'processing' && renderProcessingStep()}
          {currentStep === 'review' && renderReviewStep()}
        </div>
      </Card>
    </div>
  );
}
