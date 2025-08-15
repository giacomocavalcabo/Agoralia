import { useEffect } from 'react'
import { useI18n } from '../lib/i18n.jsx'

export default function SaveBar({ dirty, saving, onSave, onReset, description }) {
  const { t } = useI18n()
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
  if (!dirty && !saving) return null
  return (
    <div role="region" aria-live="polite" style={{ position:'sticky', bottom: 0, zIndex: 50, width:'100%', maxWidth:'100%' }}>
      <div className="panel" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', maxWidth:'100%' }}>
        <div style={{ color:'#6b7280' }}>{description || (dirty ? t('pages.settings.unsaved') : t('common.saving'))}</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={onReset} disabled={saving}>{t('common.clear')}</button>
          <button className="btn primary" onClick={onSave} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</button>
        </div>
      </div>
    </div>
  )
}


