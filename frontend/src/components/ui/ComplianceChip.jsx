import React from 'react';

const MAP = {
  allowed:   { cls: 'bg-green-50 text-green-700 border-green-200',  label: 'Allowed' },
  conditional:{ cls: 'bg-amber-50 text-amber-800 border-amber-200', label: 'Conditional' },
  blocked:   { cls: 'bg-red-50 text-red-700 border-red-200',        label: 'Blocked' },
};

export default function ComplianceChip({ value, title }) {
  const v = (value || '').toLowerCase();
  const { cls, label } = MAP[v] || { cls: 'bg-gray-50 text-gray-700 border-gray-200', label: String(value || '—') };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
      title={title || ''}
      aria-label={label}
    >
      {label}
    </span>
  );
}
