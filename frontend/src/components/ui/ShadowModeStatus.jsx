import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, analyticsKeys } from '../../lib/analyticsApi';
import { isFeatureEnabled } from '../../lib/featureFlags';
import { Badge } from './Badge';
import { Button } from './button';

export default function ShadowModeStatus({ 
  className = "",
  days = 30,
  campaign_id = null,
  agent_id = null
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Only show if shadow mode is enabled
  if (!isFeatureEnabled('SHADOW_MODE')) {
    return null;
  }
  
  const { data: shadowData, isLoading, refetch } = useQuery({
    queryKey: analyticsKeys.shadowMode({ days, campaign_id, agent_id }),
    queryFn: () => analyticsApi.fetchShadowMode({ days, campaign_id, agent_id }),
    staleTime: 300_000, // 5 minutes
    gcTime: 600_000,    // 10 minutes
    enabled: isFeatureEnabled('SHADOW_MODE')
  });
  
  if (isLoading) {
    return (
      <div className={`bg-muted/50 border rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">
            {t('pages.analytics.shadow.loading')}
          </span>
        </div>
      </div>
    );
  }
  
  if (!shadowData || !shadowData.ok) {
    return null;
  }
  
  const { stability_score, deltas, notes } = shadowData;
  const stabilityScore = stability_score || 0;
  
  const getStabilityColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'destructive';
  };
  
  const getStabilityIcon = (score) => {
    if (score >= 80) return '✅';
    if (score >= 60) return '⚠️';
    return '❌';
  };
  
  return (
    <div className={`bg-muted/50 border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {t('pages.analytics.shadow.title')}
          </span>
          <Badge variant={getStabilityColor(stabilityScore)}>
            {getStabilityIcon(stabilityScore)} {stabilityScore}%
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-6 px-2"
          >
            {t('common.refresh')}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-2"
          >
            {isExpanded ? t('common.hide') : t('common.show')}
          </Button>
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground mb-3">
        {stabilityScore >= 0.80 
          ? t('pages.analytics.shadow.stable_message')
          : t('pages.analytics.shadow.unstable_message')
        }
      </div>
      
      {isExpanded && deltas && (
        <div className="space-y-3">
          {/* Stability Score */}
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-semibold text-primary">
              {(stabilityScore * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">
              {t('pages.analytics.shadow.stability')}
            </div>
          </div>
          
          {/* Funnel Deltas */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">
              {t('pages.analytics.shadow.funnel_deltas')}
            </h4>
            
            {Object.entries(deltas.funnel || {}).map(([key, delta]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground capitalize">
                  {key}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-foreground">
                    {(delta * 100).toFixed(1)}%
                  </span>
                  <Badge 
                    variant={delta < 0.05 ? 'success' : delta < 0.10 ? 'warning' : 'destructive'}
                    className="text-xs"
                  >
                    {delta < 0.05 ? '✓' : delta < 0.10 ? '⚠' : '✗'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          
          {/* Notes */}
          {notes && notes.length > 0 && (
            <div className="pt-2 border-t">
              <h4 className="text-sm font-medium text-foreground mb-2">
                {t('pages.analytics.shadow.notes')}
              </h4>
              <div className="space-y-1">
                {notes.map((note, index) => (
                  <div key={index} className="text-xs text-muted-foreground">
                    • {note}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Rollout Status */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('pages.analytics.shadow.rollout_status')}
              </span>
              <Badge variant={stabilityScore >= 0.80 ? 'success' : 'warning'}>
                {stabilityScore >= 0.80 
                  ? t('pages.analytics.shadow.ready_for_rollout')
                  : t('pages.analytics.shadow.not_ready')
                }
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
