// frontend/src/pages/SettingsTelephony.jsx
import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { listNumbers, purchaseRetellNumber, importNumber, confirmImport, setRouting } from '../lib/numbersApi'
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
  const { t, i18n } = useTranslation('pages')
  const qc = useQueryClient()
  const [buy, setBuy] = useState({ country: 'US', type: 'local', area_code: '' })
  const [byo, setByo] = useState({ provider: 'twilio', e164: '' })
  const [confirm, setConfirm] = useState({ code: '' })
  const [route, setRoute] = useState({ numberId: '', inbound_agent_id: '', outbound_agent_id: '' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['numbers'],
    queryFn: () => listNumbers(),
    staleTime: 60_000,
  })

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
                  <h1 className="text-xl font-semibold">{t('settings.telephony.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.telephony.subtitle')}</p>
        </div>
      </header>

      {/* Policy Banner */}
      <div className="rounded-lg border p-3 bg-amber-50 text-amber-800 text-sm">
        <strong>{t('settings.telephony.policy.title')}:</strong> {t('settings.telephony.policy.no_outbound')}
      </div>

      {/* Provider Management */}
      <ProviderAccounts />
      
      {/* Number Wizard */}
      <NumberWizard />

      {/* Coverage & Requirements */}
      <CoveragePanel />

      {/* Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Buy Retell */}
        <div className="rounded-2xl border p-4">
          <div className="font-medium mb-2">{t('settings.telephony.buy.title')}</div>
          <div className="grid gap-2">
            <label className="text-sm">{t('settings.telephony.buy.country')}</label>
            <input className="input" value={buy.country} onChange={e => setBuy(v => ({ ...v, country: e.target.value }))} placeholder="US, IT, GB..." />
            <label className="text-sm">{t('settings.telephony.buy.type')}</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={buy.type} onChange={e => setBuy(v => ({ ...v, type: e.target.value }))}>
              <option value="local">Local</option>
              <option value="tollfree">Toll-free</option>
              <option value="mobile">Mobile</option>
            </select>
            <label className="text-sm">{t('settings.telephony.buy.area_code')}</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" value={buy.area_code} onChange={e => setBuy(v => ({ ...v, area_code: e.target.value }))} placeholder="415, 02, ..." />
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              onClick={() => mPurchase.mutate(buy)}
              disabled={mPurchase.isPending}
            >
              <PlusIcon className="w-4 h-4 mr-1" /> {t('settings.telephony.buy.cta')}
            </button>
            {mPurchase.isError && <div className="text-red-600 text-sm">{String(mPurchase.error?.message || 'Error')}</div>}
          </div>
        </div>

        {/* BYO */}
        <div className="rounded-2xl border p-4">
          <div className="font-medium mb-2">{t('settings.telephony.byo.title')}</div>
          <div className="grid gap-2">
            <label className="text-sm">{t('settings.telephony.byo.provider')}</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={byo.provider} onChange={e => setByo(v => ({ ...v, provider: e.target.value }))}>
              <option value="twilio">Twilio</option>
              <option value="telnyx">Telnyx</option>
              <option value="zadarma">Zadarma</option>
            </select>
            <label className="text-sm">{t('settings.telephony.byo.e164')}</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="+14155551234" value={byo.e164} onChange={e => setByo(v => ({ ...v, e164: e.target.value }))}/>
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mt-2" onClick={() => mImport.mutate(byo)} disabled={mImport.isPending}>
              {t('settings.telephony.byo.cta')}
            </button>
            {mImport.isError && <div className="text-red-600 text-sm">{String(mImport.error?.message || 'Error')}</div>}

            <div className="mt-2">
              <label className="text-sm">{t('settings.telephony.byo.code')}</label>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" value={confirm.code} onChange={e => setConfirm({ code: e.target.value })} placeholder="123456"/>
              <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed mt-2" onClick={() => mConfirm.mutate(confirm)} disabled={mConfirm.isPending}>
                {t('settings.telephony.byo.confirm')}
              </button>
            </div>
          </div>
        </div>

        {/* Routing */}
        <div className="rounded-2xl border p-4">
          <div className="font-medium mb-2">{t('settings.telephony.route.title')}</div>
          <div className="grid gap-2">
            <label className="text-sm">{t('settings.telephony.route.number')}</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={route.numberId} onChange={e => setRoute(v => ({ ...v, numberId: e.target.value }))}>
              <option value="">{t('settings.telephony.route.select')}</option>
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
        <h2 className="text-sm font-semibold mb-2">{t('settings.telephony.numbers')}</h2>
        <NumbersTable data={numbers} />
      </div>
    </div>
  )
}
