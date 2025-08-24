import React from 'react'
import { useTranslation } from 'react-i18next'

const clampPct = (n) => Math.max(0, Math.min(100, Math.round(n)));

function toStagePercents(data) {
  // Se arriva già in % (<=100), usa e clamp
  const looksLikePct =
    [data.reached, data.connected, data.qualified, data.booked]
      .every(v => typeof v === 'number' && v <= 100);
  if (looksLikePct) {
    return {
      reached: clampPct(data.reached),
      connected: clampPct(data.connected),
      qualified: clampPct(data.qualified),
      booked: clampPct(data.booked)
    };
  }
  // DEMO con CONTEGGI → percentuali relative per stadio
  const reached = Math.max(1, data.reached || 0); // evita div/0
  const connected = data.connected || 0;
  const qualified = data.qualified || 0;
  const booked = data.booked || 0;
  return {
    reached: 100,
    connected: clampPct((connected / reached) * 100),
    qualified: clampPct(reached ? (qualified / Math.max(1, connected)) * 100 : 0),
    booked: clampPct(qualified ? (booked / Math.max(1, qualified)) * 100 : 0),
  };
}

export default function ConversionFunnel({ data }) {
  const { t } = useTranslation('pages')
  const p = toStagePercents(data);
  const items = [
    { label: 'Reached',   percent: p.reached },
    { label: 'Connected', percent: p.connected },
    { label: 'Qualified', percent: p.qualified },
    { label: 'Booked',    percent: p.booked }
  ];

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const width = `${Math.min(100, it.percent)}%`; // clamp visivo
        return (
          <div key={it.label} className="flex items-center gap-2">
            <div className="relative w-full overflow-hidden rounded bg-gray-100">
              <div className="h-2 bg-primary-500" style={{ width }} />
            </div>
            <span className="w-12 text-right text-xs tabular-nums whitespace-nowrap">
              {it.percent}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
