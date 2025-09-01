import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiWithDemo } from './demoGate'
import { useIsDemo } from './useDemoData'
import { makeNumbers } from './demo/fakes'

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
      if (isDemo) {
        // Demo data with safe fields only
        const demoData = makeNumbers({ total: 25 })
        return { data: demoData, total: demoData.length }
      }

      const search = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        q,
        sort: sortBy,
        dir: sortDir,
        ...filters
      }
      const res = await get('/settings/telephony/numbers', search, { signal })
      const data = mapResponseShape(res).data.map(n => ({
        id: n.id,
        e164: n.e164,
        country_iso: n.country_iso || n.country,
        provider: n.provider || n.carrier || '—',
        capabilities: n.capabilities || [],
        created_at: n.created_at || n.purchased_at || null,
        source: n.source,
        verified: n.verified,
        can_inbound: n.can_inbound
      }))
      return { data, total: res?.total ?? data.length }
    },
    staleTime: 30_000,
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

export function useReleaseNumber() {
  const queryClient = useQueryClient()
  const { post } = useApiWithDemo()
  
  return useMutation({
    mutationFn: async (id) => {
      // Try DELETE first, fallback to POST /release
      try {
        return await post(`/numbers/${id}/release`, {})
      } catch {
        return await post(`/numbers/${id}/release`, {})
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] })
    }
  })
}
