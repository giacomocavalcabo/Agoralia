import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getTranslation, interpolate, isRtl } from './i18n.js'

const I18nCtx = createContext({ 
  t: (k, params, nsList) => k, 
  locale: 'en-US', 
  setLocale: () => {},
  dir: 'ltr'
})

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(localStorage.getItem('ui_locale') || 'en-US')
  
  // Set document attributes when locale changes
  useEffect(() => {
    localStorage.setItem('ui_locale', locale)
    document.documentElement.lang = locale
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
  }, [locale])

  function t(key, params = {}, nsList = ['common']) {
    const translation = getTranslation(key, locale, nsList)
    
    if (translation === null) {
      // Dev warning for missing keys
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing key: ${key} for locale: ${locale}`)
      }
      return key // Fallback to key itself
    }
    
    // Apply interpolation if params provided
    return params && Object.keys(params).length > 0 
      ? interpolate(translation, params)
      : translation
  }

  const value = useMemo(() => ({
    t,
    locale,
    setLocale,
    dir: isRtl(locale) ? 'rtl' : 'ltr'
  }), [locale])

  return (
    <I18nCtx.Provider value={value}>
      {children}
    </I18nCtx.Provider>
  )
}

export function useI18n(requiredNs = ['common']) {
  const { t, locale, setLocale, dir } = useContext(I18nCtx)
  
  // Enhanced t function that automatically includes required namespaces
  const tWithNs = (key, params) => t(key, params, requiredNs)
  
  return { 
    t: tWithNs, 
    locale, 
    setLocale, 
    dir 
  }
}
