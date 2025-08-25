import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ImportDataTable from './ImportDataTable'
import { classifyContacts, getComplianceStats } from '../../lib/compliance/classifyContact'
import { useCountryRulesV1, getUniqueISOs } from '../../lib/compliance/useCountryRulesV1'

// Chip colorata per la categoria compliance
function VerdictChip({ verdict }) {
  const { t } = useTranslation('pages')
  const map = {
    allowed: 'bg-green-100 text-green-700 border-green-200',
    conditional: 'bg-amber-100 text-amber-700 border-amber-200',
    blocked: 'bg-red-100 text-red-700 border-red-200'
  }
  
  return (
    <span className={`px-2 py-1 text-xs rounded-full border ${map[verdict]}`}>
      {t(`import.review.category.${verdict}`)}
    </span>
  )
}

// Flag emoji per paese
function CountryFlag({ countryISO }) {
  const flagMap = {
    IT: '🇮🇹', FR: '🇫🇷', DE: '🇩🇪', US: '🇺🇸', GB: '🇬🇧',
    ES: '🇪🇸', NL: '🇳🇱', BE: '🇧🇪', AT: '🇦🇹', CH: '🇨🇭'
  }
  return <span className="text-lg mr-2">{flagMap[countryISO] || '🌍'}</span>
}

export default function LegalReviewStep({ rows, onNext, onBack }) {
  const { t } = useTranslation('pages')
  
  // Get unique ISO codes from rows
  const uniqueISOs = useMemo(() => getUniqueISOs(rows), [rows])
  
  // Fetch country rules v1
  const { data: countryRules } = useCountryRulesV1(uniqueISOs)
  
  // Classifica tutti i contatti
  const classifiedRows = useMemo(() => {
    return classifyContacts(rows, countryRules)
  }, [rows, countryRules])
  
  // Statistiche compliance
  const stats = useMemo(() => {
    return getComplianceStats(classifiedRows)
  }, [classifiedRows])

  const columns = [
    { key: 'name', label: t('import.mapping.columns.name'), width: 'w-1/4' },
    { 
      key: 'phone', 
      label: t('import.mapping.columns.phone'), 
      width: 'w-1/5',
      render: (value, row) => (
        <div className="flex items-center">
          <CountryFlag countryISO={row.country_iso} />
          <span className="font-mono text-sm">{value}</span>
        </div>
      )
    },
    { key: 'country_iso', label: 'Country', width: 'w-1/6' },
    { 
      key: 'contact_class', 
      label: t('import.attributes.columns.class'), 
      width: 'w-1/6',
      render: (value) => (
        <span className="text-sm font-medium">
          {value === 'b2b' ? 'B2B' : value === 'b2c' ? 'B2C' : 'Unknown'}
        </span>
      )
    },
    { 
      key: 'compliance_category', 
      label: t('import.review.columns.category'), 
      width: 'w-1/6',
      render: (value) => <VerdictChip verdict={value} />
    },
    { 
      key: 'compliance_reasons', 
      label: t('import.review.columns.why'), 
      width: 'w-1/3',
      render: (reasons) => (
        <div className="group relative">
          <span className="text-sm text-gray-600 cursor-help">
            {reasons?.[0] || 'No reason provided'}
            {reasons?.length > 1 && ` (+${reasons.length - 1} more)`}
          </span>
          {reasons?.length > 1 && (
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg p-2 max-w-xs z-10">
              <div className="font-medium mb-1">All reasons:</div>
              <ul className="space-y-1">
                {reasons.map((reason, index) => (
                  <li key={index}>• {reason}</li>
                ))}
              </ul>
              <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          )}
        </div>
      )
    }
  ]

  const canProceed = stats.blocked === 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {t('import.review.title')}
        </h2>
        <p className="text-gray-600">
          Review compliance classification before importing
        </p>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900 mb-2">
            {t('import.review.legend')}
          </div>
          <div className="flex items-center justify-center space-x-6 text-xs text-gray-600">
            <div className="flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              {t('import.review.category.allowed')} - Ready to import
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 bg-amber-500 rounded-full mr-2"></span>
              {t('import.review.category.conditional')} - Review required
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              {t('import.review.category.blocked')} - Cannot import
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.allowed}</div>
          <div className="text-sm text-green-700">Allowed</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{stats.conditional}</div>
          <div className="text-sm text-amber-700">Conditional</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.blocked}</div>
          <div className="text-sm text-red-700">Blocked</div>
        </div>
      </div>

      {/* Warning if blocked contacts exist */}
      {stats.blocked > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {stats.blocked} contact{stats.blocked !== 1 ? 's' : ''} cannot be imported
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>These contacts are blocked due to compliance violations. Please review and update their attributes before proceeding.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <ImportDataTable
          data={classifiedRows}
          columns={columns}
          className="max-h-96"
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {t('import.nav.back')}
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {canProceed ? t('import.nav.next') : 'Cannot proceed - blocked contacts'}
        </button>
      </div>
    </div>
  )
}
