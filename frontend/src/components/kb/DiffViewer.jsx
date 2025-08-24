import React, { useState, useMemo } from 'react'
import { useTranslation } from '../../lib/i18n.jsx'
import { CheckIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

const DiffViewer = ({ diffAnalysis, onMergeDecisions, isProcessing = false }) => {
  const { t } = useTranslation('pages')
  const [decisions, setDecisions] = useState({})
  const [strategy, setStrategy] = useState('manual')

  // Initialize decisions based on diff analysis
  useMemo(() => {
    if (diffAnalysis?.field_diffs) {
      const initialDecisions = {}
      diffAnalysis.field_diffs.forEach(diff => {
        if (diff.conflict_type === 'update') {
          initialDecisions[diff.field_key] = 'keep_old'
        } else {
          initialDecisions[diff.field_key] = 'use_new'
        }
      })
      setDecisions(initialDecisions)
    }
  }, [diffAnalysis])

  const handleDecisionChange = (fieldKey, action) => {
    setDecisions(prev => ({
      ...prev,
      [fieldKey]: action
    }))
  }

  const handleStrategyChange = (newStrategy) => {
    setStrategy(newStrategy)
    
    // Auto-apply strategy
    if (newStrategy === 'auto_accept_new') {
      const autoDecisions = {}
      diffAnalysis.field_diffs.forEach(diff => {
        autoDecisions[diff.field_key] = 'use_new'
      })
      setDecisions(autoDecisions)
    } else if (newStrategy === 'auto_merge') {
      const autoDecisions = {}
      diffAnalysis.field_diffs.forEach(diff => {
        if (diff.conflict_type === 'update') {
          autoDecisions[diff.field_key] = 'merge'
        } else {
          autoDecisions[diff.field_key] = 'use_new'
        }
      })
      setDecisions(autoDecisions)
    }
  }

  const handleMerge = async () => {
    const mergeDecisions = diffAnalysis.field_diffs.map(diff => ({
      field_key: diff.field_key,
      field_id: diff.field_id,
      action: decisions[diff.field_key],
      new_value: diff.new_value
    }))

    await onMergeDecisions({
      decisions: mergeDecisions,
      strategy
    })
  }

  const getActionIcon = (action) => {
    switch (action) {
      case 'keep_old':
        return <XMarkIcon className="w-4 h-4 text-red-500" />
      case 'use_new':
        return <CheckIcon className="w-4 h-4 text-green-500" />
      case 'merge':
        return <ArrowPathIcon className="w-4 h-4 text-blue-500" />
      default:
        return null
    }
  }

  const getActionColor = (action) => {
    switch (action) {
      case 'keep_old':
        return 'border-red-200 bg-red-50'
      case 'use_new':
        return 'border-green-200 bg-green-50'
      case 'merge':
        return 'border-blue-200 bg-blue-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  if (!diffAnalysis) {
    return (
      <div className="text-center py-8 text-gray-500">
        {t('kb.imports.no_diff_available')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('kb.imports.merge_summary')}
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {diffAnalysis.total_fields}
            </div>
            <div className="text-sm text-gray-500">
              {t('kb.imports.existing_fields')}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {diffAnalysis.imported_fields}
            </div>
            <div className="text-sm text-gray-500">
              {t('kb.imports.imported_fields')}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {diffAnalysis.conflicts}
            </div>
            <div className="text-sm text-gray-500">
              {t('kb.imports.conflicts')}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {diffAnalysis.new_fields}
            </div>
            <div className="text-sm text-gray-500">
              {t('kb.imports.new_fields')}
            </div>
          </div>
        </div>
      </div>

      {/* Merge Strategy */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="text-md font-medium text-gray-900 mb-3">
          {t('kb.imports.merge_strategy')}
        </h4>
        
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center">
            <input
              type="radio"
              name="strategy"
              value="manual"
              checked={strategy === 'manual'}
              onChange={(e) => handleStrategyChange(e.target.value)}
              className="mr-2"
            />
            <span className="text-sm">{t('kb.imports.strategy_manual')}</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="radio"
              name="strategy"
              value="auto_accept_new"
              checked={strategy === 'auto_accept_new'}
              onChange={(e) => handleStrategyChange(e.target.value)}
              className="mr-2"
            />
            <span className="text-sm">{t('kb.imports.strategy_auto_new')}</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="radio"
              name="strategy"
              value="auto_merge"
              checked={strategy === 'auto_merge'}
              onChange={(e) => handleStrategyChange(e.target.value)}
              className="mr-2"
            />
            <span className="text-sm">{t('kb.imports.strategy_auto_merge')}</span>
          </label>
        </div>
      </div>

      {/* Field Diffs */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h4 className="text-md font-medium text-gray-900">
            {t('kb.imports.field_changes')}
          </h4>
        </div>
        
        <div className="divide-y">
          {diffAnalysis.field_diffs.map((diff, index) => (
            <div key={index} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h5 className="font-medium text-gray-900">
                    {diff.field_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h5>
                  <p className="text-sm text-gray-500">
                    {diff.conflict_type === 'update' 
                      ? t('kb.imports.field_update') 
                      : t('kb.imports.field_new')
                    }
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  {getActionIcon(decisions[diff.field_key])}
                  <span className={`text-xs px-2 py-1 rounded-full ${getActionColor(decisions[diff.field_key])}`}>
                    {decisions[diff.field_key]}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {diff.conflict_type === 'update' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDecisionChange(diff.field_key, 'keep_old')}
                      className={`px-3 py-1 text-xs rounded border ${
                        decisions[diff.field_key] === 'keep_old'
                          ? 'bg-red-100 border-red-300 text-red-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {t('kb.imports.keep_existing')}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleDecisionChange(diff.field_key, 'use_new')}
                      className={`px-3 py-1 text-xs rounded border ${
                        decisions[diff.field_key] === 'use_new'
                          ? 'bg-green-100 border-green-300 text-green-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {t('kb.imports.use_new')}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleDecisionChange(diff.field_key, 'merge')}
                      className={`px-3 py-1 text-xs rounded border ${
                        decisions[diff.field_key] === 'merge'
                          ? 'bg-blue-100 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {t('kb.imports.merge_values')}
                    </button>
                  </>
                )}
                
                {diff.conflict_type === 'new' && (
                  <button
                    type="button"
                    onClick={() => handleDecisionChange(diff.field_key, 'use_new')}
                    className={`px-3 py-1 text-xs rounded border ${
                      decisions[diff.field_key] === 'use_new'
                        ? 'bg-green-100 border-green-300 text-green-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t('kb.imports.add_field')}
                  </button>
                )}
              </div>

              {/* Value Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {diff.conflict_type === 'update' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('kb.imports.existing_value')}
                    </label>
                    <div className="p-3 bg-gray-50 rounded border text-sm text-gray-600 min-h-[80px]">
                      {diff.old_value || t('kb.imports.no_value')}
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {diff.conflict_type === 'update' 
                      ? t('kb.imports.new_value') 
                      : t('kb.imports.field_value')
                    }
                  </label>
                  <div className="p-3 bg-blue-50 rounded border text-sm text-blue-600 min-h-[80px]">
                    {diff.new_value || t('kb.imports.no_value')}
                  </div>
                </div>
              </div>

              {/* Preview of merged result */}
              {decisions[diff.field_key] === 'merge' && diff.conflict_type === 'update' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('kb.imports.merged_preview')}
                  </label>
                  <div className="p-3 bg-purple-50 rounded border text-sm text-purple-600 min-h-[80px]">
                    {diff.old_value}
                    <div className="border-t border-purple-200 my-2"></div>
                    <strong>--- {t('kb.imports.updated')} ---</strong>
                    <div className="mt-1">{diff.new_value}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Merge Actions */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {t('kb.imports.ready_to_merge')}
          </div>
          
          <button
            type="button"
            onClick={handleMerge}
            disabled={isProcessing}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t('kb.imports.merging')}
              </div>
            ) : (
              t('kb.imports.apply_merge')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DiffViewer
