import { ProgressBar } from '../ui/ProgressBar';
import { Badge } from '../ui/Badge';

export function CompletenessMeter({ 
  completeness, 
  freshness, 
  lastUpdated,
  showDetails = true 
}) {
  const getFreshnessColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getFreshnessLabel = (score) => {
    if (score >= 80) return 'Fresh';
    if (score >= 60) return 'Stale';
    return 'Outdated';
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

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Completeness</span>
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
              <span className="text-sm font-medium text-gray-700">Freshness</span>
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
              Last updated: {new Date(lastUpdated).toLocaleDateString()}
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
    </div>
  );
}
