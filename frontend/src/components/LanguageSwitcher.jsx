import { useMemo } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { LANG_OPTIONS, displayLang } from '../lib/languages.js'

export default function LanguageSwitcher(){
  const { locale, setLocale } = useI18n()
  const options = useMemo(()=>LANG_OPTIONS, [])
  
  console.log('LanguageSwitcher rendered:', { locale, options }) // Debug
  
  return (
    <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1 bg-white">
      <span className="text-xs font-medium text-gray-600">🌐</span>
      <select
        aria-label="UI language"
        value={locale}
        onChange={(e)=> setLocale(e.target.value)}
        className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.locale} value={opt.locale}>
            {opt.code}
          </option>
        ))}
      </select>
    </div>
  )
}


