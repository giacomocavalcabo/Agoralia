import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './useAuth';
import { useIsDemo } from './useDemoData';

export function useKbProgress() {
  const isDemo = useIsDemo();
  const { workspaceId } = useAuth() || {};

  return useQuery({
    queryKey: ['kb','progress', workspaceId, isDemo],
    queryFn: async () => {
      if (isDemo) {
        // demo "ricca" e sempre disponibile
        return {
          items: [
            { kb_id: 'kb_demo_company', name: 'Company Profile', kind: 'company', completeness_pct: 0.82, freshness_score: 0.74 },
            { kb_id: 'kb_demo_offers',  name: 'Offer Packs',    kind: 'offers',  completeness_pct: 0.67, freshness_score: 0.59 },
          ],
        };
      }
      try {
        const { data } = await api.get('/kb/progress', {
          headers: workspaceId ? { 'X-Workspace-Id': workspaceId } : {},
        });
        return data;
      } catch (e) {
        // 401/422 => degrada a "vuoto" ma NON white-screen
        if (e?.response?.status === 401 || e?.response?.status === 422) {
          return { items: [] };
        }
        throw e;
      }
    },
    staleTime: 30_000,
  });
}
