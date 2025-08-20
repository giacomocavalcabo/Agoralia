import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { loadLocale, getDict, getFallbackChain, interpolate, isRtl } from './i18n.js'

const I18nCtx = createContext({ 
  t: (k, params) => k, 
  locale: 'en-US', 
  setLocale: () => {},
  dir: 'ltr',
  ready: false
})

export function I18nProvider({ defaultLocale = 'en-US', children }) {
  const [locale, setLocale] = useState(() => localStorage.getItem('ui_locale') || defaultLocale)
  const [ready, setReady] = useState(false)
  
  // Load locale when it changes
  useEffect(() => {
    (async () => {
      setReady(false)
      try {
        const resources = await loadLocale(locale)
        // Set document attributes
        document.documentElement.lang = locale
        document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
        localStorage.setItem('ui_locale', locale)
        setReady(true)
        console.log(`[i18n] Locale ${locale} loaded successfully`)
        console.info('[i18n] Namespaces loaded for', locale, Object.keys(resources))
      } catch (error) {
        console.error(`[i18n] Failed to load locale ${locale}:`, error)
        // Fallback to default locale
        if (locale !== defaultLocale) {
          setLocale(defaultLocale)
        }
      }
    })()
  }, [locale, defaultLocale])

  const t = useMemo(() => {
    return (key, params = {}) => {
      // Support both "ns.key" and "key" (defaults to common namespace)
      const parts = key.split('.')
      let ns, k
      
      if (parts.length > 1) {
        // "ns.key" format
        ns = parts[0]
        k = parts.slice(1).join('.')
      } else {
        // "key" format - use common namespace
        ns = 'common'
        k = key
      }
      
      // Try fallback chain: locale → base → en-US
      for (const fallbackLocale of getFallbackChain(locale)) {
        const dict = getDict(fallbackLocale, ns)
        if (!dict) continue
        
        // Deep lookup for nested keys (e.g., "auth.sign_in_title")
        const keyParts = k.split('.')
        let value = dict
        
        for (const part of keyParts) {
          value = value?.[part]
          if (value === undefined) break
        }
        
        if (typeof value === 'string') {
          // Apply interpolation if params provided
          return params && Object.keys(params).length > 0 
            ? interpolate(value, params)
            : value
        }
      }
      
      // Key not found - log warning in dev, return key in prod
      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing key: "${key}" for locale: ${locale}`)
      }
      return key // Fallback to key itself
    }
  }, [locale])

  const value = useMemo(() => ({
    t,
    locale,
    setLocale,
    dir: isRtl(locale) ? 'rtl' : 'ltr',
    ready
  }), [t, locale, ready])

  return (
    <I18nCtx.Provider value={value}>
      {children}
    </I18nCtx.Provider>
  )
}

export function useI18n(requiredNs = ['common']) {
  const { t, locale, setLocale, dir, ready } = useContext(I18nCtx)
  
  // Enhanced t function that automatically includes required namespaces
  const tWithNs = (key, params) => t(key, params)
  
  return { 
    t: tWithNs, 
    locale, 
    setLocale, 
    dir,
    ready
  }
}
