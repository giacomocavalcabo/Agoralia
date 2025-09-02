// frontend/src/pages/SettingsTelephony.jsx
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { listProviders, billingSummary } from '../lib/telephonyApi'
import NumbersTable from '../components/NumbersTable'
import ProviderAccounts from '../components/ProviderAccounts'
import NumberWizard from '../components/NumberWizard'
import CoveragePanel from '../components/CoveragePanel'
import Tooltip from '../components/ui/Tooltip'


export default function SettingsTelephony() {
  const { t } = useTranslation('settings')


  // Gates condizionali per providers e budget
  const { data: providers } = useQuery({
    queryKey: ['telephony', 'providers'],
    queryFn: listProviders,
    staleTime: 60_000,
  })

  const { data: budget } = useQuery({
    queryKey: ['billing', 'summary'],
    queryFn: billingSummary,
    staleTime: 60_000,
  })

  const hasLinked = (providers?.length ?? 0) > 0

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('telephony.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('telephony.subtitle')}</p>
        </div>
      </header>

      {/* Zero Markup Badge */}
      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 text-emerald-700 text-xs">
        <span>{t('telephony.zero_markup_badge')}</span>
        <Tooltip content={t('telephony.zero_markup_tooltip')}>
          <span className="cursor-help opacity-70">?</span>
        </Tooltip>
        <span className="opacity-70">{t('telephony.zero_markup_sub')}</span>
      </div>

      {/* Provider Management */}
      <div className="space-y-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-4">{t('telephony.providers.title')}</h2>
          <ProviderAccounts />
        </div>
        
        {/* Gates condizionali */}
        {!hasLinked ? (
          <div className="rounded-lg border p-6 text-center bg-gray-50">
            <h3 className="text-lg font-medium mb-2">{t('telephony.connect_provider_title')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('telephony.connect_provider_desc')}</p>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              {t('telephony.connect_provider_cta')}
            </button>
          </div>
        ) : (
          <>
            {budget?.blocked && (
              <div className="rounded-lg border p-3 bg-red-50 text-red-800 text-sm">
                <strong>{t('billing.hard_stop_banner')}</strong>
                <a href="/settings/billing" className="ml-2 underline">{t('billing.open_settings')}</a>
              </div>
            )}
            
            {/* Numbers Management */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{t('telephony.numbers')}</h2>
                <div className="flex gap-2">
                  <NumberWizard budget={budget} />
                </div>
              </div>
              <NumbersTable />
            </div>
            
            {/* Coverage & Requirements */}
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-4">{t('telephony.coverage.title')}</h2>
              <CoveragePanel />
            </div>
          </>
        )}
      </div>


    </div>
  )
}
