import React from 'react'
import { useTranslation } from 'react-i18next'
import NumbersEmpty from './NumbersEmpty'
import Tooltip from './ui/Tooltip'
import NumbersRowActions from './NumbersRowActions'

export default function NumbersTable({ 
  numbers = [], 
  onAdd, 
  onBuy, 
  onVerify, 
  onToggleOutbound 
}) {
  const { t } = useTranslation('settings')
  
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{t('telephony.numbers')}</h3>
      </div>

      {(!numbers || numbers.length === 0) ? (
        <NumbersEmpty onAdd={onAdd} onBuy={onBuy} />
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">{t('telephony.numbers_columns.number')}</th>
                <th className="px-3 py-2 text-left">{t('telephony.numbers_columns.provider')}</th>
                <th className="px-3 py-2 text-left">{t('telephony.numbers_columns.status')}</th>
                <th className="px-3 py-2 text-left">
                  {t('telephony.numbers_columns.outbound')}
                  <Tooltip 
                    label={t('telephony.outbound_tooltip')}
                    ariaLabel={t('telephony.outbound_tooltip_aria')}
                  >
                    {t('telephony.outbound_tooltip_content')}
                  </Tooltip>
                </th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {numbers.map(n => {
                const canOutbound = !!(n.hosted || n.verified_cli)
                return (
                  <tr key={n.id} className="border-t">
                    <td className="px-3 py-2 font-medium font-mono">{n.e164}</td>
                    <td className="px-3 py-2">{n.provider}</td>
                    <td className="px-3 py-2">
                      {n.hosted && (
                        <span className="mr-2 rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 text-xs">
                          {t('telephony.status.hosted')}
                        </span>
                      )}
                      {n.verified_cli && (
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700 text-xs">
                          {t('telephony.status.verified_cli')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!n.outbound_enabled}
                          disabled={!canOutbound}
                          onChange={(e) => onToggleOutbound && onToggleOutbound(n.id, e.target.checked)}
                        />
                        <span className={`text-xs ${canOutbound ? "text-gray-700" : "text-amber-700"}`}>
                          {canOutbound ? t('telephony.outbound.enabled') : t('telephony.outbound.requires_verification')}
                        </span>
                      </label>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <NumbersRowActions number={n} onVerify={onVerify} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}