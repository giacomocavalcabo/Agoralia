import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { useToast } from '../../components/ToastProvider';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/FormPrimitives';
import { useAuth } from '../../lib/useAuth';
import CRMFieldMappingEditor from '../../components/CRMFieldMappingEditor';
import CRMSyncStatus from '../../components/CRMSyncStatus';

const Integrations = () => {
  console.log('[Integrations] Component mounted');
  
  const { t } = useTranslation('integrations');
  const { toast } = useToast();
  const { user, ready, authenticated } = useAuth();
  
  console.log('[Integrations] Auth state:', { ready, authenticated, user: user?.email });
  
  const [integrations, setIntegrations] = useState({
    hubspot: { connected: false, status: 'disconnected' },
    zoho: { connected: false, status: 'disconnected' },
    odoo: { connected: false, status: 'disconnected' }
  });
  const [loading, setLoading] = useState({});
  const [activeTab, setActiveTab] = useState('crm');
  const [selectedProvider, setSelectedProvider] = useState(null);

  useEffect(() => {
    console.log('[Integrations] useEffect triggered:', { ready, authenticated, user: user?.email });
    
    // Load integration status only when auth is ready and user is authenticated
    if (ready && authenticated) {
      console.log('[Integrations] Loading integration status...');
      loadIntegrationStatus();
    } else {
      console.log('[Integrations] Skipping load - not ready or not authenticated');
    }
    
    return () => {
      console.log('[Integrations] useEffect cleanup');
    };
  }, [ready, authenticated]);

  const loadIntegrationStatus = async () => {
    try {
      // In production, fetch from API
      if (process.env.NODE_ENV === 'production') {
        const response = await fetch('/api/settings/integrations/status', { 
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            // Handle 401 gracefully - user not authenticated
            console.log('User not authenticated for integrations status');
            setIntegrations({
              hubspot: { connected: false, status: 'disconnected' },
              zoho: { connected: false, status: 'disconnected' },
              odoo: { connected: false, status: 'disconnected' }
            });
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
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
      console.error('Failed to load integration status:', error);
      // Set default disconnected state on error
      setIntegrations({
        hubspot: { connected: false, status: 'disconnected' },
        zoho: { connected: false, status: 'disconnected' },
        odoo: { connected: false, status: 'disconnected' }
      });
      
      // Only show toast for non-401 errors
      if (!error.message?.includes('401')) {
        toast({
          title: t('errors.load_failed'),
          description: error.message,
          type: 'error'
        });
      }
    }
  };

  const handleConnect = async (provider) => {
    setLoading(prev => ({ ...prev, [provider]: true }));
    
    try {
      // In production, this would start OAuth flow
      if (process.env.NODE_ENV === 'production') {
        const response = await fetch(`/api/settings/integrations/${provider}/connect`, { 
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            toast({
              title: t('errors.auth_required'),
              description: t('errors.auth_required_desc'),
              type: 'error'
            });
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Navigate to OAuth URL (not fetch!)
        if (data.url) {
          window.location.href = data.url;
          return; // Don't show success toast, user is being redirected
        }
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
        title: t('messages.connected'),
        description: t('messages.connected_desc', {
          provider: provider.toUpperCase() 
        }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
        title: t('errors.connection_failed'),
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
        await fetch(`/api/settings/integrations/${provider}/disconnect`, { 
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // Simulate API call in development
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setIntegrations(prev => ({
        ...prev,
        [provider]: { connected: false, status: 'disconnected' }
      }));
      
      toast({
                title: t('messages.disconnected'),
        description: t('messages.disconnected_desc', {
          provider: provider.toUpperCase() 
        }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
        title: t('errors.disconnection_failed'),
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
        await fetch(`/api/settings/integrations/${provider}/test`, { 
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // Simulate API call in development
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      toast({
                title: t('messages.test_success'),
        description: t('messages.test_success_desc', {
          provider: provider.toUpperCase() 
        }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
                title: t('messages.test_failed'),
        description: t('messages.test_failed_desc', {
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
      fetch('/api/settings/integrations/mapping', {
        method: 'PUT',
        credentials: 'include',
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
      case 'connected': return t('status.connected');
      case 'connecting': return t('status.connecting');
      case 'error': return t('status.error');
      default: return t('status.disconnected');
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

  // Show loading state while auth is initializing
  if (!ready) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('title')}
          description={t('description')}
        />
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading integrations...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show auth required message if not authenticated
  if (!authenticated) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('title')}
          description={t('description')}
        />
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Authentication Required
            </h3>
            <p className="text-gray-500 mb-4">
              Please log in to manage integrations.
            </p>
            <button 
              onClick={() => window.location.href = '/login'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  console.log('[Integrations] Rendering component');
  
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
                      <TabsTrigger value="crm">{t('tabs.crm')}</TabsTrigger>
            <TabsTrigger value="mapping">{t('tabs.mapping')}</TabsTrigger>
            <TabsTrigger value="sync">{t('tabs.sync')}</TabsTrigger>
            <TabsTrigger value="other">{t('tabs.other')}</TabsTrigger>
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
                  {t('hubspot.name')}
                  <Badge variant={getStatusColor(integrations.hubspot.status)}>
                    {getStatusText(integrations.hubspot.status)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('hubspot.description')}
                </p>
                
                {integrations.hubspot.connected && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>{t('portal_id')}:</strong> {integrations.hubspot.portal_id}</p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  {!integrations.hubspot.connected ? (
                    <Button 
                      onClick={() => handleConnect('hubspot')}
                      disabled={loading.hubspot}
                      className="flex-1"
                    >
                      {loading.hubspot ? t('common.connecting') : t('actions.connect')}
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handleTest('hubspot')}
                        disabled={loading.hubspot_test}
                        className="flex-1"
                      >
                        {loading.hubspot_test ? t('common.testing') : t('actions.test')}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDisconnect('hubspot')}
                        disabled={loading.hubspot}
                        className="flex-1"
                      >
                        {loading.hubspot ? t('common.disconnecting') : t('actions.disconnect')}
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
                      {t('actions.field_mapping')}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => openSyncStatus('hubspot')}
                      className="w-full"
                    >
                      {t('actions.sync_status')}
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
                  {t('zoho.name')}
                  <Badge variant={getStatusColor(integrations.zoho.status)}>
                    {getStatusText(integrations.zoho.status)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('zoho.description')}
                </p>
                
                <div className="flex gap-2">
                  {!integrations.zoho.connected ? (
                    <Button 
                      onClick={() => handleConnect('zoho')}
                      disabled={loading.zoho}
                      className="flex-1"
                    >
                      {loading.zoho ? t('common.connecting') : t('actions.connect')}
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handleTest('zoho')}
                        disabled={loading.zoho_test}
                        className="flex-1"
                      >
                        {loading.zoho_test ? t('common.testing') : t('actions.test')}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDisconnect('zoho')}
                        disabled={loading.zoho}
                        className="flex-1"
                      >
                        {loading.zoho_test ? t('common.disconnecting') : t('actions.disconnect')}
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
                      {t('actions.field_mapping')}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => openSyncStatus('zoho')}
                      className="w-full"
                    >
                      {t('actions.sync_status')}
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
                  {t('odoo.name')}
                  <Badge variant={getStatusColor(integrations.odoo.status)}>
                    {getStatusText(integrations.odoo.status)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('odoo.description')}
                </p>
                
                <div className="flex gap-2">
                  {!integrations.odoo.connected ? (
                    <Button 
                      onClick={() => handleConnect('odoo')}
                      disabled={loading.odoo}
                      className="flex-1"
                    >
                      {loading.odoo ? t('common.connecting') : t('actions.connect')}
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handleTest('odoo')}
                        disabled={loading.odoo}
                        className="flex-1"
                      >
                        {loading.odoo ? t('common.testing') : t('actions.test')}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDisconnect('odoo')}
                        disabled={loading.odoo}
                        className="flex-1"
                      >
                        {loading.odoo_test ? t('common.disconnecting') : t('actions.disconnect')}
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
                      {t('actions.field_mapping')}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => openSyncStatus('odoo')}
                      className="w-full"
                    >
                      {t('actions.sync_status')}
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
                  {t('mapping.title')} - {selectedProvider.toUpperCase()}
                </h2>
                <Button 
                  variant="outline"
                  onClick={() => setActiveTab('crm')}
                >
                  {t('actions.back_to_integrations')}
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
                {t('mapping.select_provider')}  
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('mapping.select_provider_desc')}
              </p>
              <Button onClick={() => setActiveTab('crm')}>
                  {t('actions.go_to_integrations')}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          {selectedProvider ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('sync.title')} - {selectedProvider.toUpperCase()}
                </h2>
                <Button 
                  variant="outline"
                  onClick={() => setActiveTab('crm')}
                >
                  {t('actions.back_to_integrations')}
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
                {t('sync.select_provider')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('sync.select_provider_desc')}
              </p>
              <Button onClick={() => setActiveTab('crm')}>
                {t('actions.go_to_integrations')}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="other" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('other.coming_soon')}</CardTitle>
            </CardHeader>
            <CardContent>
                              <p className="text-gray-600 dark:text-gray-400">
                  {t('other.coming_soon_desc')}
                </p>
              </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Integrations;
