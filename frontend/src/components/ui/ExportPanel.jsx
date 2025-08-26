import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { analyticsApi } from '../../lib/analyticsApi';
import { Button } from './button';
import { Badge } from './Badge';

export default function ExportPanel({ className = "", filters = {} }) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [snapshotCopied, setSnapshotCopied] = useState(false);

  const handleExport = async (scope, format) => {
    setExporting(true);
    try {
      await analyticsApi.exportMetrics(scope, format, filters);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const copySnapshotLink = () => {
    // Create a snapshot link with current filters
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    
    const snapshotUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    
    navigator.clipboard.writeText(snapshotUrl).then(() => {
      setSnapshotCopied(true);
      setTimeout(() => setSnapshotCopied(false), 2000);
    });
  };

  const exportOptions = [
    { scope: 'overview', label: 'Overview', desc: 'Funnel metrics and KPIs' },
    { scope: 'timeseries', label: 'Time Series', desc: 'Daily trends and patterns' },
    { scope: 'outcomes', label: 'Outcomes', desc: 'Call results breakdown' }
  ];

  return (
    <section aria-label={t("pages.analytics.export.title")} className={`mt-6 ${className}`}>
      <h2 className="text-lg font-semibold mb-4">{t("pages.analytics.export.title")}</h2>
      
      <div className="space-y-6">
        {/* Export Options */}
        <div>
          <h3 className="text-md font-medium mb-3">Data Export</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {exportOptions.map((option) => (
              <div key={option.scope} className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">{option.label}</h4>
                <p className="text-sm text-muted-foreground mb-3">{option.desc}</p>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(option.scope, 'csv')}
                    disabled={exporting}
                    className="flex-1"
                  >
                    {exporting ? '...' : t("pages.analytics.export.csv")}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(option.scope, 'json')}
                    disabled={exporting}
                    className="flex-1"
                  >
                    {exporting ? '...' : t("pages.analytics.export.json")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Snapshot Link */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h3 className="text-md font-medium mb-3">Snapshot & Sharing</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Create a shareable link with current filters and date range
          </p>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={copySnapshotLink}
              disabled={snapshotCopied}
            >
              {snapshotCopied ? (
                <>
                  <span className="text-green-600">✓</span>
                  {t("pages.analytics.export.copied")}
                </>
              ) : (
                <>
                  <span>🔗</span>
                  {t("pages.analytics.export.snapshot")}
                </>
              )}
            </Button>
            
            {snapshotCopied && (
              <Badge variant="success" className="text-xs">
                Copied to clipboard
              </Badge>
            )}
          </div>
        </div>
        
        {/* Current Filters Summary */}
        {Object.keys(filters).length > 0 && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="text-md font-medium mb-3">Current Export Filters</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(filters).map(([key, value]) => {
                if (!value) return null;
                return (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {value}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Export Status */}
        {exporting && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              Preparing export...
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
