import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { useDemoData } from './useDemoData'
import { generateDemoCampaigns } from './demo/fakes'

const adapt = (row) => row && ({
  id: row.id,
  name: row.name ?? '—',
  status: row.status ?? 'draft',
  created_at: row.created_at ?? null,
  budget_cap_cents: row.budget_cap_cents ?? null,
  budget_spent_cents: row.budget_spent_cents ?? null,
  segment: row.segment ?? {}
});

export function useCampaigns(params = {}) {
  const { page=1, perPage=25, q='', status } = params;
  const isDemo = useDemoData();
  return useQuery({
    queryKey: ['campaigns', page, perPage, q, status, isDemo],
    queryFn: async () => {
      if (isDemo) {
        const all = generateDemoCampaigns(40);
        const filtered = all.filter(c =>
          (!q || c.name.toLowerCase().includes(q.toLowerCase())) &&
          (!status || c.status === status)
        );
        const start = (page-1)*perPage;
        const results = filtered.slice(start, start+perPage).map(adapt);
        return { results, total: filtered.length, page, per_page: perPage };
      }
      const { data } = await api.get('/campaigns', { params: {
        page, per_page: perPage, q, status
      }});
      return {
        ...data,
        results: (data?.results || []).map(adapt).filter(Boolean)
      };
    },
    staleTime: 30_000
  });
}

export function usePatchCampaign() {
  const qc = useQueryClient();
  const isDemo = useDemoData();
  return useMutation({
    mutationFn: async ({ id, patch }) => {
      if (isDemo) {
        // Simula il PATCH in demo (ottimistico)
        return { id, ...patch };
      }
      const { data } = await api.patch(`/campaigns/${id}`, patch);
      return adapt(data);
    },
    onMutate: async ({ id, patch }) => {
      const keyPrefix = ['campaigns'];
      const snap = {};
      // ottimismo: aggiorna tutte le liste in cache
      const caches = qc.getQueriesData({ queryKey: keyPrefix });
      caches.forEach(([key, val]) => {
        snap[key] = val;
        qc.setQueryData(key, (old) => {
          if (!old?.results) return old;
          return {
            ...old,
            results: old.results.map(c => c.id === id ? { ...c, ...patch } : c)
          };
        });
      });
      return { snap };
    },
    onError: (_err, _vars, ctx) => {
      // rollback
      if (!ctx?.snap) return;
      Object.entries(ctx.snap).forEach(([key, val]) => {
        qc.setQueryData(key, val);
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });
}
