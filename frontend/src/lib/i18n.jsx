// Unica sorgente di verità per i18n (react-i18next)
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Autocarica TUTTE le JSON sotto /src/locales/<lang>/<ns>.json
const modules = import.meta.glob('../locales/**/**/*.json', { eager: true })
const resources = {}
for (const [path, mod] of Object.entries(modules)) {
  // path es: ../locales/en-US/pages.json
  const parts = path.split('/')
  const lang = parts[parts.length - 2]
  const file = parts[parts.length - 1]            // pages.json
  const ns = file.replace(/\.json$/,'')           // pages
  resources[lang] = resources[lang] || {}
  resources[lang][ns] = (mod && mod.default) || mod
}

const DEFAULT_NS = 'pages'
const FALLBACKS = ['en-US', 'it-IT']

if (!i18n.isInitialized) {
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
}

// Adapter per il vecchio hook `useI18n()` (compat)
import { useTranslation } from 'react-i18next'
export function useI18n(ns = DEFAULT_NS) {
  const { t, i18n: inst, ready } = useTranslation(ns)
  return { t, i18n: inst, ready, locale: inst.language }
}



export default i18n
