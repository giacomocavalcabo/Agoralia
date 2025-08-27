import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { analyticsApi, analyticsKeys } from '../../lib/analyticsApi';
import { Button } from './button';
import { Badge } from './Badge';

export default function ComparePanel({ className = "" }) {
  const { t } = useTranslation();
  const [leftSegment, setLeftSegment] = useState({ days: 30, campaign_id: null, agent_id: null, lang: null, country: null });
  const [rightSegment, setRightSegment] = useState({ days: 30, campaign_id: null, agent_id: null, lang: null, country: null });

  const compareMutation = useMutation({
    mutationFn: analyticsApi.postMetricsCompare,
    onSuccess: (data) => {
      console.log('Comparison result:', data);
    },
    onError: (error) => {
      console.error('Comparison failed:', error);
    }
  });

  const handleCompare = () => {
    compareMutation.mutate({
      left: leftSegment,
      right: rightSegment
    });
  };

  const updateSegment = (side, field, value) => {
    if (side === 'left') {
      setLeftSegment(prev => ({ ...prev, [field]: value }));
    } else {
      setRightSegment(prev => ({ ...prev, [field]: value }));
    }
  };

  const renderSegmentForm = (side, segment, updateFn) => (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">
        {t(`pages.analytics.compare.${side}`)}
      </h4>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Days</label>
          <select 
            value={segment.days} 
            onChange={(e) => updateFn(side, 'days', parseInt(e.target.value))}
            className="w-full text-xs border rounded px-2 py-1"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-muted-foreground">Language</label>
          <select 
            value={segment.lang || ''} 
            onChange={(e) => updateFn(side, 'lang', e.target.value || null)}
            className="w-full text-xs border rounded px-2 py-1"
          >
            <option value="">All</option>
            <option value="en-US">English</option>
            <option value="it-IT">Italian</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
            <section aria-label={t("analytics.compare.title")} className={`mt-6 ${className}`}>
          <h2 className="text-lg font-semibold mb-4">{t("analytics.compare.title")}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderSegmentForm('left', leftSegment, updateSegment)}
        {renderSegmentForm('right', rightSegment, updateSegment)}
      </div>
      
      <div className="mt-6 flex justify-center">
        <Button 
          onClick={handleCompare}
          disabled={compareMutation.isPending}
          className="px-6"
        >
                      {compareMutation.isPending ? 'Comparing...' : t("analytics.compare.add")}
        </Button>
      </div>
      
      {compareMutation.data && (
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="text-md font-medium mb-3">Comparison Results</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Left Segment</h4>
              <div className="space-y-1">
                {Object.entries(compareMutation.data.left.kpi).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground capitalize">{key}:</span>
                    <span className="ml-2 font-medium">{(value * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Right Segment</h4>
              <div className="space-y-1">
                {Object.entries(compareMutation.data.right.kpi).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground capitalize">{key}:</span>
                    <span className="ml-2 font-medium">{(value * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Deltas</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(compareMutation.data.delta).map(([key, delta]) => (
                <div key={key} className="text-center p-2 bg-background rounded">
                  <div className="text-xs text-muted-foreground capitalize">{key}</div>
                  <div className={`text-sm font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-foreground'}`}>
                    {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                  </div>
                  <Badge 
                    variant={compareMutation.data.significance[key] === 'likely' ? 'success' : 'secondary'}
                    className="text-xs mt-1"
                  >
                    {compareMutation.data.significance[key]}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {compareMutation.isError && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
          Comparison failed. Please try again.
        </div>
      )}
    </section>
  );
}
