import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  EllipsisVerticalIcon, 
  ArrowDownTrayIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline';

export default function ChartCard({ 
  title, 
  subtitle, 
  children, 
  className = "",
  showExport = true,
  showInfo = false,
  infoContent = ""
}) {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = (format) => {
    // TODO: Implement export functionality
    console.log(`Exporting ${title} as ${format}`);
    setShowMenu(false);
  };

  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {showInfo && (
            <button
              type="button"
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title={infoContent}
            >
              <InformationCircleIcon className="h-4 w-4" />
            </button>
          )}
          
          {showExport && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                aria-label={t("common.actions.export")}
                aria-expanded={showMenu}
                aria-haspopup="true"
              >
                <EllipsisVerticalIcon className="h-4 w-4" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-32 rounded-md border bg-popover p-1 shadow-lg z-10">
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-3 w-3" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-3 w-3" />
                    JSON
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Chart content */}
      <div className="min-h-[200px]" role="region" aria-label={`${title} chart`}>
        {children}
      </div>
      
      {/* Click outside to close menu */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}
