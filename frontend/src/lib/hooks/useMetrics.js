import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { endpoints } from '../endpoints'

export function useMetricsDaily(days) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  useEffect(() => {
    let cancelled = false
    setState({ loading: true, data: null, error: null })
    apiRequest(endpoints.metrics.daily(days)).then((res) => {
      if (cancelled) return
      if (res.ok) setState({ loading: false, data: res.data, error: null })
      else setState({ loading: false, data: null, error: res.error })
    })
    return () => { cancelled = true }
  }, [days])
  return state
}

export function useMetricsOutcomes(days) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  useEffect(() => {
    let cancelled = false
    setState({ loading: true, data: null, error: null })
    apiRequest(endpoints.metrics.outcomes(days)).then((res) => {
      if (cancelled) return
      if (res.ok) setState({ loading: false, data: res.data, error: null })
      else setState({ loading: false, data: null, error: res.error })
    })
    return () => { cancelled = true }
  }, [days])
  return state
}


