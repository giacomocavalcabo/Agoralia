import { useEffect, useMemo, useRef, useState } from 'react';
import { useDemoData } from './useDemoData';
import { generateDemoLeads } from './demo/fakes';
import { leadsSegmentToQuery } from './filters/leadsSegment';

const DEFAULT_SIZE = Number(import.meta.env.VITE_LEADS_PAGE_SIZE_DEFAULT) || 25;
const API_BASE = '/api'; // Always use relative path for proxy

function adaptLead(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || row.full_name || '—',
    email: row.email || null,
    company: row.company || null,
    phone_e164: row.phone_e164 || row.phone || null,
    country_iso: row.country_iso || null,
    contact_class: row.contact_class || 'unknown',
    known: typeof row.known === 'boolean' ? row.known : null,
    opt_in: typeof row.opt_in === 'boolean' ? row.opt_in : null,
    national_dnc: row.national_dnc || 'unknown',
    compliance_category: row.compliance_category || 'allowed',
    compliance_reasons: Array.isArray(row.compliance_reasons) ? row.compliance_reasons : [],
    status: row.status || 'new',
    stage: row.stage || 'cold',
    campaign: row.campaign || null,
    owner: row.owner || null,
    last_contact: row.last_contact || row.updated_at || null,
    score: Number.isFinite(row.score) ? row.score : null,
  };
}

export function useLeads(initial = {}) {
  const isDemo = useDemoData();
  const [page, setPage] = useState(initial.page || 1);
  const [pageSize, setPageSize] = useState(initial.pageSize || DEFAULT_SIZE);
  const [sort, setSort] = useState(initial.sort || '');
  const [dir, setDir] = useState(initial.dir || 'asc');
  const [search, setSearch] = useState(initial.search || '');
  const [filters, setFilters] = useState(initial.filters || {}); // {status, campaign, owner, stage, country, contact_class, compliance_category}

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setLoading] = useState(false);
  const [isError, setError] = useState(null);
  const abortRef = useRef(null);

  const query = useMemo(() => ({ page, pageSize, sort, dir, search, filters }), [page, pageSize, sort, dir, search, filters]);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        if (isDemo) {
          // client-side filtering/paging for demo
          const all = generateDemoLeads(0).filter((r) => {
            const q = search?.trim().toLowerCase();
            const okQ = !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.phone_e164 || r.phone || '').includes(q);
            const okStatus = !filters.status || r.status === filters.status;
            const okCampaign = !filters.campaign || r.campaign === filters.campaign;
            const okOwner = !filters.owner || r.owner === filters.owner;
            const okStage = !filters.stage || r.stage === filters.stage;
            const okIso = !filters.country || r.country_iso === filters.country;
            const okClass = !filters.contact_class || r.contact_class === filters.contact_class;
            const okCat = !filters.compliance_category || r.compliance_category === filters.compliance_category;
            return okQ && okStatus && okCampaign && okOwner && okStage && okIso && okClass && okCat;
          });
          const start = (page - 1) * pageSize;
          const paged = all.slice(start, start + pageSize);
          setRows(paged.map(adaptLead));
          setTotal(all.length);
          setLoading(false);
          return;
        }

        const qs = new URLSearchParams();
        const offset = Math.max(0, (page - 1) * pageSize);
        qs.set('limit', String(pageSize));
        qs.set('offset', String(offset));
        if (search) qs.set('query', search);
        if (sort) {
          qs.set('sort', sort);
          qs.set('dir', dir);
        }
        // Apply segment filters using the adapter
        if (filters.segment) {
          const segmentQs = leadsSegmentToQuery(filters.segment);
          for (const [k, v] of segmentQs) {
            qs.set(k, v);
          }
        }
        
        // Apply legacy filters for backward compatibility
        Object.entries(filters || {}).forEach(([k, v]) => {
          if (k !== 'segment' && v != null && v !== '') qs.set(k, String(v));
        });

        const auth = JSON.parse(localStorage.getItem('auth') || '{}');
        const workspaceId = auth?.user?.workspace_id;
        const res = await fetch(`${API_BASE}/leads?${qs.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list = json?.data || json?.items || [];
        setRows(list.map(adaptLead).filter(Boolean));
        setTotal(json?.total ?? list.length);
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err);
        setLoading(false);
      }
    };
    run();

    return () => controller.abort();
  }, [isDemo, page, pageSize, sort, dir, search, JSON.stringify(filters)]);

  function sortBy(column) {
    if (sort !== column) {
      setSort(column);
      setDir('asc');
    } else {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    }
  }

  function resetPage() {
    setPage(1);
  }

  return {
    rows, total,
    page, setPage,
    pageSize, setPageSize,
    sort, dir, sortBy,
    search, setSearch,
    filters, setFilters,
    isLoading, isError,
    resetPage,
  };
}
