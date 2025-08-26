// Unica sorgente di verità per i18n (react-i18next)
console.log('[i18n] File i18n.jsx is loading...')

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Import esplicito delle traduzioni (fallback se glob non funziona)
console.log('[i18n] About to load translations...')

// Fallback: import esplicito per le lingue principali
let resources = {}

// Funzione asincrona per caricare le traduzioni
async function loadTranslations() {
  try {
    // Prova prima il glob con alias
    console.log('[i18n] Trying import.meta.glob with @locales alias...')
    const modules = import.meta.glob('@locales/**/*.json', { eager: true, import: 'default' })
    console.log('[i18n] import.meta.glob executed, modules:', modules)
    console.log('[i18n] Modules found:', Object.keys(modules).length)
    
    if (Object.keys(modules).length > 0) {
      // Processa i moduli trovati
      for (const [path, mod] of Object.entries(modules)) {
        const parts = path.split('/')
        const lang = parts[parts.length - 2]
        const file = parts[parts.length - 1]
        const ns = file.replace(/\.json$/, '')
        
        if (import.meta.env.DEV) {
          console.log(`[i18n] Processing: ${path} -> lang:${lang}, ns:${ns}`)
        }
        
        resources[lang] = resources[lang] || {}
        resources[lang][ns] = (mod && mod.default) || mod
      }
    } else {
      // Fallback: import esplicito
      console.log('[i18n] Glob failed, using explicit imports...')
      throw new Error('Glob found 0 modules, using fallback')
    }
  } catch (error) {
    console.log('[i18n] Fallback to explicit imports:', error.message)
    
    // Import esplicito per EN-US
    try {
      const enPages = await import('@locales/en-US/pages.json')
      const enAuth = await import('@locales/en-US/auth.json')
      const enCommon = await import('@locales/en-US/common.json')
      
      resources['en-US'] = {
        pages: enPages.default || enPages,
        auth: enAuth.default || enAuth,
        common: enCommon.default || enCommon
      }
      console.log('[i18n] EN-US loaded via explicit imports')
    } catch (e) {
      console.error('[i18n] Failed to load EN-US:', e.message)
    }
    
    // Import esplicito per IT-IT
    try {
      const itPages = await import('@locales/it-IT/pages.json')
      const itAuth = await import('@locales/it-IT/auth.json')
      const itCommon = await import('@locales/it-IT/common.json')
      
      resources['it-IT'] = {
        pages: itPages.default || itPages,
        auth: itAuth.default || itAuth,
        common: itCommon.default || itCommon
      }
      console.log('[i18n] IT-IT loaded via explicit imports')
    } catch (e) {
      console.error('[i18n] Failed to load IT-IT:', e.message)
    }
  }
  
  return resources
}

// Carica le traduzioni e poi inizializza i18n
loadTranslations().then(() => {
  console.log('[i18n] Translations loaded, initializing i18n...')
  console.log('[i18n] Resources loaded:', resources)
  console.log('[i18n] EN-US namespaces:', Object.keys(resources['en-US'] || {}))
  console.log('[i18n] IT-IT namespaces:', Object.keys(resources['it-IT'] || {}))
  
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
        fallbackLng: ['en-US', 'it-IT'],
        ns: Object.keys(resources['en-US'] || { pages: {} }),
        defaultNS: 'pages',
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
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
}).catch(error => {
  console.error('[i18n] Failed to load translations:', error)
})

// Codice rimosso - ora gestito nella funzione loadTranslations()

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
