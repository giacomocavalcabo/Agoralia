// frontend/src/pages/SettingsTelephony.jsx
import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { listNumbers, purchaseRetellNumber, importNumber, confirmImport, setRouting, listProviders, billingSummary } from '../lib/telephonyApi'
import NumbersTable from '../components/NumbersTable'
import BindControls from '../components/BindControls'
import ProviderAccounts from '../components/ProviderAccounts'
import NumberWizard from '../components/NumberWizard'
import CoveragePanel from '../components/CoveragePanel'
import { PhoneIcon, PlusIcon } from '@heroicons/react/24/outline'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

function e164OrThrow(input) {
  const p = parsePhoneNumberFromString(input || '')
  if (!p || !p.isValid()) throw new Error('E.164')
  return p.number
}

export default function SettingsTelephony() {
  const { t, i18n } = useTranslation('settings.telephony')
  const qc = useQueryClient()
  const [buy, setBuy] = useState({ country: 'US', type: 'local', area_code: '' })
  const [byo, setByo] = useState({ provider: 'twilio', e164: '' })
  const [confirm, setConfirm] = useState({ code: '' })
  const [route, setRoute] = useState({ numberId: '', inbound_agent_id: '', outbound_agent_id: '' })

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

  const { data, isLoading, error } = useQuery({
    queryKey: ['numbers'],
    queryFn: () => listNumbers(),
    staleTime: 60_000,
  })

  const hasLinked = (providers?.length ?? 0) > 0

  const mPurchase = useMutation({
    mutationFn: (body) => purchaseRetellNumber(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['numbers'] }),
  })
  const mImport = useMutation({
    mutationFn: (body) => importNumber({ ...body, e164: e164OrThrow(body.e164) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['numbers'] }),
  })
  const mConfirm = useMutation({ mutationFn: confirmImport })
  const mRoute = useMutation({
    mutationFn: ({ numberId, ...rest }) => setRouting(numberId, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['numbers'] }),
  })

  const numbers = data?.items || data || []

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('telephony.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('telephony.subtitle')}</p>
        </div>
      </header>

      {/* Policy Banner */}
      <div className="rounded-lg border p-3 bg-amber-50 text-amber-800 text-sm">
        <strong>{t('telephony.policy.title')}:</strong> {t('telephony.policy.no_outbound')}
      </div>

      {/* Provider Management */}
      <ProviderAccounts />
      
      {/* Gates condizionali */}
      {!hasLinked ? (
        <div className="rounded-lg border p-6 text-center bg-gray-50">
          <h3 className="text-lg font-medium mb-2">{t('connect_provider_title')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('connect_provider_desc')}</p>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            {t('connect_provider_cta')}
          </button>
        </div>
      ) : (
        <>
          {budget?.blocked && (
            <div className="rounded-lg border p-3 bg-red-50 text-red-800 text-sm">
              <strong>{t('billing.hard_stop_banner')}</strong>
              <a href="/settings/billing" className="ml-2 underline">Open Billing</a>
            </div>
          )}
          
          {/* Number Wizard */}
          <NumberWizard budget={budget} />
          
          {/* Coverage & Requirements */}
          <CoveragePanel />
        </>
      )}

      {/* Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Buy Retell */}
        <div className="rounded-2xl border p-4">
          <div className="font-medium mb-2">{t('telephony.buy.title')}</div>
          <div className="grid gap-2">
            <label className="text-sm">{t('telephony.buy.country')}</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" value={buy.country} onChange={e => setBuy(v => ({ ...v, country: e.target.value }))} placeholder="US, IT, GB..." />
            <label className="text-sm">{t('telephony.buy.type')}</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={buy.type} onChange={e => setBuy(v => ({ ...v, type: e.target.value }))}>
              <option value="local">{t('telephony.wizard.type.local')}</option>
              <option value="tollfree">{t('telephony.wizard.type.tollfree')}</option>
              <option value="mobile">{t('telephony.wizard.type.mobile')}</option>
            </select>
            <label className="text-sm">{t('telephony.buy.area_code')}</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" value={buy.area_code} onChange={e => setBuy(v => ({ ...v, area_code: e.target.value }))} placeholder="415, 02, ..." />
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              onClick={() => mPurchase.mutate(buy)}
              disabled={mPurchase.isPending}
            >
              <PlusIcon className="w-4 h-4 mr-1" /> {t('telephony.buy.cta')}
            </button>
            {mPurchase.isError && <div className="text-red-600 text-sm">{String(mPurchase.error?.message || 'Error')}</div>}
          </div>
        </div>

        {/* BYO */}
        <div className="rounded-2xl border p-4">
          <div className="font-medium mb-2">{t('telephony.byo.title')}</div>
          <div className="grid gap-2">
            <label className="text-sm">{t('telephony.byo.provider')}</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={byo.provider} onChange={e => setByo(v => ({ ...v, provider: e.target.value }))}>
              <option value="twilio">{t('telephony.providers.twilio')}</option>
              <option value="telnyx">{t('telephony.providers.telnyx')}</option>
              <option value="zadarma">{t('telephony.providers.zadarma')}</option>
            </select>
            <label className="text-sm">{t('telephony.byo.e164')}</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="+14155551234" value={byo.e164} onChange={e => setByo(v => ({ ...v, e164: e.target.value }))}/>
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mt-2" onClick={() => mImport.mutate(byo)} disabled={mImport.isPending}>
              {t('telephony.byo.cta')}
            </button>
            {mImport.isError && <div className="text-red-600 text-sm">{String(mImport.error?.message || 'Error')}</div>}

            <div className="mt-2">
              <label className="text-sm">{t('telephony.byo.code')}</label>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" value={confirm.code} onChange={e => setConfirm({ code: e.target.value })} placeholder="123456"/>
              <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed mt-2" onClick={() => mConfirm.mutate(confirm)} disabled={mConfirm.isPending}>
                {t('telephony.byo.confirm')}
              </button>
            </div>
          </div>
        </div>

        {/* Routing */}
        <div className="rounded-2xl border p-4">
          <div className="font-medium mb-2">{t('telephony.route.title')}</div>
          <div className="grid gap-2">
            <label className="text-sm">{t('telephony.route.number')}</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={route.numberId} onChange={e => setRoute(v => ({ ...v, numberId: e.target.value }))}>
              <option value="">{t('telephony.route.select')}</option>
              {numbers.map(n => <option key={n.id} value={n.id}>{n.e164} · {n.provider}</option>)}
            </select>
            {route.numberId && (
              <BindControls 
                number={numbers.find(n => n.id === route.numberId) || {}} 
              />
            )}
          </div>
        </div>
      </div>

      {/* Numbers table */}
      <div>
        <h2 className="text-sm font-semibold mb-2">{t('telephony.numbers')}</h2>
        <NumbersTable data={numbers} />
      </div>
    </div>
  )
}
