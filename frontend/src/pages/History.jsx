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
          <section className="space-y-4" aria-label={t("history.title")}>
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{t("history.title")}</h1>
        <div className="flex gap-2">
          <input
            placeholder={t("history.search_placeholder")}
            value={q}
            onChange={(e)=>{ setPage(1); setQ(e.target.value); }}
            className="input input-bordered w-64"
            aria-label={t("history.search_aria")}
          />
          <button
            onClick={()=>exportHistoryCsv({ page, pageSize, q, filters })}
            className="btn bg-primary-500 hover:bg-primary-600 text-white border-primary-500"
          >
            {t("history.export_csv")}
          </button>
        </div>
      </header>
        
      {/* Filtri minimi; riaggancia in seguito il FilterBuilder */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select
          value={filters.campaign_id}
          onChange={(e)=>{ setPage(1); setFilters(f=>({...f, campaign_id: e.target.value })); }}
          aria-label={t("pages.history.filters.campaign")}
          className="select select-bordered"
        >
          <option value="">{t("history.filters.all_campaigns")}</option>
          {/* TODO: popola da API campagne */}
        </select>

        <select
          value={filters.next_step}
          onChange={(e)=>{ setPage(1); setFilters(f=>({...f, next_step: e.target.value })); }}
          aria-label={t("pages.history.filters.next_step")}
          className="select select-bordered"
        >
          <option value="">{t("history.filters.all_steps")}</option>
          <option value="callback">{t("history.steps.callback")}</option>
          <option value="email">{t("history.steps.email")}</option>
          <option value="meeting">{t("history.steps.meeting")}</option>
        </select>

        <input 
          type="number" 
          min="0" 
          max="100" 
          placeholder={t("history.filters.score_min")}
          value={filters.score_min}
          onChange={(e)=>{ setPage(1); setFilters(f=>({...f, score_min: e.target.value })); }}
          className="input input-bordered"
        />
        <input 
          type="number" 
          min="0" 
          max="100" 
          placeholder={t("history.filters.score_max")}
          value={filters.score_max}
          onChange={(e)=>{ setPage(1); setFilters(f=>({...f, score_max: e.target.value })); }}
          className="input input-bordered"
        />
      </div>

      <div role="region" aria-live="polite" className="card p-4">
        {isLoading && <div>{t("history.loading")}</div>}
        {isError && <div className="text-error">{t("history.error")}</div>}
                  {!isLoading && items.length === 0 && <div>{t("history.empty")}</div>}

        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("pages.history.table.call_id")}</th>
                  <th>{t("pages.history.table.campaign")}</th>
                  <th>{t("pages.history.table.outcome")}</th>
                  <th>{t("pages.history.table.score")}</th>
                  <th>{t("pages.history.table.next_step")}</th>
                  <th>{t("pages.history.table.sentiment")}</th>
                  <th>{t("pages.history.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(row => (
                  <tr key={row.id}>
                    <td className="font-mono">{row.id}</td>
                    <td>{row.campaign_name || "—"}</td>
                    <td>{row.outcome || "—"}</td>
                    <td>{row.score ?? "—"}</td>
                    <td>{row.next_step || "—"}</td>
                    <td>{row.sentiment ?? "—"}</td>
                    <td><a className="link" href={`/history/${row.id}`}>{t("pages.history.table.view")}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex justify-end items-center gap-2 pt-3">
            <span className="text-sm">{t("pages.history.pagination.total", { count: total })}</span>
            <button className="btn btn-sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>{t("common.prev")}</button>
            <span className="text-sm">{page}</span>
            <button className="btn btn-sm" disabled={page*pageSize>=total} onClick={()=>setPage(p=>p+1)}>{t("common.next")}</button>
          </div>
        )}
      </div>

    </section>
  )
}


