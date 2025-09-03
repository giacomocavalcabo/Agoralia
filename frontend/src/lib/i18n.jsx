// Soluzione definitiva i18n con http-backend (a prova di Vercel)
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

console.log('[i18n] Initializing with http-backend solution...')

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en-US",
    supportedLngs: ["ar-EG","bg-BG","cs-CZ","da-DK","de-DE","el-GR","en-US","es-ES","et-EE","fi-FI","fr-FR","he-IL","hu-HU","id-ID","it-IT","ja-JP","ko-KR","lt-LT","lv-LV","nb-NO","nl-NL","pl-PL","pt-BR","pt-PT","ro-RO","ru-RU","sk-SK","sl-SI","sv-SE","th-TH","tr-TR","uk-UA","vi-VN","zh-HANS"],
    ns: ["common","pages","settings","billing"],
    defaultNS: "common",
    backend: {
      // Vercel serve /public come / - file statici sempre disponibili
      loadPath: `/locales/{{lng}}/{{ns}}.json?v=${import.meta.env.VITE_BUILD_ID ?? '1'}`,
      // Cache per performance
      requestOptions: {
        cache: 'default'
      }
    },
    interpolation: { escapeValue: false },
    debug: import.meta.env.DEV,
    returnEmptyString: false,
    react: { useSuspense: false }
  });

console.log('[i18n] i18n initialized with http-backend')

// Adapter per il vecchio hook `useI18n()` (compat)
import { useTranslation } from 'react-i18next'
export function useI18n(ns = "common") {
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
