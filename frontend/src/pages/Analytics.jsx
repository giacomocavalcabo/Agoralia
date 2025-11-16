import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { useToast } from '../components/ToastProvider.jsx'
import { useI18n } from '../lib/i18n.jsx'

export default function Analytics() {
  const { t } = useI18n()
  const [ent, setEnt] = useState({ analytics_advanced: false })
  const toast = useToast()
  useEffect(() => {
    apiRequest('/billing/entitlements').then((r) => {
      if (r.ok && r.data) setEnt(r.data)
      else { setEnt({ analytics_advanced: false }); if (!r.ok) toast.error(`Entitlements: ${r.error}`) }
    })
  }, [])
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


