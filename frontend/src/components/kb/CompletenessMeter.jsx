import { useTranslation } from 'react-i18next';
import { ProgressBar } from '../ui/ProgressBar';
import { Badge } from '../ui/Badge';

export function CompletenessMeter({ 
  completeness, 
  freshness, 
  lastUpdated,
  showDetails = true,
  breakdown = null,
  suggestions = []
}) {
  const { t } = useTranslation('pages');
  
  const getFreshnessColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getFreshnessLabel = (score) => {
    if (score >= 80) return t('kb.quality.fresh');
    if (score >= 60) return t('kb.quality.stale');
    return t('kb.quality.outdated');
  };

  const getFreshnessDays = (lastUpdated) => {
    if (!lastUpdated) return null;
    const days = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getFreshnessStatus = (days) => {
    if (days === null) return 'unknown';
    if (days <= 30) return 'fresh';
    if (days <= 90) return 'warning';
    return 'stale';
  };

  const freshnessDays = getFreshnessDays(lastUpdated);
  const freshnessStatus = getFreshnessStatus(freshnessDays);

  // Category weights for visual representation
  const categoryWeights = {
    company: { weight: 20, label: t('kb.cards.company') },
    products: { weight: 25, label: t('kb.cards.products') },
    policies: { weight: 20, label: t('kb.cards.policies') },
    pricing: { weight: 15, label: t('kb.cards.pricing') },
    contacts: { weight: 10, label: t('kb.cards.contacts') },
    faq: { weight: 10, label: t('kb.cards.faq') }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{t('kb.overview.completeness')}</span>
          <span className="text-lg font-semibold text-gray-900">{completeness}%</span>
        </div>
        <ProgressBar 
          value={completeness} 
          size="lg"
          color={completeness >= 80 ? 'green' : completeness >= 60 ? 'yellow' : 'red'}
        />
      </div>
      
      {showDetails && (
        <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{t('kb.quality.freshness')}</span>
              <Badge status={getFreshnessLabel(freshness).toLowerCase()}>
                {freshness}/100
              </Badge>
            </div>
            <ProgressBar 
              value={freshness} 
              size="sm"
              color={freshness >= 80 ? 'green' : freshness >= 60 ? 'yellow' : 'red'}
            />
          </div>
          
          {lastUpdated && (
            <div className="text-xs text-gray-500">
              {t('kb.sources.last_refresh')}: {new Date(lastUpdated).toLocaleDateString()}
              {freshnessDays !== null && (
                <span className={`ml-2 px-2 py-1 rounded text-xs ${
                  freshnessStatus === 'fresh' ? 'bg-green-100 text-green-800' :
                  freshnessStatus === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {freshnessDays} days ago
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* Category Breakdown */}
      {breakdown && (
        <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700">{t('kb.quality.breakdown')}</h4>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(categoryWeights).map(([key, config]) => {
              const score = breakdown[`${key}_score`] || 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{config.label}</span>
                    <span className="font-medium">{score}%</span>
                  </div>
                  <ProgressBar 
                    value={score} 
                    size="sm"
                    color={score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red'}
                  />
                  <div className="text-xs text-gray-500">
                    Weight: {config.weight}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Improvement Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">{t('kb.quality.suggestions')}</h4>
          <ul className="space-y-1">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="text-xs text-gray-600 flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
