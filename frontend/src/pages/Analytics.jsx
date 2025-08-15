import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useI18n } from '../lib/i18n.jsx'

export default function Analytics() {
  const { t } = useI18n()
  const [ent, setEnt] = useState({ analytics_advanced: false })
  useEffect(() => { apiFetch('/entitlements').then(r=>r.json()).then(setEnt).catch(()=>{}) }, [])
  return (
    <div>
      <h1>
        {t('pages.analytics.title')}
        {!ent.analytics_advanced && (
          <span className="badge" style={{ marginLeft:8, background:'#fff7ed' }} title={t('pages.analytics.pro_badge_tooltip')}>
            {t('pages.analytics.limited')}
          </span>
        )}
      </h1>
      <p>{t('pages.analytics.metrics_description')}</p>
      {!ent.analytics_advanced && <div style={{ marginTop:8, color:'#6b7280' }}>{t('pages.analytics.upgrade_cta')}</div>}
    </div>
  )
}


