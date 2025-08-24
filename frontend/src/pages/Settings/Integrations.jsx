import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { useToast } from '../../components/ToastProvider';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/FormPrimitives';
import CRMFieldMappingEditor from '../../components/CRMFieldMappingEditor';
import CRMSyncStatus from '../../components/CRMSyncStatus';

const Integrations = () => {
  const { t } = useTranslation('pages');
  const { toast } = useToast();
  
  const [integrations, setIntegrations] = useState({
    hubspot: { connected: false, status: 'disconnected' },
    zoho: { connected: false, status: 'disconnected' },
    odoo: { connected: false, status: 'disconnected' }
  });
  const [loading, setLoading] = useState({});
  const [activeTab, setActiveTab] = useState('crm');
  const [selectedProvider, setSelectedProvider] = useState(null);

  useEffect(() => {
    // Load integration status
    loadIntegrationStatus();
  }, []);

  const loadIntegrationStatus = async () => {
    try {
      // In production, fetch from API
      if (process.env.NODE_ENV === 'production') {
        const response = await fetch('/api/integrations/status');
        const data = await response.json();
        setIntegrations(data);
      } else {
        // Demo data only in development
        const mockStatus = {
          hubspot: { connected: true, status: 'connected', portal_id: '12345' },
          zoho: { connected: false, status: 'disconnected' },
          odoo: { connected: false, status: 'disconnected' }
        };
        setIntegrations(mockStatus);
      }
    } catch (error) {
      toast({
        title: t('integrations.errors.load_failed', { ns: 'pages' }),
        description: error.message,
        type: 'error'
      });
    }
  };

  const handleConnect = async (provider) => {
    setLoading(prev => ({ ...prev, [provider]: true }));
    
    try {
      // In production, this would start OAuth flow
      if (process.env.NODE_ENV === 'production') {
        await fetch(`/api/integrations/${provider}/connect`, { method: 'POST' });
      } else {
        // Simulate API call in development
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setIntegrations(prev => ({
        ...prev,
        [provider]: { 
          connected: true, 
          status: 'connected', 
          portal_id: provider === 'hubspot' ? '12345' : undefined 
        }
      }));
      
      toast({
        title: t('integrations.messages.connected', { ns: 'pages' }),
        description: t('integrations.messages.connected_desc', { 
          ns: 'pages', 
          provider: provider.toUpperCase() 
        }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
        title: t('integrations.errors.connection_failed', { ns: 'pages' }),
        description: error.message,
        type: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleDisconnect = async (provider) => {
    setLoading(prev => ({ ...prev, [provider]: true }));
    
    try {
      // In production, this would revoke tokens
      if (process.env.NODE_ENV === 'production') {
        await fetch(`/api/integrations/${provider}/disconnect`, { method: 'POST' });
      } else {
        // Simulate API call in development
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setIntegrations(prev => ({
        ...prev,
        [provider]: { connected: false, status: 'disconnected' }
      }));
      
      toast({
        title: t('integrations.messages.disconnected', { ns: 'pages' }),
        description: t('integrations.messages.disconnected_desc', { 
          ns: 'pages', 
          provider: provider.toUpperCase() 
        }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
        title: t('integrations.errors.disconnection_failed', { ns: 'pages' }),
        description: error.message,
        type: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleTest = async (provider) => {
    setLoading(prev => ({ ...prev, [`${provider}_test`]: true }));
    
    try {
      // In production, this would test the connection
      if (process.env.NODE_ENV === 'production') {
        await fetch(`/api/integrations/${provider}/test`, { method: 'POST' });
      } else {
        // Simulate API call in development
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      toast({
        title: t('integrations.messages.test_success', { ns: 'pages' }),
        description: t('integrations.messages.test_success_desc', { 
          ns: 'pages', 
          provider: provider.toUpperCase() 
        }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
        title: t('integrations.messages.test_failed', { ns: 'pages' }),
        description: t('integrations.messages.test_failed_desc', { 
          ns: 'pages', 
          provider: provider.toUpperCase() 
        }),
        type: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, [`${provider}_test`]: false }));
    }
  };

  const handleMappingUpdate = (objectType, mapping, picklists) => {
    // In production, this would update the mapping in the backend
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/integrations/mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectType, mapping, picklists })
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'error': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'connected': return t('integrations.status.connected', { ns: 'pages' });
      case 'connecting': return t('integrations.status.connecting', { ns: 'pages' });
      case 'error': return t('integrations.status.error', { ns: 'pages' });
      default: return t('integrations.status.disconnected', { ns: 'pages' });
    }
  };

  const openMappingEditor = (provider) => {
    setSelectedProvider(provider);
    setActiveTab('mapping');
  };

  const openSyncStatus = (provider) => {
    setSelectedProvider(provider);
    setActiveTab('sync');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('integrations.title', { ns: 'pages' })}
        description={t('integrations.description', { ns: 'pages' })}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="crm">{t('integrations.tabs.crm', { ns: 'pages' })}</TabsTrigger>
          <TabsTrigger value="mapping">{t('integrations.tabs.mapping', { ns: 'pages' })}</TabsTrigger>
          <TabsTrigger value="sync">{t('integrations.tabs.sync', { ns: 'pages' })}</TabsTrigger>
          <TabsTrigger value="other">{t('integrations.tabs.other', { ns: 'pages' })}</TabsTrigger>
        </TabsList>

        <TabsContent value="crm" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* HubSpot Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 font-bold">H</span>
                  </div>
                  HubSpot
                  <Badge variant={getStatusColor(integrations.hubspot.status)}>
                    {getStatusText(integrations.hubspot.status)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('integrations.hubspot.description', { ns: 'pages' })}
                </p>
                
                {integrations.hubspot.connected && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>{t('integrations.portal_id', { ns: 'pages' })}:</strong> {integrations.hubspot.portal_id}</p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  {!integrations.hubspot.connected ? (
                    <Button 
                      onClick={() => handleConnect('hubspot')}
                      disabled={loading.hubspot}
                      className="flex-1"
                    >
                      {loading.hubspot ? t('common.connecting', { ns: 'pages' }) : t('integrations.actions.connect', { ns: 'pages' })}
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handleTest('hubspot')}
                        disabled={loading.hubspot_test}
                        className="flex-1"
                      >
                        {loading.hubspot_test ? t('common.testing', { ns: 'pages' }) : t('integrations.actions.test', { ns: 'pages' })}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDisconnect('hubspot')}
                        disabled={loading.hubspot}
                        className="flex-1"
                      >
                        {loading.hubspot ? t('common.disconnecting', { ns: 'pages' }) : t('integrations.actions.disconnect', { ns: 'pages' })}
                      </Button>
                    </>
                  )}
                </div>
                
                {integrations.hubspot.connected && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => openMappingEditor('hubspot')}
                      className="w-full"
                    >
                      {t('integrations.actions.field_mapping', { ns: 'pages' })}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => openSyncStatus('hubspot')}
                      className="w-full"
                    >
                      {t('integrations.actions.sync_status', { ns: 'pages' })}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Zoho Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold">Z</span>
                  </div>
                  Zoho CRM
                  <Badge variant={getStatusColor(integrations.zoho.status)}>
                    {getStatusText(integrations.zoho.status)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('integrations.zoho.description', { ns: 'pages' })}
                </p>
                
                <div className="flex gap-2">
                  {!integrations.zoho.connected ? (
                    <Button 
                      onClick={() => handleConnect('zoho')}
                      disabled={loading.zoho}
                      className="flex-1"
                    >
                      {loading.zoho ? t('common.connecting', { ns: 'pages' }) : t('integrations.actions.connect', { ns: 'pages' })}
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handleTest('zoho')}
                        disabled={loading.zoho_test}
                        className="flex-1"
                      >
                        {loading.zoho_test ? t('common.testing', { ns: 'pages' }) : t('integrations.actions.test', { ns: 'pages' })}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDisconnect('zoho')}
                        disabled={loading.zoho}
                        className="flex-1"
                      >
                        {loading.zoho_test ? t('common.disconnecting', { ns: 'pages' }) : t('integrations.actions.disconnect', { ns: 'pages' })}
                      </Button>
                    </>
                  )}
                </div>
                
                {integrations.zoho.connected && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => openMappingEditor('zoho')}
                      className="w-full"
                    >
                      {t('integrations.actions.field_mapping', { ns: 'pages' })}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => openSyncStatus('zoho')}
                      className="w-full"
                    >
                      {t('integrations.actions.sync_status', { ns: 'pages' })}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Odoo Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-bold">O</span>
                  </div>
                  Odoo
                  <Badge variant={getStatusColor(integrations.odoo.status)}>
                    {getStatusText(integrations.odoo.status)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('integrations.odoo.description', { ns: 'pages' })}
                </p>
                
                <div className="flex gap-2">
                  {!integrations.odoo.connected ? (
                    <Button 
                      onClick={() => handleConnect('odoo')}
                      disabled={loading.odoo}
                      className="flex-1"
                    >
                      {loading.odoo ? t('common.connecting', { ns: 'pages' }) : t('integrations.actions.connect', { ns: 'pages' })}
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handleTest('odoo')}
                        disabled={loading.odoo}
                        className="flex-1"
                      >
                        {loading.odoo ? t('common.testing', { ns: 'pages' }) : t('integrations.actions.test', { ns: 'pages' })}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDisconnect('odoo')}
                        disabled={loading.odoo}
                        className="flex-1"
                      >
                        {loading.odoo_test ? t('common.disconnecting', { ns: 'pages' }) : t('integrations.actions.disconnect', { ns: 'pages' })}
                      </Button>
                    </>
                  )}
                </div>
                
                {integrations.odoo.connected && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => openMappingEditor('odoo')}
                      className="w-full"
                    >
                      {t('integrations.actions.field_mapping', { ns: 'pages' })}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => openSyncStatus('odoo')}
                      className="w-full"
                    >
                      {t('integrations.actions.sync_status', { ns: 'pages' })}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mapping" className="space-y-6">
          {selectedProvider ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('integrations.mapping.title', { ns: 'pages' })} - {selectedProvider.toUpperCase()}
                </h2>
                <Button 
                  variant="outline"
                  onClick={() => setActiveTab('crm')}
                >
                  {t('integrations.actions.back_to_integrations', { ns: 'pages' })}
                </Button>
              </div>
              
              <CRMFieldMappingEditor
                workspaceId="ws_1"
                provider={selectedProvider}
                onMappingUpdate={handleMappingUpdate}
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('integrations.mapping.select_provider', { ns: 'pages' })}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('integrations.mapping.select_provider_desc', { ns: 'pages' })}
              </p>
              <Button onClick={() => setActiveTab('crm')}>
                {t('integrations.actions.go_to_integrations', { ns: 'pages' })}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          {selectedProvider ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('integrations.sync.title', { ns: 'pages' })} - {selectedProvider.toUpperCase()}
                </h2>
                <Button 
                  variant="outline"
                  onClick={() => setActiveTab('crm')}
                >
                  {t('integrations.actions.back_to_integrations', { ns: 'pages' })}
                </Button>
              </div>
              
              <CRMSyncStatus
                workspaceId="ws_1"
                provider={selectedProvider}
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('integrations.sync.select_provider', { ns: 'pages' })}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('integrations.sync.select_provider_desc', { ns: 'pages' })}
              </p>
              <Button onClick={() => setActiveTab('crm')}>
                {t('integrations.actions.go_to_integrations', { ns: 'pages' })}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="other" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('integrations.other.coming_soon', { ns: 'pages' })}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                {t('integrations.other.coming_soon_desc', { ns: 'pages' })}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Integrations;
