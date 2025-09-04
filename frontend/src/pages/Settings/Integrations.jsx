import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/button';
import { useToast } from '../../components/ToastProvider';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/FormPrimitives';
import { useAuth } from '../../lib/useAuth';
import { apiFetch } from '../../lib/api';

const Integrations = () => {
  const { t } = useTranslation('integrations');
  const { toast } = useToast();
  const { user, isLoading, isAuthenticated } = useAuth();
  
  const [integrations, setIntegrations] = useState({
    hubspot: { connected: false, status: 'disconnected' },
    zoho: { connected: false, status: 'disconnected' },
    odoo: { connected: false, status: 'disconnected' }
  });
  const [loading, setLoading] = useState({});
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    console.log('[Integrations] Component mounted');
    
    const ready = !isLoading;
    const authenticated = isAuthenticated;
    
    console.log('[Integrations] Auth state:', { ready, authenticated, user: user?.email });
    
    // Check for OAuth callback success
    const urlParams = new URLSearchParams(window.location.search);
    const hubspotConnected = urlParams.get('hubspot') === 'connected';
    
    if (hubspotConnected) {
      console.log('[Integrations] HubSpot OAuth callback detected');
      toast({
        title: 'HubSpot Connected',
        description: 'Successfully connected to HubSpot',
        variant: 'success'
      });
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Load integration status only when auth is ready and user is authenticated
    if (ready && authenticated) {
      loadIntegrationStatus();
    } else if (ready && !authenticated) {
      setStatusLoading(false);
    }
    
    return () => console.log('[Integrations] Component unmounted');
  }, [isLoading, isAuthenticated, user]);

  const loadIntegrationStatus = async () => {
    try {
      console.log('[Integrations] Loading integration status...');
      setStatusLoading(true);
      
      const data = await apiFetch('/integrations/status', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('[Integrations] Status loaded:', data);
      setIntegrations(data || {
        hubspot: { connected: false, status: 'disconnected' },
        zoho: { connected: false, status: 'disconnected' },
        odoo: { connected: false, status: 'disconnected' }
      });
      
    } catch (error) {
      console.error('[Integrations] Failed to load integration status:', error);
      
      // Handle different error types gracefully
      if (error.message?.includes('401')) {
        console.log('[Integrations] User not authenticated');
        toast({
          title: t('auth_required'),
          description: t('auth_required_desc'),
          variant: 'warning'
        });
      } else if (error.message?.includes('403')) {
        console.log('[Integrations] User not authorized');
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to view integrations',
          variant: 'error'
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load integrations status',
          variant: 'error'
        });
      }
      
      // Set safe default state
      setIntegrations({
        hubspot: { connected: false, status: 'disconnected' },
        zoho: { connected: false, status: 'disconnected' },
        odoo: { connected: false, status: 'disconnected' }
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleConnect = async (provider) => {
    try {
      console.log(`[Integrations] Connecting to ${provider}...`);
      setLoading(prev => ({ ...prev, [provider]: true }));
      
      let response;
      
      if (provider === 'hubspot') {
        // HubSpot usa OAuth2 - chiama l'endpoint CRM
        response = await apiFetch(`/crm/hubspot/start`, {
          method: 'GET'
        });
        
        console.log(`[Integrations] ${provider} OAuth response:`, response);
        
        if (response.auth_url) {
          // Redirect to OAuth provider
          console.log(`[Integrations] Redirecting to ${provider} OAuth...`);
          window.location.href = response.auth_url;
        } else {
          throw new Error('No auth URL received');
        }
      } else {
        // Altri provider usano API key
        response = await apiFetch(`/integrations/${provider}/connect`, {
          method: 'POST',
          body: {
            method: 'api_key',
            api_key: 'placeholder_key', // Questo dovrebbe essere inserito dall'utente
            scopes: []
          }
        });
        
        console.log(`[Integrations] ${provider} connect response:`, response);
        
        if (response.status === 'connected') {
          toast({
            title: 'Connected',
            description: `Successfully connected to ${provider}`,
            variant: 'success'
          });
          await loadIntegrationStatus();
        } else {
          throw new Error('Connection failed');
        }
      }
      
    } catch (error) {
      console.error(`[Integrations] Failed to connect to ${provider}:`, error);
      
      if (error.message?.includes('unauthenticated')) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to connect integrations',
          variant: 'error'
        });
        // Redirect to login will be handled by apiFetch
      } else if (error.message?.includes('403')) {
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to connect integrations',
          variant: 'error'
        });
      } else if (error.message?.includes('500')) {
        toast({
          title: 'Configuration Error',
          description: 'HubSpot integration is not properly configured on the server',
          variant: 'error'
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: `Failed to start ${provider} connection: ${error.message}`,
          variant: 'error'
        });
      }
    } finally {
      setLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleDisconnect = async (provider) => {
    try {
      console.log(`[Integrations] Disconnecting from ${provider}...`);
      setLoading(prev => ({ ...prev, [provider]: true }));
      
      const response = await apiFetch(`/integrations/${provider}/disconnect`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      console.log(`[Integrations] ${provider} disconnect response:`, response);
      
      if (response.ok) {
        toast({
          title: 'Disconnected',
          description: `Successfully disconnected from ${provider}`,
          variant: 'success'
        });
        
        // Reload status
        await loadIntegrationStatus();
      }
      
    } catch (error) {
      console.error(`[Integrations] Failed to disconnect from ${provider}:`, error);
      toast({
        title: 'Disconnect Failed',
        description: `Failed to disconnect from ${provider}`,
        variant: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleTest = async (provider) => {
    try {
      console.log(`[Integrations] Testing ${provider} connection...`);
      setLoading(prev => ({ ...prev, [`${provider}_test`]: true }));
      
      const response = await apiFetch(`/integrations/${provider}/test`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      console.log(`[Integrations] ${provider} test response:`, response);
      
      if (response.ok) {
        toast({
          title: 'Connection Test',
          description: `${provider} connection is working`,
          variant: 'success'
        });
      }
      
    } catch (error) {
      console.error(`[Integrations] Failed to test ${provider}:`, error);
      toast({
        title: 'Test Failed',
        description: `Failed to test ${provider} connection`,
        variant: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, [`${provider}_test`]: false }));
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('title', 'Integrations')}
          description={t('description', 'Connect your CRM and other tools')}
        />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading integrations...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show authentication required
  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('title', 'Integrations')}
          description={t('description', 'Connect your CRM and other tools')}
        />
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('auth_required', 'Authentication Required')}
              </h3>
              <p className="text-gray-600">
                {t('auth_required_desc', 'Please log in to manage integrations')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show status loading
  if (statusLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('title', 'Integrations')}
          description={t('description', 'Connect your CRM and other tools')}
        />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading integrations status...</p>
          </div>
        </div>
      </div>
    );
  }

  const integrationCards = [
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Connect your HubSpot CRM to sync contacts, companies, and deals',
      logo: '🟠',
      connected: integrations.hubspot?.connected || false,
      status: integrations.hubspot?.status || 'disconnected'
    },
    {
      id: 'zoho',
      name: 'Zoho CRM',
      description: 'Sync your Zoho CRM data with Agoralia',
      logo: '🔵',
      connected: integrations.zoho?.connected || false,
      status: integrations.zoho?.status || 'disconnected'
    },
    {
      id: 'odoo',
      name: 'Odoo',
      description: 'Connect your Odoo ERP system',
      logo: '🟢',
      connected: integrations.odoo?.connected || false,
      status: integrations.odoo?.status || 'disconnected'
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title', 'Integrations')}
        description={t('description', 'Connect your CRM and other tools to sync data and automate workflows')}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrationCards.map((integration) => (
          <Card key={integration.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{integration.logo}</span>
                  <div>
                    <CardTitle className="text-lg">{integration.name}</CardTitle>
                    <Badge 
                      variant={integration.connected ? "success" : "secondary"}
                      className="mt-1"
                    >
                      {integration.connected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {integration.description}
              </p>
              
              <div className="flex space-x-2">
                {integration.connected ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(integration.id)}
                      disabled={loading[`${integration.id}_test`]}
                    >
                      {loading[`${integration.id}_test`] ? 'Testing...' : 'Test'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDisconnect(integration.id)}
                      disabled={loading[integration.id]}
                    >
                      {loading[integration.id] ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => handleConnect(integration.id)}
                    disabled={loading[integration.id]}
                    className="w-full"
                  >
                    {loading[integration.id] ? 'Connecting...' : 'Connect'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Connection Status Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <Badge variant="success" className="w-2 h-2 p-0 rounded-full"></Badge>
              <span>Connected - Integration is active and syncing data</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="w-2 h-2 p-0 rounded-full"></Badge>
              <span>Disconnected - Click Connect to set up integration</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Integrations;