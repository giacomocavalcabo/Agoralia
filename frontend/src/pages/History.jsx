import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { fetchHistory, exportHistoryCsv } from '../lib/historyApi'
import { useToast } from '../components/ToastProvider.jsx'

export default function History() {
  const { t, i18n } = useTranslation('pages')
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState({
    campaign_id: "",
    next_step: "",
    score_min: "",
    score_max: "",
    country: "",
    lang: i18n.language?.slice(0,2) || "",
    agent_id: "",
    date_from: "",
    date_to: "",
  })
  const { data, isLoading, isError } = useQuery({
    queryKey: ["history", { page, pageSize, q, filters }],
    queryFn: () => fetchHistory({ page, pageSize, sort: "-created_at", q, filters }),
    staleTime: 60_000,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

    return (
    <div className="px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {t("history.title")}
            </h1>
            <p className="text-gray-600 mt-1">
              {t("history.description") || "View and manage your call history and outcomes"}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <input
              placeholder={t("history.search_placeholder")}
              value={q}
              onChange={(e)=>{ setPage(1); setQ(e.target.value); }}
              className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              aria-label={t("history.search_aria")}
            />
            <button
              onClick={()=>exportHistoryCsv({ page, pageSize, q, filters })}
              className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              {t("history.export_csv")}
            </button>
          </div>
        </div>
      </div>
        
      {/* Filtri */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.campaign_id}
            onChange={(e)=>{ setPage(1); setFilters(f=>({...f, campaign_id: e.target.value })); }}
            aria-label={t("pages.history.filters.campaign")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">{t("history.filters.all_campaigns")}</option>
            {/* TODO: popola da API campagne */}
          </select>

          <select
            value={filters.score_min}
            onChange={(e)=>{ setPage(1); setFilters(f=>({...f, score_min: e.target.value })); }}
            aria-label={t("pages.history.filters.score_min")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">{t("history.filters.score_min")}</option>
            {/* TODO: popola da API campagne */}
          </select>

          <input 
            type="number" 
            min="0" 
            max="100" 
            placeholder={t("history.filters.score_min")}
            value={filters.score_min}
            onChange={(e)=>{ setPage(1); setFilters(f=>({...f, score_min: e.target.value })); }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <input 
            type="number" 
            min="0" 
            max="100" 
            placeholder={t("history.filters.score_max")}
            value={filters.score_max}
            onChange={(e)=>{ setPage(1); setFilters(f=>({...f, score_max: e.target.value })); }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabella risultati */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 font-medium text-gray-900">{t("pages.history.table.call_id")}</th>
                <th className="px-3 py-3 font-medium text-gray-900">{t("pages.history.table.campaign")}</th>
                <th className="px-3 py-3 font-medium text-gray-900">{t("pages.history.table.outcome")}</th>
                <th className="px-3 py-3 font-medium text-gray-900">{t("pages.history.table.score")}</th>
                <th className="px-3 py-3 font-medium text-gray-900">{t("pages.history.table.next_step")}</th>
                <th className="px-3 py-3 font-medium text-gray-900">{t("pages.history.table.sentiment")}</th>
                <th className="px-3 py-3 font-medium text-gray-900">{t("pages.history.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-3 py-6 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                      <span className="ml-2">{t("history.loading")}</span>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan="7" className="px-3 py-6 text-center text-red-600">
                    {t("history.error")}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-3 py-8 text-center text-gray-500">
                    {t("history.empty")}
                  </td>
                </tr>
              ) : (
                items.map(row => (
                  <tr key={row.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono tabular-nums">{row.id}</td>
                    <td className="px-3 py-2">{row.campaign_name || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.outcome === 'success' ? 'bg-green-100 text-green-800' :
                        row.outcome === 'callback' ? 'bg-yellow-100 text-yellow-800' :
                        row.outcome === 'no_answer' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {row.outcome || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.score >= 80 ? 'bg-green-100 text-green-800' :
                        row.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {row.score ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.next_step || "—"}</td>
                    <td className="px-3 py-2">{row.sentiment ?? "—"}</td>
                    <td className="px-3 py-2">
                      <a className="text-sm text-primary-600 hover:text-primary-800 font-medium" href={`/history/${row.id}`}>
                        {t("pages.history.table.view")}
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between border-t bg-gray-50 px-3 py-2 text-sm">
            <div>
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} results
            </div>
            <div className="flex items-center gap-2">
              <button 
                className="rounded border px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100" 
                disabled={page <= 1} 
                onClick={() => setPage(p => p - 1)}
              >
                {t("common.prev")}
              </button>
              <span className="px-2">{page}</span>
              <button 
                className="rounded border px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100" 
                disabled={page * pageSize >= total} 
                onClick={() => setPage(p => p + 1)}
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        )}
    </div>
  )
}


