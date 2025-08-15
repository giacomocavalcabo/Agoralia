import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api'

const I18nContext = createContext({ locale: 'en-US', dir: 'ltr', t: (k) => k, setLocale: () => {} })

const RTL_LOCALES = new Set(['ar', 'ar-EG', 'he', 'fa'])

// Lazy-load all locale JSON files under ../locales/**.json (no escaping needed)
const LOADERS = import.meta.glob('../locales/**/*.json', { eager: false })
const MODULE_CACHE = new Map()

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge(target, source) {
  const out = { ...target }
  for (const [k, v] of Object.entries(source || {})) {
    if (isObject(v) && isObject(out[k])) out[k] = deepMerge(out[k], v)
    else out[k] = v
  }
  return out
}

async function loadLocaleMessages(locale) {
  // Use cached merged messages if available
  const cacheKey = `merged:${locale}`
  if (MODULE_CACHE.has(cacheKey)) return MODULE_CACHE.get(cacheKey)

  // Gather loaders matching the locale folder
  const prefix = `../locales/${locale}/`
  const entries = Object.entries(LOADERS).filter(([path]) => path.startsWith(prefix))

  let merged = {}
  for (const [path, loader] of entries) {
    try {
      const mod = await loader()
      const json = (mod && (mod.default || mod)) || {}
      merged = deepMerge(merged, json)
    } catch (_) {
      // ignore broken file
    }
  }

  MODULE_CACHE.set(cacheKey, merged)
  return merged
}

async function loadWithFallbacks(locale) {
  // Merge from least specific to most specific so specific overrides fallback
  const base = locale.split('-')[0]
  const localesToTry = []
  if (!localesToTry.includes('en-US')) localesToTry.push('en-US')
  if (base && base !== 'en-US') localesToTry.push(base)
  if (!localesToTry.includes(locale)) localesToTry.push(locale)

  let out = {}
  for (const loc of localesToTry) {
    const msgs = await loadLocaleMessages(loc)
    out = deepMerge(out, msgs)
  }
  return out
}

function formatString(str, vars) {
  if (!vars) return str
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`))
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(() => localStorage.getItem('ui_locale') || 'en-US')
  const [messages, setMessages] = useState({})
  const dir = useMemo(() => (RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'), [locale])

  useEffect(() => {
    if (!localStorage.getItem('ui_locale')) {
      apiFetch('/settings')
        .then((r) => r.json())
        .then((s) => {
          if (s.default_lang) {
            setLocale(s.default_lang)
            localStorage.setItem('ui_locale', s.default_lang)
          }
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next = await loadWithFallbacks(locale)
      if (!cancelled) setMessages(next)
    })()
    document.documentElement.setAttribute('lang', locale)
    document.documentElement.setAttribute('dir', dir)
    localStorage.setItem('ui_locale', locale)
    return () => {
      cancelled = true
    }
  }, [locale, dir])

  function t(key, vars) {
    if (!messages) return key
    const parts = String(key).split('.')
    let cur = messages
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
        cur = cur[p]
      } else {
        return key
      }
    }
    if (typeof cur === 'string') return formatString(cur, vars)
    return key
  }

  const value = useMemo(() => ({ locale, dir, t, setLocale }), [locale, dir, messages])
  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}


