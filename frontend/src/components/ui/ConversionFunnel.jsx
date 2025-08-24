import React from 'react'
import { useTranslation } from 'react-i18next'

export default function ConversionFunnel({ steps = [] }) {
  // steps: [{label, value, colorClass}]
  return (
    <div className="space-y-2">
      {steps.map((s,i) => (
        <div key={i} className="grid grid-cols-12 gap-3 items-center">
          <div className="col-span-3 text-sm text-slate-600">{s.label}</div>
          <div className="col-span-7">
            <div className="h-3 w-full rounded-full bg-slate-100">
              <div className={`h-3 rounded-full ${s.colorClass}`} style={{width:`${s.value || 0}%`}} />
            </div>
          </div>
          <div className="col-span-2 text-right text-sm font-medium">{(s.value ?? 0).toFixed(0)}%</div>
        </div>
      ))}
    </div>
  )
}
