import { useMemo } from 'react'
import { useAuth } from './useAuth.jsx'

/**
 * Hook to determine if demo data should be shown
 * Returns true for:
 * - Users in VITE_DEMO_WHITELIST (comma-separated emails)
 * - Users with is_demo_allowed=true from backend
 * - When VITE_DEMO_MODE=true
 * - When ?demo=1 query parameter is present
 */
export function useDemoData() {
  let safeAuth = null
  try { 
    safeAuth = useAuth?.() ?? null 
  } catch {}
  const user = safeAuth?.user ?? null

  const env = import.meta?.env || {}
  const demoModeEnv = env?.VITE_DEMO_MODE === 'true'
  const whitelistStr = (env?.VITE_DEMO_WHITELIST || '').toString()
  const whitelist = useMemo(() => {
    return whitelistStr.toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
  }, [whitelistStr])
  const inWhitelist = !!user?.email && whitelist.includes(user.email.toLowerCase())
  const demoQuery = (() => {
    try { 
      if (typeof window === 'undefined') return false
      return new URLSearchParams(window.location.search).get('demo') === '1'
    } catch { 
      return false 
    }
  })()
  const serverFlag = user?.is_demo_allowed === true
  const enabled = demoModeEnv || demoQuery || serverFlag || inWhitelist
  if (env?.DEV) console.debug('[demo]', { enabled, demoModeEnv, demoQuery, serverFlag, inWhitelist, email: user?.email })
  return enabled
}

// Alias leggibile per compatibilità
export const useIsDemo = useDemoData
