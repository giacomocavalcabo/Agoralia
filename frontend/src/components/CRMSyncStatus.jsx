import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/button';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { useToast } from './ToastProvider';
import { useTranslation } from '../lib/i18n';

const CRMSyncStatus = ({ workspaceId, provider }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [syncStatus, setSyncStatus] = useState({
    status: 'idle',
    lastSync: null,
    cursors: {},
    progress: 0,
    currentOperation: null
  });
  
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    loadSyncStatus();
    loadSyncLogs();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      loadSyncStatus();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [workspaceId, provider]);

  const loadSyncStatus = async () => {
    try {
      const response = await fetch(`/api/crm/sync/status?provider=${provider}&workspace_id=${workspaceId}`);
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const response = await fetch(`/api/crm/sync/logs?provider=${provider}&workspace_id=${workspaceId}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to load sync logs:', error);
    }
  };

  const startSync = async (mode, objects = null) => {
    setLoading(true);
    try {
      const payload = {
        provider,
        mode,
        workspace_id: workspaceId
      };
      
      if (objects) {
        payload.objects = objects;
      }
      
      const response = await fetch('/api/crm/sync/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Sync Started',
          description: `CRM sync job queued: ${result.job_id}`,
          type: 'success'
        });
        
        // Reload status after a short delay
        setTimeout(() => {
          loadSyncStatus();
        }, 2000);
      } else {
        throw new Error('Failed to start sync');
      }
    } catch (error) {
      toast({
        title: 'Sync Error',
        description: 'Failed to start CRM sync',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'warning';
      case 'completed': return 'success';
      case 'error': return 'destructive';
      case 'idle': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'running': return 'Running';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      case 'idle': return 'Idle';
      default: return 'Unknown';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getObjectIcon = (objectType) => {
    const icons = {
      contact: '👤',
      company: '🏢',
      deal: '💼',
      activity: '📝'
    };
    return icons[objectType] || '📄';
  };

  const renderCursorStatus = (objectType, cursorData) => {
    if (!cursorData) return null;
    
    return (
      <div key={objectType} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-3">
          <span className="text-lg">{getObjectIcon(objectType)}</span>
          <div>
            <h4 className="font-medium capitalize">{objectType}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Last sync: {formatTimestamp(cursorData.since)}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm font-medium">{cursorData.last_count || 0} records</p>
          <p className="text-xs text-gray-500">Cursor: {cursorData.cursor?.substring(0, 8)}...</p>
        </div>
      </div>
    );
  };

  const renderLogEntry = (log) => {
    const levelColors = {
      info: 'text-blue-600 dark:text-blue-400',
      warn: 'text-yellow-600 dark:text-yellow-400',
      error: 'text-red-600 dark:text-red-400'
    };
    
    return (
      <div key={log.id} className="flex items-start gap-3 p-3 border-b border-gray-200 last:border-b-0">
        <div className={`text-xs font-medium ${levelColors[log.level] || 'text-gray-600'}`}>
          {log.level.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 dark:text-white">{log.message}</p>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span>{log.object}</span>
            <span>{log.direction}</span>
            <span>{formatTimestamp(log.created_at)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sync Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sync Status - {provider.toUpperCase()}</span>
            <Badge variant={getStatusColor(syncStatus.status)}>
              {getStatusText(syncStatus.status)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {syncStatus.lastSync ? formatTimestamp(syncStatus.lastSync) : 'Never'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Last Sync</p>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Object.keys(syncStatus.cursors).length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Cursors</p>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {syncStatus.currentOperation || 'None'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Current Operation</p>
            </div>
          </div>
          
          {syncStatus.status === 'running' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{syncStatus.progress}%</span>
              </div>
              <ProgressBar value={syncStatus.progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => startSync('pull', ['contact', 'company', 'deal'])}
              disabled={loading || syncStatus.status === 'running'}
              className="w-full"
            >
              {loading ? 'Starting...' : 'Delta Pull'}
            </Button>
            
            <Button
              onClick={() => startSync('pull', ['contact', 'company', 'deal'], true)}
              disabled={loading || syncStatus.status === 'running'}
              variant="outline"
              className="w-full"
            >
              {loading ? 'Starting...' : 'Backfill'}
            </Button>
            
            <Button
              onClick={() => startSync('push')}
              disabled={loading || syncStatus.status === 'running'}
              variant="outline"
              className="w-full"
            >
              {loading ? 'Starting...' : 'Push Test'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cursor Status */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Cursors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(syncStatus.cursors).map(([objectType, cursorData]) =>
              renderCursorStatus(objectType, cursorData)
            )}
            
            {Object.keys(syncStatus.cursors).length === 0 && (
              <p className="text-center text-gray-500 py-4">
                No active sync cursors
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sync Logs</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogs(!showLogs)}
            >
              {showLogs ? 'Hide Logs' : 'Show Logs'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showLogs ? (
            <div className="space-y-0 max-h-96 overflow-y-auto">
              {logs.length > 0 ? (
                logs.map(renderLogEntry)
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No sync logs available
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">
              Click "Show Logs" to view recent sync activity
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CRMSyncStatus;
