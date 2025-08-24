import { useQuery } from '@tanstack/react-query';
import { useApiWithDemo } from './demoGate';
import { useAuth } from './useAuth';

export function useCampaigns({ page = 1, pageSize = 25, q = '', sort = 'created_at', dir = 'desc' }) {
  const { get, isDemo } = useApiWithDemo();
  const { user } = useAuth();

  const enabled = !!user?.id && !isDemo;

  const query = useQuery({
    queryKey: ['campaigns', { page, pageSize, q, sort, dir }],
    enabled,
    queryFn: async () => {
      const params = { 
        limit: pageSize, 
        offset: (page - 1) * pageSize, 
        q, 
        sort, 
        dir 
      };
      const res = await get('/campaigns', { params });
      // support both shapes
      const data = res?.data?.data || res?.data?.items || res?.data || [];
      const total = res?.data?.total ?? data.length;
      return { rows: data, total };
    },
    staleTime: 15_000
  });

  if (!enabled) {
    return { 
      rows: [], 
      total: 0, 
      isLoading: false, 
      isError: false, 
      refetch: () => {} 
    };
  }
  
  return {
    rows: query.data?.rows || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch
  };
}
