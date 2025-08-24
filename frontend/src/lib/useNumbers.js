import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApiWithDemo } from './demoGate'
import { useIsDemo } from './useDemoData'

const DEFAULT_PAGE = 1
const DEFAULT_SIZE = 25

function mapResponseShape(res) {
  if (!res) return { data: [], total: 0 }
  if (Array.isArray(res)) return { data: res, total: res.length }
  if ('data' in res && Array.isArray(res.data)) return { data: res.data, total: Number(res.total ?? res.data.length) }
  if ('items' in res && Array.isArray(res.items)) return { data: res.items, total: Number(res.total ?? res.items.length) }
  return { data: [], total: 0 }
}

export function useNumbers(params = {}) {
  const isDemo = useIsDemo()
  const { get } = useApiWithDemo()

  const {
    page = DEFAULT_PAGE,
    pageSize = DEFAULT_SIZE,
    q = '',
    sortBy = 'e164',
    sortDir = 'asc',
    filters = {}
  } = params

  const queryKey = useMemo(() => ([
    'numbers', { page, pageSize, q, sortBy, sortDir, filters, isDemo }
  ]), [page, pageSize, q, sortBy, sortDir, filters, isDemo])

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const search = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        q,
        sort: sortBy,
        dir: sortDir,
        ...filters
      }
      const res = await get('/numbers', search, { signal })
      return mapResponseShape(res)
    },
    staleTime: 60_000,
    retry: 1
  })

  return {
    data: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  }
}
