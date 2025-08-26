// frontend/src/lib/historyApi.js
import { apiFetch, API_BASE_URL } from "./api";

export function buildHistoryQuery({
  page = 1,
  pageSize = 50,
  sort = "-created_at",
  q,
  filters = {},
} = {}) {
  const p = new URLSearchParams();
  p.set("page", page);
  p.set("page_size", pageSize);
  p.set("sort", sort);
  if (q) p.set("q", q);
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && `${v}` !== "") p.append(k, v);
  });
  return p.toString();
}

export async function fetchHistory(opts = {}) {
  const qs = buildHistoryQuery(opts);
  return apiFetch(`/history?${qs}`); // {items,total,page,page_size}
}

export function exportHistoryCsv(opts = {}) {
  const qs = buildHistoryQuery(opts);
  // navigazione hard redirect per forzare download
  window.location.href = `${API_BASE_URL}/history/export.csv?${qs}`;
}
