import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateSafe } from '../lib/format';
import NumbersRowActions from './NumbersRowActions';
import TelephonyCapabilityBadges from './TelephonyCapabilityBadges';

export default function NumbersTable({ data = [], filters, onFiltersChange, onSearch, onExport }) {
  const { t, i18n } = useTranslation('pages');
  
  // Colonne sicure (solo campi esposti dal BE)
  const columns = [
    {
      id: 'e164',
      header: t('telephony.numbers_columns.number'),
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {row.original.e164}
        </div>
      )
    },
    {
      id: 'country_iso',
      header: t('telephony.numbers_columns.country'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{getCountryFlag(row.original.country_iso)}</span>
          <span className="text-sm">{row.original.country_iso}</span>
        </div>
      )
    },
    {
      id: 'provider',
      header: t('telephony.numbers_columns.provider'),
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.provider || '—'}
        </div>
      )
    },
    {
      id: 'capabilities',
      header: t('telephony.numbers_columns.capabilities'),
      cell: ({ row }) => (
        <TelephonyCapabilityBadges number={row.original} />
      )
    },
    {
      id: 'created_at',
      header: t('telephony.numbers_columns.created'),
      cell: ({ row }) => (
        <div className="text-sm text-gray-600">
          {formatDateSafe(row.original.created_at, i18n.language)}
        </div>
      )
    },
    {
      id: 'actions',
      header: t('telephony.numbers_columns.actions'),
      cell: ({ row }) => <NumbersRowActions row={row} />
    }
  ];

  // Helper per flag paese
  const getCountryFlag = (iso) => {
    const flagMap = {
      'IT': '🇮🇹', 'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷',
      'ES': '🇪🇸', 'CA': '🇨🇦', 'AU': '🇦🇺', 'JP': '🇯🇵', 'CN': '🇨🇳'
    };
    return flagMap[iso] || '🌍';
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-2">📞</div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          {t('telephony.numbers_empty.title')}
        </h3>
        <p className="text-gray-600">
          {t('telephony.numbers_empty.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <NumbersToolbar
        filters={filters}
        onFiltersChange={onFiltersChange}
        onSearch={onSearch}
        onExport={onExport}
        selectionCount={0} // TODO: Implement selection
      />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map(column => (
                <th
                  key={column.id}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr key={row.id || index} className="hover:bg-gray-50">
                {columns.map(column => (
                  <td key={column.id} className="px-6 py-4 whitespace-nowrap">
                    {column.cell ? column.cell({ row, getValue: () => row[column.id] }) : row[column.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Import NumbersToolbar
import NumbersToolbar from './NumbersToolbar';
