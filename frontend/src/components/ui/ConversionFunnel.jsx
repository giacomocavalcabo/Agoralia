import React from 'react'
import { useTranslation } from 'react-i18next'

export default function ConversionFunnel({ steps = [] }) {
  const { t } = useTranslation('pages')
  // steps: [{label, value, colorClass}]
  return (
    <div className="space-y-2">
      {steps.map((s,i) => {
        // CLAMP: larghezza barra <=100% per evitare overflow
        const barWidth = Math.min(100, s.value || 0)
        return (
          <div key={i} className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-3 text-sm text-slate-600">{s.label}</div>
            <div className="col-span-7">
              {/* Track con overflow-hidden per prevenire spill-over */}
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-3 rounded-full ${s.colorClass}`} style={{width:`${barWidth}%`}} />
              </div>
            </div>
            {/* Label mostra valore reale (anche >100%) ma barra è clampata */}
            <div className="col-span-2 text-right text-sm font-medium tabular-nums">{(s.value ?? 0).toFixed(0)}%</div>
          </div>
        )
      })}
    </div>
  )
}
