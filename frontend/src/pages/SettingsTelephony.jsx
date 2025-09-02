// frontend/src/pages/SettingsTelephony.jsx
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { listProviders, billingSummary, listNumbers, verifyCli, bindNumber } from '../lib/telephonyApi'
import NumbersTable from '../components/NumbersTable'
import ProviderAccounts from '../components/ProviderAccounts'
import NumberWizard from '../components/NumberWizard'
import CoveragePanel from '../components/CoveragePanel'
import Tooltip from '../components/ui/Tooltip'


export default function SettingsTelephony() {
  const { t } = useTranslation('settings')
  const qc = useQueryClient()



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

  const { data: numbersData } = useQuery({
    queryKey: ['numbers'],
    queryFn: listNumbers,
    staleTime: 60_000,
  })

  const hasLinked = (providers?.length ?? 0) > 0
  const numbers = numbersData?.items || numbersData || []

  // Mutations
  const verifyCliMutation = useMutation({
    mutationFn: verifyCli,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numbers'] })
    },
  })

  const bindNumberMutation = useMutation({
    mutationFn: ({ numberId, outboundEnabled }) => 
      bindNumber(numberId, { outbound_enabled: outboundEnabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numbers'] })
    },
  })

  // Handlers
  const handleAddNumber = () => {
    // Scroll to NumberWizard section
    const wizardSection = document.querySelector('[data-wizard-section]')
    if (wizardSection) {
      wizardSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleBuyNumber = () => {
    // Scroll to NumberWizard section
    const wizardSection = document.querySelector('[data-wizard-section]')
    if (wizardSection) {
      wizardSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleVerifyCli = (numberId) => {
    verifyCliMutation.mutate(numberId)
  }

  const handleToggleOutbound = (numberId, enabled) => {
    bindNumberMutation.mutate({ numberId, outboundEnabled: enabled })
  }

  return (
    <div className="max-w-5xl">
      {/* Header con badge + tooltip */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{t('telephony.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('telephony.subtitle')}</p>
        
        <div className="mt-4 flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 text-emerald-700 text-xs">
            <span>{t('telephony.zero_markup_badge')}</span>
            <Tooltip 
              label={t('telephony.zero_markup_tooltip')}
              ariaLabel={t('telephony.zero_markup_tooltip_aria')}
            >
              {t('telephony.zero_markup_tooltip_content')}
            </Tooltip>
            <span className="opacity-70">{t('telephony.zero_markup_sub')}</span>
          </div>
        </div>
      </div>

      {/* Provider accounts */}
      <section className="rounded-lg border bg-white p-4 mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{t('telephony.providers.title')}</h3>
        </div>
        <ProviderAccounts />
        
        {/* helper text ben allineato sotto al form */}
        <p className="mt-3 text-sm text-gray-600">
          {t('telephony.providers.helper_text')}
        </p>
      </section>

      {/* Se nessun provider connesso, empty card chiara */}
      {!hasLinked && (
        <div className="rounded-lg border bg-white p-6 text-center mb-6">
          <div className="text-lg font-medium">{t('telephony.connect_provider_title')}</div>
          <p className="mt-1 text-sm text-gray-600">
            {t('telephony.connect_provider_desc')}
          </p>
          <button className="btn btn-primary mt-4">
            {t('telephony.connect_provider_cta')}
          </button>
        </div>
      )}

      {/* Budget warning */}
      {hasLinked && budget?.blocked && (
        <div className="rounded-lg border p-3 bg-red-50 text-red-800 text-sm mb-6">
          <strong>{t('billing.hard_stop_banner')}</strong>
          <a href="/settings/billing" className="ml-2 underline">{t('billing.open_settings')}</a>
        </div>
      )}

      {/* Tabella numeri sempre visibile: se vuota mostra empty state con CTA */}
      {hasLinked && (
        <NumbersTable
          numbers={numbers}
          onAdd={handleAddNumber}
          onBuy={handleBuyNumber}
          onVerify={handleVerifyCli}
          onToggleOutbound={handleToggleOutbound}
        />
      )}

      {/* Coverage & Requirements */}
      {hasLinked && (
        <section className="rounded-lg border bg-white p-4 mt-6">
          <h3 className="text-base font-semibold mb-4">{t('telephony.coverage.title')}</h3>
          <CoveragePanel 
            onBuyWithProvider={handleBuyNumber}
            onAddExisting={handleAddNumber}
          />
        </section>
      )}

      {/* NumberWizard - sempre visibile quando ci sono provider */}
      {hasLinked && (
        <section className="rounded-lg border bg-white p-4 mt-6" data-wizard-section>
          <h3 className="text-base font-semibold mb-4">{t('telephony.wizard.title')}</h3>
          <NumberWizard budget={budget} />
        </section>
      )}
    </div>
  )
}
