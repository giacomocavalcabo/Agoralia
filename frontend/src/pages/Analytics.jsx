import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchMetricsOverview } from "../lib/metricsApi";
import { createNumberFormatter, createDateFormatter } from "../lib/format";
import ChartCard from "../components/ui/ChartCard";
import FunnelChart from "../components/ui/FunnelChart";
import TimeSeriesChart from "../components/ui/TimeSeriesChart";
import HeatmapChart from "../components/ui/HeatmapChart";
import TopList from "../components/ui/TopList";
import AnalyticsFilters from "../components/ui/AnalyticsFilters";

export default function Analytics() {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(30);
  const [filters, setFilters] = useState({});
  
  // Centralized formatters
  const formatters = createNumberFormatter(i18n.language, 'EUR');
  const dateFormatters = createDateFormatter(i18n.language);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["metrics_overview", { days, ...filters }],
    queryFn: () => fetchMetricsOverview({ days, ...filters }),
    staleTime: 60_000
  });

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("pages.analytics.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.analytics.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label={t("pages.analytics.filters.range")}
            className="border rounded px-3 py-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>{t("pages.analytics.filters.last_7d")}</option>
            <option value={30}>{t("pages.analytics.filters.last_30d")}</option>
            <option value={90}>{t("pages.analytics.filters.last_90d")}</option>
          </select>
        </div>
      </header>

      {/* Filters */}
      <AnalyticsFilters 
        filters={filters}
        onFiltersChange={handleFiltersChange}
        className="bg-card border rounded-lg p-4"
      />

      {isError && (
        <div className="rounded border p-3 bg-red-50 text-red-700">
          <strong>{t("pages.analytics.error.title")}.</strong>{" "}
          {t("pages.analytics.error.description")}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-24 rounded-lg bg-muted" />
          ))}
        </div>
      ) : !data ? (
        <div className="rounded-lg border p-6 text-center">
          <div className="text-lg font-medium text-muted-foreground mb-2">
            {t("pages.analytics.empty.title")}
          </div>
          <div className="text-sm text-muted-foreground mb-4">
            {t("pages.analytics.empty.description")}
          </div>
          <button 
            onClick={() => setDays(30)} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            {t("pages.analytics.empty.cta")}
          </button>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["reached", data.funnel?.reached],
              ["connected", data.funnel?.connected],
              ["qualified", data.funnel?.qualified],
              ["booked", data.funnel?.booked],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">
                  {t(`pages.analytics.kpi.${k}`)}
                </div>
                <div className="text-2xl font-semibold tabular-nums">
                  {v !== null && v !== undefined ? formatters.number(v) : "—"}
                </div>
              </div>
            ))}
          </section>

          {/* Charts grid */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funnel Chart */}
            <ChartCard 
              title={t("pages.analytics.charts.funnel")}
              subtitle={t("pages.analytics.charts.funnel_desc")}
              showInfo={true}
              infoContent={t("pages.analytics.charts.funnel_info")}
            >
              <FunnelChart data={data.funnel} />
            </ChartCard>

            {/* Time Series Chart */}
            <ChartCard 
              title={t("pages.analytics.charts.timeseries")}
              subtitle={t("pages.analytics.charts.timeseries_desc")}
            >
              <TimeSeriesChart data={data.timeseries} showArea={true} />
            </ChartCard>

            {/* Top Agents */}
            <ChartCard 
              title={t("pages.analytics.charts.agents_top")}
              subtitle={t("pages.analytics.charts.agents_top_desc")}
            >
              <TopList 
                data={data.agents_top || []}
                progressKey="qualified_rate"
                valueKey="calls"
                nameKey="name"
                maxItems={5}
              />
            </ChartCard>

            {/* Geographic Distribution */}
            <ChartCard 
              title={t("pages.analytics.charts.geo")}
              subtitle={t("pages.analytics.charts.geo_desc")}
              showInfo={true}
              infoContent={t("pages.analytics.charts.geo_info")}
            >
              <TopList 
                data={data.geo || []}
                progressKey="qualified"
                valueKey="calls"
                nameKey="iso2"
                maxItems={5}
              />
            </ChartCard>
          </section>

          {/* Full-width charts */}
          <section className="space-y-6">
            {/* Heatmap */}
            <ChartCard 
              title={t("pages.analytics.charts.heatmap")}
              subtitle={t("pages.analytics.charts.heatmap_desc")}
              showInfo={true}
              infoContent={t("pages.analytics.charts.heatmap_info")}
            >
              <HeatmapChart data={data.heatmap} />
            </ChartCard>

            {/* Outcomes Breakdown */}
            <ChartCard 
              title={t("pages.analytics.charts.outcomes")}
              subtitle={t("pages.analytics.charts.outcomes_desc")}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data.outcomes || []).map((outcome, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-foreground">{outcome.label}</h5>
                      <span className="text-sm text-muted-foreground">
                        {formatters.percent(outcome.rate)}
                      </span>
                    </div>
                    <div className="text-2xl font-semibold tabular-nums">
                      {formatters.number(outcome.count)}
                    </div>
                    {outcome.avg_handle_sec > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Avg: {formatters.number(outcome.avg_handle_sec)}s
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ChartCard>
          </section>
        </>
      )}
    </div>
  );
}


