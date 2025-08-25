import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

// Default values for unspecified countries
export const RULES_V1_DEFAULT = {
  regime_b2c: 'unspecified',
  regime_b2b: 'unspecified',
  ai_disclosure: 'unspecified',
  recording_basis: 'unspecified',
  flags: {
    requires_consent_b2c: false,
    requires_consent_b2b: false,
    requires_dnc_scrub: false,
    allows_automated: true,
    recording_requires_consent: false,
    has_quiet_hours: false
  },
  dnc: [],
  quiet_hours: null
}

/**
 * Hook to fetch country rules v1 from backend
 * @param {string[]} isoList - List of ISO country codes
 * @returns {object} Query result with rules data
 */
export function useCountryRulesV1(isoList = []) {
  const q = isoList?.length ? `?iso=${isoList.join(',')}` : ''
  
  return useQuery({
    queryKey: ['country-rules-v1', isoList?.sort().join(',')],
    queryFn: async () => {
      const response = await api.get(`/compliance/rules/v1${q}`)
      return response.rules || {}
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    enabled: true, // Always enabled
  })
}

/**
 * Get rule for specific country with fallback to defaults
 * @param {object} rules - Rules data from useCountryRulesV1
 * @param {string} iso - ISO country code
 * @returns {object} Rule data or default
 */
export function getRuleV1(rules, iso) {
  if (!iso || !rules) return RULES_V1_DEFAULT
  
  const rule = rules[iso.toUpperCase()]
  return rule || RULES_V1_DEFAULT
}

/**
 * Get unique ISO codes from phone numbers
 * @param {Array} rows - Array of contact rows
 * @returns {string[]} Unique ISO codes
 */
export function getUniqueISOs(rows) {
  const isos = new Set()
  
  rows.forEach(row => {
    if (row.country_iso) {
      isos.add(row.country_iso.toUpperCase())
    }
  })
  
  return Array.from(isos)
}
