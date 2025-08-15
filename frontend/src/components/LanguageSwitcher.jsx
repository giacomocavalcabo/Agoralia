import { useMemo } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { LANG_OPTIONS, displayLang } from '../lib/languages.js'

export default function LanguageSwitcher({ className, style }) {
  const { locale, setLocale } = useI18n()
  const options = useMemo(() => LANG_OPTIONS, [])
  return (
    <select className={className || 'input'} value={locale} onChange={(e)=> setLocale(e.target.value)} style={style}>
      {options.map(({ locale: loc }) => (
        <option key={loc} value={loc}>{displayLang(loc)}</option>
      ))}
    </select>
  )
}


