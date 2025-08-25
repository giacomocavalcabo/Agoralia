// Unica sorgente di verità per i18n (react-i18next)
console.log('[i18n] File i18n.jsx is loading...')

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Autocarica TUTTE le JSON sotto /locales/<lang>/<ns>.json
console.log('[i18n] About to execute import.meta.glob...')
const modules = import.meta.glob('../../locales/*/*.json', { eager: true })
console.log('[i18n] import.meta.glob executed, modules:', modules)

// Debug: log dei moduli trovati
if (import.meta.env.DEV) {
  console.log('[i18n] Modules found:', Object.keys(modules))
}

const resources = {}
console.log('[i18n] Starting to process modules, count:', Object.keys(modules).length)
for (const [path, mod] of Object.entries(modules)) {
  // path es: ../../locales/en-US/pages.json
  const parts = path.split('/')
  const lang = parts[parts.length - 2]
  const file = parts[parts.length - 1]            // pages.json
  const ns = file.replace(/\.json$/,'')           // pages
  
  if (import.meta.env.DEV) {
    console.log(`[i18n] Processing: ${path} -> lang:${lang}, ns:${ns}`)
  }
  
  resources[lang] = resources[lang] || {}
  resources[lang][ns] = (mod && mod.default) || mod
}

// Debug: log delle risorse caricate
if (import.meta.env.DEV) {
  console.log('[i18n] Resources loaded:', resources)
  console.log('[i18n] EN-US namespaces:', Object.keys(resources['en-US'] || {}))
  console.log('[i18n] IT-IT namespaces:', Object.keys(resources['it-IT'] || {}))
}

const DEFAULT_NS = 'pages'
const FALLBACKS = ['en-US', 'it-IT']

if (!i18n.isInitialized) {
  console.log('[i18n] About to initialize i18n with resources:', resources)
  console.log('[i18n] Resources keys:', Object.keys(resources))
  console.log('[i18n] EN-US namespaces:', Object.keys(resources['en-US'] || {}))
  console.log('[i18n] IT-IT namespaces:', Object.keys(resources['it-IT'] || {}))
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: 'en-US',
      fallbackLng: FALLBACKS,
      ns: Object.keys(resources['en-US'] || { [DEFAULT_NS]: {} }),
      defaultNS: DEFAULT_NS,
      interpolation: { escapeValue: false },
      react: { useSuspense: false }, // niente suspense ⇒ niente bianchi
      debug: import.meta.env.DEV === true,
    })
    .then(() => {
      console.log('[i18n] i18n initialized successfully')
      console.log('[i18n] Available languages:', i18n.languages)
      console.log('[i18n] Current language:', i18n.language)
      console.log('[i18n] Loaded namespaces:', Object.keys(i18n.options.ns || {}))
    })
    .catch((error) => {
      console.error('[i18n] Failed to initialize i18n:', error)
    })
}

// Adapter per il vecchio hook `useI18n()` (compat)
import { useTranslation } from 'react-i18next'
export function useI18n(ns = DEFAULT_NS) {
  const { t, i18n: inst, ready } = useTranslation(ns)
  const setLocale = (lng) => {
    if (!lng || lng === inst.language) return
    inst.changeLanguage(lng)
    try { localStorage.setItem('app.lang', lng) } catch {}
  }
  return { t, i18n: inst, ready, locale: inst.language, setLocale }
}

// restore preferred language on boot
try {
  const saved = localStorage.getItem('app.lang')
  if (saved) i18n.changeLanguage(saved)
} catch {}


export default i18n
