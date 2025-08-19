import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { useToast } from '../../components/ToastProvider';
import { useTranslation } from '../../lib/i18n';
import CRMFieldMappingEditor from '../../components/CRMFieldMappingEditor';

const Integrations = () => {
  const { t } = useTranslation();
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
      const mockStatus = {
        hubspot: { connected: true, status: 'connected', portal_id: '12345' },
        zoho: { connected: false, status: 'disconnected' },
        odoo: { connected: false, status: 'disconnected' }
      };
      setIntegrations(mockStatus);
    } catch (error) {
      console.error('Failed to load integration status:', error);
    }
  };

  const handleConnect = async (provider) => {
    setLoading(prev => ({ ...prev, [provider]: true }));
    
    try {
      // In production, this would start OAuth flow
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIntegrations(prev => ({
        ...prev,
        [provider]: { 
          connected: true, 
          status: 'connected', 
          portal_id: provider === 'hubspot' ? '12345' : undefined 
        }
      }));
      
      toast({
        title: t('integrations.connected.title'),
        description: t('integrations.connected.description', { provider: provider.toUpperCase() }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
        title: t('integrations.error.title'),
        description: t('integrations.error.description'),
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIntegrations(prev => ({
        ...prev,
        [provider]: { connected: false, status: 'disconnected' }
      }));
      
      toast({
        title: t('integrations.disconnected.title'),
        description: t('integrations.disconnected.description', { provider: provider.toUpperCase() }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
        title: t('integrations.error.title'),
        description: t('integrations.error.description'),
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: t('integrations.test.success.title'),
        description: t('integrations.test.success.description', { provider: provider.toUpperCase() }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
        title: t('integrations.test.error.title'),
        description: t('integrations.test.error.description', { provider: provider.toUpperCase() }),
        type: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, [`${provider}_test`]: false }));
    }
  };

  const handleMappingUpdate = (objectType, mapping, picklists) => {
    console.log('Mapping updated:', { objectType, mapping, picklists });
    // In production, this would update the mapping in the backend
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
      case 'connected': return t('integrations.status.connected');
      case 'connecting': return t('integrations.status.connecting');
      case 'error': return t('integrations.status.error');
      default: return t('integrations.status.disconnected');
    }
  };

  const openMappingEditor = (provider) => {
    setSelectedProvider(provider);
    setActiveTab('mapping');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('integrations.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {t('integrations.subtitle')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="crm">{t('integrations.tabs.crm')}</TabsTrigger>
          <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
          <TabsTrigger value="other">{t('integrations.tabs.other')}</TabsTrigger>
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
                  {t('integrations.hubspot.description')}
                </p>
                
                {integrations.hubspot.connected && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>{t('integrations.portal_id')}:</strong> {integrations.hubspot.portal_id}</p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  {!integrations.hubspot.connected ? (
                    <Button 
                      onClick={() => handleConnect('hubspot')}
                      disabled={loading.hubspot}
                      className="flex-1"
                    >
                      {loading.hubspot ? t('common.connecting') : t('integrations.connect')}
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handleTest('hubspot')}
                        disabled={loading.hubspot_test}
                        className="flex-1"
                      >
                        {loading.hubspot_test ? t('common.testing') : t('integrations.test')}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDisconnect('hubspot')}
                        disabled={loading.hubspot}
                        className="flex-1"
                      >
                        {loading.hubspot ? t('common.disconnecting') : t('integrations.disconnect')}
                      </Button>
                    </>
                  )}
                </div>
                
                {integrations.hubspot.connected && (
                  <Button 
                    variant="outline"
                    onClick={() => openMappingEditor('hubspot')}
                    className="w-full"
                  >
                    Configure Field Mapping
                  </Button>
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
                  {t('integrations.zoho.description')}
                </p>
                
                <div className="flex gap-2">
                  {!integrations.zoho.connected ? (
                    <Button 
                      onClick={() => handleConnect('zoho')}
                      disabled={loading.zoho}
                      className="flex-1"
                    >
                      {loading.zoho ? t('common.connecting') : t('integrations.connect')}
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handleTest('zoho')}
                        disabled={loading.zoho_test}
                        className="flex-1"
                      >
                        {loading.zoho_test ? t('common.testing') : t('integrations.test')}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDisconnect('zoho')}
                        disabled={loading.zoho}
                        className="flex-1"
                      >
                        {loading.zoho_test ? t('common.disconnecting') : t('integrations.disconnect')}
                      </Button>
                    </>
                  )}
                </div>
                
                {integrations.zoho.connected && (
                  <Button 
                    variant="outline"
                    onClick={() => openMappingEditor('zoho')}
                    className="w-full"
                  >
                    Configure Field Mapping
                  </Button>
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
                  {t('integrations.odoo.description')}
                </p>
                
                <div className="flex gap-2">
                  {!integrations.odoo.connected ? (
                    <Button 
                      onClick={() => handleConnect('odoo')}
                      disabled={loading.odoo}
                      className="flex-1"
                    >
                      {loading.odoo ? t('common.connecting') : t('integrations.connect')}
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handleTest('odoo')}
                        disabled={loading.odoo_test}
                        className="flex-1"
                      >
                        {loading.odoo_test ? t('common.testing') : t('integrations.test')}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDisconnect('odoo')}
                        disabled={loading.odoo}
                        className="flex-1"
                      >
                        {loading.odoo_test ? t('common.disconnecting') : t('integrations.disconnect')}
                      </Button>
                    </>
                  )}
                </div>
                
                {integrations.odoo.connected && (
                  <Button 
                    variant="outline"
                    onClick={() => openMappingEditor('odoo')}
                    className="w-full"
                  >
                    Configure Field Mapping
                  </Button>
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
                  Field Mapping - {selectedProvider.toUpperCase()}
                </h2>
                <Button 
                  variant="outline"
                  onClick={() => setActiveTab('crm')}
                >
                  Back to Integrations
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
                Select a CRM Provider
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Choose a connected CRM provider to configure field mapping
              </p>
              <Button onClick={() => setActiveTab('crm')}>
                Go to Integrations
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="other" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                More integrations will be available in future updates.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Integrations;
