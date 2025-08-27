import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { analyticsApi, analyticsKeys } from '../../lib/analyticsApi';
import { Button } from './button';
import { Badge } from './Badge';

export default function GoalsPanel({ className = "" }) {
  const { t } = useTranslation();
  const [goal, setGoal] = useState({
    metric: 'booked_rate',
    op: '<',
    threshold: 0.1,
    window_days: 7
  });

  const alertMutation = useMutation({
    mutationFn: analyticsApi.getMetricsAlerts,
    onSuccess: (data) => {
      console.log('Alert check result:', data);
    },
    onError: (error) => {
      console.error('Alert check failed:', error);
    }
  });

  const handleCheckAlert = () => {
    alertMutation.mutate(goal);
  };

  const updateGoal = (field, value) => {
    setGoal(prev => ({ ...prev, [field]: value }));
  };

  const getStatusColor = (status) => {
    return status === 'OK' ? 'success' : 'destructive';
  };

  const getStatusIcon = (status) => {
    return status === 'OK' ? '✓' : '⚠';
  };

  return (
            <section aria-label={t("analytics.goals.title")} className={`mt-6 ${className}`}>
          <h2 className="text-lg font-semibold mb-4">{t("analytics.goals.title")}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
                      <label className="text-sm text-muted-foreground">{t("analytics.goals.metric")}</label>
          <select 
            value={goal.metric} 
            onChange={(e) => updateGoal('metric', e.target.value)}
            className="w-full text-sm border rounded px-3 py-2"
          >
            <option value="booked_rate">Booked Rate</option>
            <option value="qualified_rate">Qualified Rate</option>
            <option value="connect_rate">Connect Rate</option>
            <option value="cost_per_min">Cost per Min</option>
            <option value="dead_air">Dead Air</option>
          </select>
        </div>
        
        <div>
                      <label className="text-sm text-muted-foreground">{t("analytics.goals.condition")}</label>
          <select 
            value={goal.op} 
            onChange={(e) => updateGoal('op', e.target.value)}
            className="w-full text-sm border rounded px-3 py-2"
          >
            <option value="<">&lt;</option>
            <option value=">">&gt;</option>
            <option value="<=">&lt;=</option>
            <option value=">=">&gt;=</option>
            <option value="==">=</option>
            <option value="!=">≠</option>
          </select>
        </div>
        
        <div>
                      <label className="text-sm text-muted-foreground">{t("analytics.goals.threshold")}</label>
          <input 
            type="number" 
            step="0.01"
            value={goal.threshold} 
            onChange={(e) => updateGoal('threshold', parseFloat(e.target.value))}
            className="w-full text-sm border rounded px-3 py-2"
          />
        </div>
        
        <div>
                      <label className="text-sm text-muted-foreground">{t("analytics.goals.window")}</label>
          <select 
            value={goal.window_days} 
            onChange={(e) => updateGoal('window_days', parseInt(e.target.value))}
            className="w-full text-sm border rounded px-3 py-2"
          >
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>
      </div>
      
      <div className="flex justify-center mb-6">
        <Button 
          onClick={handleCheckAlert}
          disabled={alertMutation.isPending}
          className="px-6"
        >
                      {alertMutation.isPending ? 'Checking...' : t("analytics.goals.add")}
        </Button>
      </div>
      
      {alertMutation.data && (
        <div className="space-y-4">
          {alertMutation.data.checks.map((check, index) => (
            <div key={index} className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-medium capitalize">{check.metric.replace('_', ' ')}</h4>
                <Badge variant={getStatusColor(check.status)}>
                  {getStatusIcon(check.status)} {check.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Current:</span>
                  <span className="ml-2 font-medium">
                    {check.value !== null ? (check.value * 100).toFixed(1) + '%' : 'N/A'}
                  </span>
                </div>
                
                <div>
                  <span className="text-muted-foreground">Condition:</span>
                  <span className="ml-2 font-medium">{check.op} {(check.threshold * 100).toFixed(1)}%</span>
                </div>
                
                <div>
                  <span className="text-muted-foreground">Window:</span>
                  <span className="ml-2 font-medium">{check.window_days} days</span>
                </div>
                
                <div>
                  <span className="text-muted-foreground">{t("analytics.goals.last_check")}:</span>
                  <span className="ml-2 font-medium">Now</span>
                </div>
              </div>
              
              {check.status === 'ALERT' && (
                <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                  ⚠️ Alert triggered: {check.metric} is {check.op} {(check.threshold * 100).toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {alertMutation.isError && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
          Alert check failed. Please try again.
        </div>
      )}
    </section>
  );
}
