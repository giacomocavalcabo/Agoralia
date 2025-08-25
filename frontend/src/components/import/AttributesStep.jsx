import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ImportDataTable from './ImportDataTable'
import { useCountryRulesV1, getUniqueISOs } from '../../lib/compliance/useCountryRulesV1'

export default function AttributesStep({ rows, selectedIds, onRowChange, onNext, onBack }) {
  const { t } = useTranslation('pages')
  const [bulkField, setBulkField] = useState('')
  const [bulkValue, setBulkValue] = useState('')

  // Get unique ISO codes from rows
  const uniqueISOs = useMemo(() => getUniqueISOs(rows), [rows])
  
  // Fetch country rules v1
  const { data: countryRules } = useCountryRulesV1(uniqueISOs)

  // Enrich rows with default attributes if missing
  const enrichedRows = useMemo(() => {
    return rows.map((row, index) => {
      const rule = countryRules?.[row.country_iso?.toUpperCase()]
      return {
        ...row,
        contact_class: row.contact_class || 'unknown',
        existing: row.existing ?? null,
        opt_in: row.opt_in ?? null,
        national_dnc: row.national_dnc ?? null,
        notes: row.notes || '',
        _countryRule: rule
      }
    })
  }, [rows, countryRules])

  const handleBulkSet = () => {
    if (!bulkField || !bulkValue || selectedIds.size === 0) return

    selectedIds.forEach(index => {
      const updatedRow = { ...enrichedRows[index] }
      updatedRow[bulkField] = bulkValue
      onRowChange(index, updatedRow)
    })

    // Reset bulk form
    setBulkField('')
    setBulkValue('')
  }

  const handleRowChange = (index, field, value) => {
    const updatedRow = { ...enrichedRows[index] }
    updatedRow[field] = value
    onRowChange(index, updatedRow)
  }

  const columns = [
    { key: 'name', label: t('import.mapping.columns.name'), width: 'w-1/4' },
    { key: 'phone', label: t('import.mapping.columns.phone'), width: 'w-1/5' },
    {
      key: 'contact_class',
      label: t('import.attributes.columns.class'),
      width: 'w-1/6',
      render: (value, row, index) => (
        <select
          value={value || 'unknown'}
          onChange={(e) => handleRowChange(index, 'contact_class', e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="unknown">{t('import.attributes.class.unknown')}</option>
          <option value="b2b">{t('import.attributes.class.b2b')}</option>
          <option value="b2c">{t('import.attributes.class.b2c')}</option>
        </select>
      )
    },
    {
      key: 'existing',
      label: t('import.attributes.columns.existing'),
      width: 'w-1/6',
      render: (value, row, index) => (
        <select
          value={value ?? 'unknown'}
          onChange={(e) => handleRowChange(index, 'existing', e.target.value === 'unknown' ? null : e.target.value === 'true')}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="unknown">{t('import.attributes.existing.unknown')}</option>
          <option value="true">{t('import.attributes.existing.yes')}</option>
          <option value="false">{t('import.attributes.existing.no')}</option>
        </select>
      )
    },
    {
      key: 'opt_in',
      label: t('import.attributes.columns.opt_in'),
      width: 'w-1/6',
      render: (value, row, index) => {
        // Show opt-in only for B2C contacts where consent is required
        const rule = row._countryRule
        if (row.contact_class !== 'b2c' || !rule?.flags?.requires_consent_b2c) {
          return <span className="text-gray-400 text-sm">N/A</span>
        }
        
        return (
          <select
            value={value ?? 'unknown'}
            onChange={(e) => handleRowChange(index, 'opt_in', e.target.value === 'unknown' ? null : e.target.value === 'true')}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="unknown">{t('import.attributes.optin.unknown')}</option>
            <option value="true">{t('import.attributes.optin.yes')}</option>
            <option value="false">{t('import.attributes.optin.no')}</option>
          </select>
        )
      }
    },
    {
      key: 'national_dnc',
      label: t('import.attributes.columns.dnc'),
      width: 'w-1/6',
      render: (value, row, index) => {
        // Show DNC only if country requires DNC scrubbing
        const rule = row._countryRule
        if (!rule?.flags?.requires_dnc_scrub) {
          return <span className="text-gray-400 text-sm">No registry</span>
        }
        
        return (
          <select
            value={value ?? 'unknown'}
            onChange={(e) => handleRowChange(index, 'national_dnc', e.target.value === 'unknown' ? null : e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="unknown">{t('import.attributes.dnc.unknown')}</option>
            <option value="in">{t('import.attributes.dnc.in')}</option>
            <option value="not_in">{t('import.attributes.dnc.not_in')}</option>
          </select>
        )
      }
    },
    {
      key: 'notes',
      label: t('import.attributes.columns.notes'),
      width: 'w-1/4',
      render: (value, row, index) => (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => handleRowChange(index, 'notes', e.target.value)}
          placeholder="Optional notes..."
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />
      )
    }
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {t('import.attributes.title')}
        </h2>
        <p className="text-gray-600">
          Configure contact attributes for compliance and relationship management
        </p>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-3">
            {t('import.attributes.bulk.apply_to')} ({selectedIds.size} selected)
          </h3>
          <div className="flex items-center space-x-3">
            <select
              value={bulkField}
              onChange={(e) => setBulkField(e.target.value)}
              className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select field...</option>
              <option value="contact_class">Contact Class</option>
              <option value="existing">Existing Relationship</option>
              <option value="opt_in">Opt-in Status</option>
              <option value="national_dnc">DNC Status</option>
            </select>
            <select
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              disabled={!bulkField}
              className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Select value...</option>
              {bulkField === 'contact_class' && (
                <>
                  <option value="b2b">B2B</option>
                  <option value="b2c">B2C</option>
                  <option value="unknown">Unknown</option>
                </>
              )}
              {bulkField === 'existing' && (
                <>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                  <option value="unknown">Unknown</option>
                </>
              )}
              {bulkField === 'opt_in' && (
                <>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                  <option value="unknown">Unknown</option>
                </>
              )}
              {bulkField === 'national_dnc' && (
                <>
                  <option value="in">In Registry</option>
                  <option value="not_in">Not in Registry</option>
                  <option value="unknown">Unknown</option>
                </>
              )}
            </select>
            <button
              onClick={handleBulkSet}
              disabled={!bulkField || !bulkValue}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('import.attributes.bulk.set')}
            </button>
          </div>
        </div>
      )}

      {/* Hints */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Hints</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• {t('import.attributes.hints.b2c_optin_only')}</li>
          <li>• {t('import.attributes.hints.dnc_only')}</li>
        </ul>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <ImportDataTable
          data={enrichedRows}
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
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {t('import.nav.next')}
        </button>
      </div>
    </div>
  )
}
