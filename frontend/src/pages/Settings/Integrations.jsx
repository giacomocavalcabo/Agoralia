import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { useToast } from '../../components/ToastProvider';
import { useTranslation } from '../../lib/i18n';

const Integrations = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState({
    hubspot: { connected: false, status: 'disconnected' },
    zoho: { connected: false, status: 'disconnected' },
    odoo: { connected: false, status: 'disconnected' }
  });
  const [loading, setLoading] = useState({});

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
    setLoading({ ...loading, [provider]: true });
    
    try {
      // In production, call actual API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
      
      setIntegrations(prev => ({
        ...prev,
        [provider]: { connected: true, status: 'connected' }
      }));
      
      toast({
        title: t('integrations.connected.title'),
        description: t('integrations.connected.description', { provider }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
        title: t('integrations.error.title'),
        description: t('integrations.error.description'),
        type: 'error'
      });
    } finally {
      setLoading({ ...loading, [provider]: false });
    }
  };

  const handleDisconnect = async (provider) => {
    setLoading({ ...loading, [provider]: true });
    
    try {
      // In production, call actual API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
      
      setIntegrations(prev => ({
        ...prev,
        [provider]: { connected: false, status: 'disconnected' }
      }));
      
      toast({
        title: t('integrations.disconnected.title'),
        description: t('integrations.disconnected.description', { provider }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
        title: t('integrations.error.title'),
        description: t('integrations.error.description'),
        type: 'error'
      });
    } finally {
      setLoading({ ...loading, [provider]: false });
    }
  };

  const handleTest = async (provider) => {
    setLoading({ ...loading, [`${provider}_test`]: true });
    
    try {
      // In production, call actual test API
      await new Promise(resolve => setTimeout(resolve, 2000)); // Mock delay
      
      toast({
        title: t('integrations.test.success.title'),
        description: t('integrations.test.success.description', { provider }),
        type: 'success'
      });
      
    } catch (error) {
      toast({
        title: t('integrations.test.error.title'),
        description: t('integrations.test.error.description'),
        type: 'error'
      });
    } finally {
      setLoading({ ...loading, [`${provider}_test`]: false });
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
      case 'connected': return t('integrations.status.connected');
      case 'connecting': return t('integrations.status.connecting');
      case 'error': return t('integrations.status.error');
      default: return t('integrations.status.disconnected');
    }
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

      <Tabs defaultValue="crm" className="space-y-6">
        <TabsList>
          <TabsTrigger value="crm">{t('integrations.tabs.crm')}</TabsTrigger>
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
                        {loading.zoho ? t('common.disconnecting') : t('integrations.disconnect')}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Odoo Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 font-bold">O</span>
                  </div>
                  Odoo CRM
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
                        {loading.odoo ? t('common.disconnecting') : t('integrations.disconnect')}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="other" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('integrations.coming_soon.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                {t('integrations.coming_soon.description')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Integrations;
