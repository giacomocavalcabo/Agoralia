import { useMemo } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { LANG_OPTIONS, displayLang } from '../lib/languages.js'

export default function LanguageSwitcher(){
  const { locale, setLocale } = useI18n()
  const options = useMemo(()=>LANG_OPTIONS, [])
  return (
    <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
      <span className="kpi-title" style={{ opacity:.8 }}>UI</span>
      <select
        aria-label="UI language"
        value={locale}
        onChange={(e)=> setLocale(e.target.value)}
        style={{
          padding:'6px 10px',
          border:'1px solid var(--border)',
          borderRadius:8,
          background:'var(--surface)',
          fontWeight:600
        }}
      >
        {options.map(opt => (
          <option key={opt.locale} value={opt.locale}>{displayLang(opt.locale)}</option>
        ))}
      </select>
    </label>
  )
}


