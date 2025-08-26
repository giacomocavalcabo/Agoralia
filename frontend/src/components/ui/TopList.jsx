import { useTranslation } from 'react-i18next';
import { createNumberFormatter } from '../../lib/format';

export default function TopList({ 
  data, 
  title, 
  subtitle,
  className = "",
  maxItems = 5,
  showProgress = true,
  progressKey = "qualified_rate",
  valueKey = "calls",
  nameKey = "name"
}) {
  const { t, i18n } = useTranslation();
  const formatters = createNumberFormatter(i18n.language);
  
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-40 text-muted-foreground ${className}`}>
        {t("common.loading")}
      </div>
    );
  }

  // Sort by value and take top items
  const sortedData = [...data]
    .sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0))
    .slice(0, maxItems);

  // Find max value for progress bar scaling
  const maxValue = Math.max(...sortedData.map(item => item[valueKey] || 0));

  return (
    <div className={className}>
      {title && (
        <h4 className="text-sm font-medium text-foreground mb-2">{title}</h4>
      )}
      {subtitle && (
        <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
      )}
      
      <div className="space-y-3">
        {sortedData.map((item, index) => {
          const value = item[valueKey] || 0;
          const progress = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const progressValue = item[progressKey];
          
          return (
            <div key={item.id || index} className="flex items-center gap-3">
              {/* Rank */}
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                {index + 1}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-foreground truncate">
                    {item[nameKey]}
                  </div>
                  <div className="text-sm tabular-nums text-muted-foreground">
                    {formatters.number(value)}
                  </div>
                </div>
                
                {/* Progress bar */}
                {showProgress && progressValue !== undefined && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
                
                {/* Additional metrics */}
                {progressValue !== undefined && (
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>
                      {progressKey === 'qualified_rate' && t("pages.analytics.metrics.qualified_rate")}
                      {progressKey === 'connected_rate' && t("pages.analytics.metrics.connected_rate")}
                      {progressKey === 'avg_duration_sec' && t("pages.analytics.metrics.avg_duration")}
                    </span>
                    <span className="tabular-nums">
                      {progressKey === 'avg_duration_sec' 
                        ? formatters.number(progressValue) + 's'
                        : formatters.percent(progressValue)
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
