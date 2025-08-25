import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from './api';
import { useIsDemo } from './useDemoData';
import { generateDemoCalendarEvents } from './demo/fakes';

export function useCalendarEvents({ from, to, scope = 'tenant', campaignId }){
  const isDemo = useIsDemo();
  return useQuery({
    queryKey: ['calendar', { from, to, scope, campaignId, isDemo }],
    queryFn: async () => {
      if (isDemo) return { events: generateDemoCalendarEvents({ start: from, end: to }) };
      const qs = new URLSearchParams({ start: from.toISOString(), end: to.toISOString(), scope });
      if (campaignId) qs.set('campaign_id', campaignId);
      const res = await api.get(`/calendar?${qs.toString()}`);
      return res.data || { events: [] };
    }
  });
}

export function useQuickSchedule(){
  // tenta POST /calendar/events, fallback a /schedule se non disponibile
  return useMutation({
    mutationFn: async (payload) => {
      try {
        return (await api.post('/calendar/events', payload)).data;
      } catch (e) {
        if (e?.status === 404 || e?.status === 405) {
          return (await api.post('/schedule', payload)).data; // fallback legacy
        }
        throw e;
      }
    }
  });
}
