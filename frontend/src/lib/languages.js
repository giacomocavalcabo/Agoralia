export const LANG_OPTIONS = [
  { locale: 'en-US', code: 'EN', label: 'English' },
  { locale: 'it-IT', code: 'IT', label: 'Italiano' },
  { locale: 'fr-FR', code: 'FR', label: 'Français' },
  { locale: 'ar-EG', code: 'EG', label: 'العربية' },
  { locale: 'hi-IN', code: 'HI', label: 'हिन्दी' },
]

export function displayLang(locale) {
  const found = LANG_OPTIONS.find((l) => l.locale === locale)
  if (!found) return locale
  return `${found.label} (${found.code})`
}


