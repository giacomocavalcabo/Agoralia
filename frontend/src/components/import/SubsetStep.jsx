import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ImportDataTable from './ImportDataTable'

export default function SubsetStep({ rows, selectedIds, onSelectionChange, onNext, onBack }) {
  const { t } = useTranslation('pages')
  const [filters, setFilters] = useState({ name: '', phone: '' })
  
  // Filtra le righe in base ai filtri
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const nameMatch = !filters.name || 
        (row.name && row.name.toLowerCase().includes(filters.name.toLowerCase()))
      const phoneMatch = !filters.phone || 
        (row.phone && row.phone.includes(filters.phone))
      return nameMatch && phoneMatch
    })
  }, [rows, filters])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const handleSelectAll = () => {
    const allIds = new Set(filteredRows.map((_, index) => index))
    onSelectionChange(allIds)
  }

  const handleClearSelection = () => {
    onSelectionChange(new Set())
  }

  const columns = [
    { key: 'name', label: t('import.mapping.columns.name'), width: 'w-1/3' },
    { key: 'phone', label: t('import.mapping.columns.phone'), width: 'w-1/3' },
    { key: 'email', label: t('import.mapping.columns.email'), width: 'w-1/4' }
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {t('import.subset.title')}
        </h2>
        <p className="text-gray-600">
          {t('import.subset.selected', { count: selectedIds.size })}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">{t('import.subset.filters')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={filters.name}
              onChange={(e) => handleFilterChange('name', e.target.value)}
              placeholder="Filter by name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Phone</label>
            <input
              type="text"
              value={filters.phone}
              onChange={(e) => handleFilterChange('phone', e.target.value)}
              placeholder="Filter by phone..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Selection Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSelectAll}
            className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {t('import.subset.select_all')}
          </button>
          <button
            onClick={handleClearSelection}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-700 font-medium"
          >
            Clear
          </button>
        </div>
        <div className="text-sm text-gray-600">
          {selectedIds.size} of {filteredRows.length} rows selected
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <ImportDataTable
          data={filteredRows}
          columns={columns}
          className="max-h-96"
          selectable
          selectedRowIds={selectedIds}
          onSelectionChange={onSelectionChange}
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
          disabled={selectedIds.size === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {t('import.nav.next')}
        </button>
      </div>
    </div>
  )
}
