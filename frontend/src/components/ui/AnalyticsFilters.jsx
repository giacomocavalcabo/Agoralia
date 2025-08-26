import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import FilterBuilder from '../filters/FilterBuilder';

export default function AnalyticsFilters({ 
  filters, 
  onFiltersChange, 
  className = "",
  showQuickFilters = true 
}) {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Quick filter presets
  const quickFilters = [
    {
      id: 'working_hours',
      label: t("pages.analytics.filters.working_hours"),
      description: t("pages.analytics.filters.working_hours_desc"),
      icon: '🕘'
    },
    {
      id: 'exclude_weekends',
      label: t("pages.analytics.filters.exclude_weekends"),
      description: t("pages.analytics.filters.exclude_weekends_desc"),
      icon: '📅'
    },
    {
      id: 'mobile_only',
      label: t("pages.analytics.filters.mobile_only"),
      description: t("pages.analytics.filters.mobile_only_desc"),
      icon: '📱'
    },
    {
      id: 'high_volume',
      label: t("pages.analytics.filters.high_volume"),
      description: t("pages.analytics.filters.high_volume_desc"),
      icon: '📈'
    }
  ];

  const handleQuickFilter = (filterId) => {
    // Toggle quick filter
    const newFilters = { ...filters };
    
    if (filterId === 'working_hours') {
      newFilters.time_range = {
        ...newFilters.time_range,
        start_hour: 9,
        end_hour: 18,
        days: [1, 2, 3, 4, 5] // Mon-Fri
      };
    } else if (filterId === 'exclude_weekends') {
      newFilters.time_range = {
        ...newFilters.time_range,
        days: [1, 2, 3, 4, 5] // Mon-Fri only
      };
    } else if (filterId === 'mobile_only') {
      newFilters.phone_type = 'mobile';
    } else if (filterId === 'high_volume') {
      newFilters.min_calls = 100;
    }
    
    onFiltersChange(newFilters);
  };

  const removeFilter = (filterKey) => {
    const newFilters = { ...filters };
    delete newFilters[filterKey];
    onFiltersChange(newFilters);
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <div className={className}>
      {/* Quick filters */}
      {showQuickFilters && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-foreground">
              {t("pages.analytics.filters.quick_filters")}
            </h4>
            <span className="text-xs text-muted-foreground">
              {t("pages.analytics.filters.click_to_apply")}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {quickFilters.map(filter => (
              <button
                key={filter.id}
                onClick={() => handleQuickFilter(filter.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background hover:bg-accent transition-colors text-xs"
                title={filter.description}
              >
                <span>{filter.icon}</span>
                <span>{filter.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-medium text-foreground">
              {t("pages.analytics.filters.active_filters")}
            </h4>
            <button
              onClick={() => onFiltersChange({})}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              {t("pages.analytics.filters.clear_all")}
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-2 px-2 py-1 rounded-full bg-accent text-xs"
              >
                <span className="text-muted-foreground">{key}:</span>
                <span className="text-foreground">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
                <button
                  onClick={() => removeFilter(key)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced filters toggle */}
      <div className="mb-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          {showAdvanced 
            ? t("pages.analytics.filters.hide_advanced")
            : t("pages.analytics.filters.show_advanced")
          }
        </button>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <FilterBuilder
            filters={filters}
            onFiltersChange={onFiltersChange}
            schema={{
              campaign_id: { type: 'string', label: t("pages.analytics.filters.campaign") },
              agent_id: { type: 'string', label: t("pages.analytics.filters.agent") },
              country: { type: 'string', label: t("pages.analytics.filters.country") },
              lang: { type: 'string', label: t("pages.analytics.filters.language") },
              min_calls: { type: 'number', label: t("pages.analytics.filters.min_calls") },
              max_calls: { type: 'number', label: t("pages.analytics.filters.max_calls") },
              phone_type: { 
                type: 'select', 
                label: t("pages.analytics.filters.phone_type"),
                options: [
                  { value: 'mobile', label: t("pages.analytics.filters.mobile") },
                  { value: 'landline', label: t("pages.analytics.filters.landline") },
                  { value: 'all', label: t("pages.analytics.filters.all_types") }
                ]
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
