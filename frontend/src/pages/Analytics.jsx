import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchMetricsOverview } from "../lib/metricsApi";
import { createNumberFormatter, createDateFormatter } from "../lib/format";

export default function Analytics() {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(30);
  
  // Centralized formatters
  const formatters = createNumberFormatter(i18n.language, data?.params?.currency || 'EUR');
  const dateFormatters = createDateFormatter(i18n.language);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["metrics_overview", { days }],
    queryFn: () => fetchMetricsOverview({ days }),
    staleTime: 60_000
  });

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("pages.analytics.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.analytics.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label={t("pages.analytics.filters.range")}
            className="border rounded px-2 py-1"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>{t("pages.analytics.filters.last_7d")}</option>
            <option value={30}>{t("pages.analytics.filters.last_30d")}</option>
            <option value={90}>{t("pages.analytics.filters.last_90d")}</option>
          </select>
        </div>
      </header>

      {isError && (
        <div className="rounded border p-3 bg-red-50 text-red-700">
          <strong>{t("pages.analytics.error.title")}.</strong>{" "}
          {t("pages.analytics.error.description")}
        </div>
      )}

      {isLoading ? (
        <div className="animate-pulse h-40 rounded bg-muted" />
      ) : !data ? (
        <div className="rounded border p-6 text-center">
          <div className="text-lg font-medium text-muted-foreground mb-2">
            {t("pages.analytics.empty.title")}
          </div>
          <div className="text-sm text-muted-foreground mb-4">
            {t("pages.analytics.empty.description")}
          </div>
          <button 
            onClick={() => setDays(30)} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            {t("pages.analytics.empty.cta")}
          </button>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["reached", data.funnel?.reached],
              ["connected", data.funnel?.connected],
              ["qualified", data.funnel?.qualified],
              ["booked", data.funnel?.booked],
            ].map(([k, v]) => (
              <div key={k} className="rounded border p-3">
                <div className="text-xs text-muted-foreground">{t(`pages.analytics.kpi.${k}`)}</div>
                <div className="text-xl font-semibold">{v ?? "—"}</div>
              </div>
            ))}
          </section>

          {/* Charts placeholders (Chart.js kept for α; will swap to Recharts in β) */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded border p-3">
              <div className="text-sm font-medium mb-2">{t("pages.analytics.charts.agents_top")}</div>
              {/* replace with chart component you already use; for α, a simple list is okay */}
              <ol className="text-sm space-y-1">
                {(data.agents_top || []).map(a => (
                  <li key={a.id} className="flex justify-between">
                    <span>{a.name}</span><span className="tabular-nums">{a.calls}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded border p-3">
              <div className="text-sm font-medium mb-2">{t("pages.analytics.charts.geo")}</div>
              <ol className="text-sm space-y-1">
                {(data.geo || []).map(g => (
                  <li key={g.iso2} className="flex justify-between">
                    <span>{g.iso2}</span>
                    <span className="tabular-nums">{g.calls}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded border p-3 md:col-span-2">
              <div className="text-sm font-medium mb-2">{t("pages.analytics.charts.funnel")}</div>
              <div className="text-xs text-muted-foreground">
                Reached → Connected → Qualified → Booked
              </div>
            </div>

            <div className="rounded border p-3 md:col-span-2">
              <div className="text-sm font-medium mb-2">{t("pages.analytics.charts.cost")}</div>
              <div className="text-xs text-muted-foreground">
                {Array.isArray(data.cost_series) ? `${data.cost_series.length} days` : "—"}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}


