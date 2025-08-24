import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/Badge';
import { useToast } from './ToastProvider';
import { useTranslation } from '../lib/i18n';

const CRMPushButton = ({ callId, workspaceId, className = '' }) => {
  const { t } = useTranslation('pages');
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [crmStatus, setCrmStatus] = useState({
    lastPush: null,
    lastProvider: null,
    lastStatus: null
  });
  const [availableProviders, setAvailableProviders] = useState([]);

  useEffect(() => {
    loadCRMPushStatus();
    loadAvailableProviders();
  }, [callId, workspaceId]);

  const loadCRMPushStatus = async () => {
    try {
      // In production, fetch from API
      // For now, use mock data
      setCrmStatus({
        lastPush: null,
        lastProvider: null,
        lastStatus: null
      });
    } catch (error) {
      console.error('Failed to load CRM push status:', error);
    }
  };

  const loadAvailableProviders = async () => {
    try {
      // In production, fetch from /api/crm/providers
      // For now, use mock data
      setAvailableProviders([
        { id: 'hubspot', name: 'HubSpot', connected: true },
        { id: 'zoho', name: 'Zoho CRM', connected: false },
        { id: 'odoo', name: 'Odoo', connected: false }
      ]);
    } catch (error) {
      console.error('Failed to load available providers:', error);
    }
  };

  const handlePushToCRM = async (provider = 'auto') => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/crm/calls/${callId}/push-to-crm?provider=${provider}&workspace_id=${workspaceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const result = await response.json();
        
        toast({
          title: 'Push to CRM Successful',
          description: `Call outcome queued for push to ${result.provider}`,
          type: 'success'
        });
        
        // Update local status
        setCrmStatus({
          lastPush: new Date().toISOString(),
          lastProvider: result.provider,
          lastStatus: 'queued'
        });
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to push to CRM');
      }
      
    } catch (error) {
      toast({
        title: 'Push to CRM Failed',
        description: error.message || 'An error occurred while pushing to CRM',
        type: 'error'
      });
      
      // Update local status
      setCrmStatus({
        lastPush: new Date().toISOString(),
        lastProvider: provider === 'auto' ? 'auto' : provider,
        lastStatus: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'queued': return 'success';
      case 'processing': return 'warning';
      case 'error': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'queued': return 'Queued';
      case 'processing': return 'Processing';
      case 'error': return 'Error';
      default: return 'Not Pushed';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const connectedProviders = availableProviders.filter(p => p.connected);
  const hasConnectedCRM = connectedProviders.length > 0;

  if (!hasConnectedCRM) {
    return (
      <div className={`p-4 border border-gray-200 rounded-lg bg-gray-50 ${className}`}>
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">
            No CRM connected
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = '/settings/integrations'}
          >
            Connect CRM
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Push to CRM Button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => handlePushToCRM('auto')}
          disabled={loading}
          className="flex-1"
        >
          {loading ? 'Pushing...' : 'Push to CRM'}
        </Button>
        
        {crmStatus.lastPush && (
          <Badge variant={getStatusColor(crmStatus.lastStatus)}>
            {getStatusText(crmStatus.lastStatus)}
          </Badge>
        )}
      </div>

      {/* Last Push Status */}
      {crmStatus.lastPush && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Last push: {formatTimestamp(crmStatus.lastPush)}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Provider: {crmStatus.lastProvider}
            </span>
          </div>
        </div>
      )}

      {/* Provider Selection */}
      {connectedProviders.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Push to specific CRM:
          </p>
          <div className="flex gap-2">
            {connectedProviders.map(provider => (
              <Button
                key={provider.id}
                variant="outline"
                size="sm"
                onClick={() => handlePushToCRM(provider.id)}
                disabled={loading}
              >
                {provider.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <p>• Creates Activity (call log) with outcome and summary</p>
        <p>• Creates Task if next action is specified</p>
        <p>• Creates Deal if lead is qualified</p>
        <p>• Uses field mapping configured in Settings → Integrations</p>
      </div>
    </div>
  );
};

export default CRMPushButton;
