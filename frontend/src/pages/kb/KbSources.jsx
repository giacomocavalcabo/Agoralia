import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, GlobeAltIcon, DocumentTextIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ToastProvider';
import { useIsDemo } from '../../lib/useDemoData';

export default function KbSources() {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const { toast } = useToast?.() ?? { toast: () => {} };
  const isDemo = useIsDemo();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSource, setNewSource] = useState({ type: 'manual', label: '', url: '' });
  
  // Mock data for demo - will come from API
  const sources = isDemo ? [
    { id: 1, type: 'url', label: 'Company Website', url: 'https://example.com', status: 'ready', last_refresh: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    { id: 2, type: 'upload', label: 'Terms of Service.pdf', filename: 'tos.pdf', status: 'ready', last_refresh: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    { id: 3, type: 'manual', label: 'Product Catalog', status: 'ready', last_refresh: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  ] : [];
  
  const getTypeIcon = (type) => {
    switch (type) {
      case 'url': return GlobeAltIcon;
      case 'upload': return DocumentTextIcon;
      case 'manual': return DocumentTextIcon;
      default: return DocumentTextIcon;
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'ready': return 'success';
      case 'processing': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };
  
  const handleAddSource = () => {
    if (!newSource.label || (newSource.type === 'url' && !newSource.url)) {
      toast?.error?.('Please fill in all required fields');
      return;
    }
    
    // TODO: API call to add source
    if (isDemo) {
      toast?.success?.(t('kb.toasts.source_added'));
      setShowAddDialog(false);
      setNewSource({ type: 'manual', label: '', url: '' });
    }
  };
  
  const handleRefresh = (sourceId) => {
    // TODO: API call to refresh source
    if (isDemo) {
      toast?.success?.(t('kb.toasts.source_refreshed'));
    }
  };
  
  const handleDelete = (sourceId) => {
    // TODO: API call to delete source
    if (isDemo) {
      toast?.success?.(t('kb.toasts.source_deleted'));
    }
  };
  
  const handleUpload = () => {
    navigate('/knowledge/import');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('kb.sources.title')}</h1>
          <p className="text-gray-600 mt-1">Manage your knowledge base sources</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleUpload}>
            <DocumentTextIcon className="h-4 w-4 mr-2" />
            {t('kb.sources.upload_file')}
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            {t('kb.sources.add_source')}
          </Button>
        </div>
      </div>

      {/* Sources List */}
      {sources.length > 0 ? (
        <div className="grid gap-4">
          {sources.map((source) => {
            const TypeIcon = getTypeIcon(source.type);
            return (
              <Card key={source.id}>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <TypeIcon className="h-8 w-8 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-medium text-gray-900">{source.label}</h3>
                          <Badge status={getStatusColor(source.status)}>
                            {t(`kb.sources.status.${source.status}`)}
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {source.type === 'url' && source.url && (
                            <div className="flex items-center">
                              <GlobeAltIcon className="h-4 w-4 mr-1" />
                              {source.url}
                            </div>
                          )}
                          {source.type === 'upload' && source.filename && (
                            <div className="flex items-center">
                              <DocumentTextIcon className="h-4 w-4 mr-1" />
                              {source.filename}
                            </div>
                          )}
                          <div className="mt-1">
                            {t('kb.sources.last_refresh')}: {source.last_refresh.toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRefresh(source.id)}
                        disabled={source.status === 'processing'}
                      >
                        <ArrowPathIcon className="h-4 w-4" />
                        {t('kb.sources.refresh')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(source.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="h-4 w-4" />
                        {t('kb.sources.delete')}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('kb.sources.empty.title')}</h3>
            <p className="text-gray-600 mb-6">{t('kb.sources.empty.description')}</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => setShowAddDialog(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                {t('kb.sources.add_source')}
              </Button>
              <Button variant="outline" onClick={handleUpload}>
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                {t('kb.sources.upload_file')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Add Source Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('kb.sources.add_source')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={newSource.type}
                  onChange={(e) => setNewSource({ ...newSource, type: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="manual">{t('kb.sources.type.manual')}</option>
                  <option value="url">{t('kb.sources.type.url')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Label *
                </label>
                <Input
                  value={newSource.label}
                  onChange={(e) => setNewSource({ ...newSource, label: e.target.value })}
                  placeholder="Enter source label"
                />
              </div>
              
              {newSource.type === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL *
                  </label>
                  <Input
                    value={newSource.url}
                    onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleAddSource}>
                {t('common.add')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
