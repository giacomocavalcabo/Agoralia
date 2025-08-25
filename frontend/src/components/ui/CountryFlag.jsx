import React from 'react';

function isoToFlagEmoji(iso) {
  if (!iso || iso.length !== 2) return '🏳️';
  const A = 0x1F1E6;
  const up = iso.toUpperCase();
  return String.fromCodePoint(A + (up.charCodeAt(0) - 65)) +
         String.fromCodePoint(A + (up.charCodeAt(1) - 65));
}

export default function CountryFlag({ iso, className = '' }) {
  const flag = isoToFlagEmoji(iso);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={iso || ''} aria-label={iso || '—'}>
      <span aria-hidden>{flag}</span>
      <span className="text-xs tabular-nums text-gray-500">{iso || '—'}</span>
    </span>
  );
}
