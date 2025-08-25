import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApiWithDemo } from './demoGate'
import { useIsDemo } from './useDemoData'
import { useApiErrorHandler } from './useApiErrorHandler'

const DEFAULT_PAGE = 1
const DEFAULT_SIZE = 25

function mapResponseShape(res) {
  if (!res) return { data: [], total: 0 }
  if (Array.isArray(res)) return { data: res, total: res.length }
  if ('data' in res && Array.isArray(res.data)) return { data: res.data, total: Number(res.total ?? res.data.length) }
  if ('items' in res && Array.isArray(res.items)) return { data: res.items, total: Number(res.total ?? res.items.length) }
  return { data: [], total: 0 }
}

export function useCampaigns(params = {}) {
  const isDemo = useIsDemo()
  const { get } = useApiWithDemo()
  const { handleApiError } = useApiErrorHandler()

  const {
    page = DEFAULT_PAGE,
    pageSize = DEFAULT_SIZE,
    q = '',
    sortBy = 'created_at',
    sortDir = 'desc',
    filters = {}
  } = params

  const queryKey = useMemo(() => ([
    'campaigns', { page, pageSize, q, sortBy, sortDir, filters, isDemo }
  ]), [page, pageSize, q, sortBy, sortDir, filters, isDemo])

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      try {
        const search = {
          limit: pageSize,
          offset: (page - 1) * pageSize,
          q,
          sort: sortBy,
          dir: sortDir,
          ...filters
        }
        const res = await get('/campaigns', search, { signal })
        return mapResponseShape(res)
      } catch (error) {
        // Gestione robusta degli errori API
        const apiError = handleApiError(error, 'useCampaigns');
        console.error('[useCampaigns] API call failed:', apiError);
        throw error; // Rilancia per gestione TanStack Query
      }
    },
    staleTime: 60_000,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  })

  return {
    data: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  }
}
