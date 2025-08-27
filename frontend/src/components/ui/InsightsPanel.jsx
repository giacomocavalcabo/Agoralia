import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, analyticsKeys } from '../../lib/analyticsApi';
import { Badge } from './Badge';

export default function InsightsPanel({ className = "", days = 7 }) {
  const { t } = useTranslation();
  
  const { data: insights, isLoading, error } = useQuery({
    queryKey: analyticsKeys.insights({ days }),
    queryFn: () => analyticsApi.getAnalyticsInsights({ days }),
    staleTime: 300_000, // 5 minutes
    gcTime: 600_000,    // 10 minutes
  });

  if (isLoading) {
    return (
      <section aria-label={t("analytics.insights.title")} className={`mt-6 ${className}`}>
        <h2 className="text-lg font-semibold mb-4">{t("analytics.insights.title")}</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label={t("analytics.insights.title")} className={`mt-6 ${className}`}>
        <h2 className="text-lg font-semibold mb-4">{t("analytics.insights.title")}</h2>
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
          Failed to load insights. Please try again.
        </div>
      </section>
    );
  }

  if (!insights) {
    return (
      <section aria-label={t("analytics.insights.title")} className={`mt-6 ${className}`}>
        <h2 className="text-lg font-semibold mb-4">{t("analytics.insights.title")}</h2>
        <div className="text-muted-foreground">No insights available for this period.</div>
      </section>
    );
  }

  return (
    <section aria-label={t("analytics.insights.title")} className={`mt-6 ${className}`}>
      <h2 className="text-lg font-semibold mb-4">{t("analytics.insights.title")}</h2>
      
      <div className="space-y-6">
        {/* Period Header */}
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-sm text-muted-foreground">Analysis Period</div>
          <div className="text-lg font-semibold">{insights.period}</div>
        </div>
        
        {/* Highlights */}
        {insights.highlights && insights.highlights.length > 0 && (
          <div>
            <h3 className="text-md font-medium mb-3 flex items-center gap-2">
              <span className="text-green-600">📈</span>
              {t("analytics.insights.continue")}
            </h3>
            <div className="space-y-2">
              {insights.highlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded">
                  <span className="text-green-600 text-sm">✓</span>
                  <span className="text-sm">{highlight}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Actions */}
        {insights.actions && insights.actions.length > 0 && (
          <div>
            <h3 className="text-md font-medium mb-3 flex items-center gap-2">
              <span className="text-blue-600">🎯</span>
              {t("analytics.insights.actions")}
            </h3>
            <div className="space-y-2">
              {insights.actions.map((action, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-200 rounded">
                  <span className="text-blue-600 text-sm">→</span>
                  <span className="text-sm">{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Risks */}
        {insights.risks && insights.risks.length > 0 && (
          <div>
            <h3 className="text-md font-medium mb-3 flex items-center gap-2">
              <span className="text-orange-600">⚠️</span>
              {t("analytics.insights.risks")}
            </h3>
            <div className="space-y-2">
              {insights.risks.map((risk, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-200 rounded">
                  <span className="text-orange-600 text-sm">⚠</span>
                  <span className="text-sm">{risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Top Objections */}
        {insights.top_objections && insights.top_objections.length > 0 && (
          <div>
            <h3 className="text-md font-medium mb-3 flex items-center gap-2">
              <span className="text-purple-600">💬</span>
              {t("analytics.insights.top_objections")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {insights.top_objections.map((objection, index) => (
                <div key={index} className="p-3 bg-purple-50 border border-purple-200 rounded text-center">
                  <div className="text-sm font-medium capitalize">{objection.key}</div>
                  <div className="text-lg font-semibold text-purple-600">
                    {(objection.share * 100).toFixed(1)}%
                  </div>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {index === 0 ? 'Top' : index === 1 ? '2nd' : '3rd'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
