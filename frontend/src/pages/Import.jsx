import React, { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useI18n } from '../lib/i18n.jsx'
import { normalizePhoneNumber } from '../lib/phoneUtils.js'
import { parseCSV, validateCSVData, detectFieldTypes } from '../lib/csvUtils.js'
import { CheckCircleIcon, DocumentArrowUpIcon, ClipboardDocumentIcon, TableCellsIcon } from '@heroicons/react/24/outline'

// Step components
function UploadStep({ onDataDetected, onNext }) {
  const { t } = useI18n()
  const [uploadMethod, setUploadMethod] = useState('csv')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [csvData, setCsvData] = useState(null)
  const [pasteData, setPasteData] = useState('')

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    setIsProcessing(true)
    setError(null)

    try {
      // Check file size (max 50MB for CSV)
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('File too large. Maximum size is 50MB.')
      }

      const text = await file.text()
      
      // Parse CSV with robust utilities
      const result = await parseCSV(text)
      
      if (result.errors.length > 0) {
        console.warn('CSV parsing warnings:', result.errors)
      }

      // Validate required fields
      const validation = validateCSVData(result.data, ['phone', 'name'])
      
      if (!validation.isValid) {
        setError(`Missing required fields: ${validation.missingFields.join(', ')}`)
        return
      }

      // Detect field types
      const fieldTypes = detectFieldTypes(result.data, result.meta.fields)

      // Normalize phone numbers for preview
      const normalizedData = result.data.slice(0, 100).map(row => {
        if (row.phone) {
          const normalized = normalizePhoneNumber(row.phone, 'IT')
          return {
            ...row,
            phone_normalized: normalized.e164,
            phone_isValid: normalized.isValid,
            phone_country: normalized.country
          }
        }
        return row
      })

      const processedData = {
        ...result,
        data: normalizedData,
        meta: {
          ...result.meta,
          fieldTypes,
          validation,
          originalFile: file.name,
          fileSize: file.size
        }
      }

      setCsvData(processedData)
      onDataDetected(processedData)
      
    } catch (err) {
      setError(err.message || 'Failed to process CSV file')
      console.error('CSV processing error:', err)
    } finally {
      setIsProcessing(false)
    }
  }, [onDataDetected])

  const handlePasteProcess = async () => {
    if (!pasteData.trim()) {
      setError('Please paste some data')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const result = await parseCSV(pasteData)
      
      if (result.errors.length > 0) {
        console.warn('CSV parsing warnings:', result.errors)
      }

      // Validate required fields
      const validation = validateCSVData(result.data, ['phone', 'name'])
      
      if (!validation.isValid) {
        setError(`Missing required fields: ${validation.missingFields.join(', ')}`)
        return
      }

      // Detect field types
      const fieldTypes = detectFieldTypes(result.data, result.meta.fields)

      // Normalize phone numbers for preview
      const normalizedData = result.data.slice(0, 100).map(row => {
        if (row.phone) {
          const normalized = normalizePhoneNumber(row.phone, 'IT')
          return {
            ...row,
            phone_normalized: normalized.e164,
            phone_isValid: normalized.isValid,
            phone_country: normalized.country
          }
        }
        return row
      })

      const processedData = {
        ...result,
        data: normalizedData,
        meta: {
          ...result.meta,
          fieldTypes,
          validation,
          source: 'paste'
        }
      }

      onDataDetected(processedData)
      
    } catch (err) {
      setError(err.message || 'Failed to process pasted data')
      console.error('Paste processing error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  })

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {t('pages.import.upload.title') || 'Import Contacts'}
        </h2>
        <p className="text-gray-600">
          {t('pages.import.upload.subtitle') || 'Upload a CSV file or paste data to import contacts'}
        </p>
      </div>

      {/* Method Selection Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'csv', label: 'Upload CSV', icon: DocumentArrowUpIcon },
              { id: 'paste', label: 'Paste Data', icon: ClipboardDocumentIcon },
              { id: 'sheet', label: 'Google Sheet', icon: TableCellsIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setUploadMethod(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  uploadMethod === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5 inline mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* CSV Upload */}
          {uploadMethod === 'csv' && (
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {isDragActive
                    ? t('pages.import.upload.drop_here') || 'Drop the file here'
                    : t('pages.import.upload.drag_drop') || 'Drag & drop a CSV file here'}
                </p>
                <p className="text-gray-500">
                  {t('pages.import.upload.or_click') || 'or click to browse'}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {t('pages.import.upload.supported_formats') || 'Supports CSV, XLS, XLSX (max 50MB)'}
                </p>
              </div>
            </div>
          )}

          {/* Paste Data */}
          {uploadMethod === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('pages.import.paste.label') || 'Paste CSV data'}
                </label>
                <textarea
                  value={pasteData}
                  onChange={(e) => setPasteData(e.target.value)}
                  placeholder={t('pages.import.paste.placeholder') || 'Paste your CSV data here (with headers)...'}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handlePasteProcess}
                disabled={!pasteData.trim() || isProcessing}
                className="w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('pages.import.paste.processing') || 'Processing...'}
                  </div>
                ) : (
                  t('pages.import.paste.process') || 'Process Data'
                )}
              </button>
            </div>
          )}

          {/* Google Sheet */}
          {uploadMethod === 'sheet' && (
            <div className="text-center py-12">
              <TableCellsIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('pages.import.sheet.title') || 'Google Sheets Integration'}
              </h3>
              <p className="text-gray-500 mb-4">
                {t('pages.import.sheet.subtitle') || 'Coming soon! You can export your Google Sheet as CSV and upload it here.'}
              </p>
              <button
                onClick={() => setUploadMethod('csv')}
                className="px-6 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                {t('pages.import.sheet.upload_csv') || 'Upload CSV Instead'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {t('pages.import.processing') || 'Processing your data...'}
          </p>
        </div>
      )}

      {/* Data Preview */}
      {csvData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('pages.import.preview.title') || 'Data Preview'}
          </h3>
          
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {t('pages.import.preview.rows') || 'Rows'}: {csvData.meta.totalRows} | 
              {t('pages.import.preview.fields') || 'Fields'}: {csvData.meta.fields.length} |
              {t('pages.import.preview.delimiter') || 'Delimiter'}: {csvData.meta.delimiter}
              {csvData.meta.hasBOM && ' (BOM detected)'}
            </div>
            
            <button
              onClick={() => onNext()}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              {t('pages.import.preview.continue') || 'Continue to Mapping'} →
            </button>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {csvData.meta.fields.map((field, index) => (
                    <th key={index} className="text-left py-2 px-3 font-medium text-gray-700">
                      {field}
                      {csvData.meta.fieldTypes[field] && (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {csvData.meta.fieldTypes[field]}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.data.slice(0, 5).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-gray-100">
                    {csvData.meta.fields.map((field, fieldIndex) => {
                      const value = row[field]
                      const isPhone = field.toLowerCase().includes('phone')
                      const normalized = isPhone ? row.phone_normalized : null
                      
                      return (
                        <td key={fieldIndex} className="py-2 px-3 text-gray-600">
                          <div>
                            {value}
                            {isPhone && normalized && (
                              <div className="text-xs text-gray-400 mt-1">
                                → {normalized}
                                {row.phone_isValid ? (
                                  <span className="ml-1 text-green-600">✓</span>
                                ) : (
                                  <span className="ml-1 text-red-600">✗</span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {csvData.meta.totalRows > 5 && (
            <p className="text-sm text-gray-500 mt-3 text-center">
              {t('pages.import.preview.showing') || 'Showing first 5 rows of'} {csvData.meta.totalRows} {t('pages.import.preview.total') || 'total rows'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Step 2: Field Mapping
function FieldMappingStep({ data, onNext, onBack }) {
  const { t } = useI18n()
  const [fieldMappings, setFieldMappings] = useState({})
  const [prefixConfig, setPrefixConfig] = useState({
    strategy: 'auto', // 'auto', '+39', '0039', 'none'
    defaultCountry: 'IT',
    applyToAll: false
  })
  const [dedupeConfig, setDedupeConfig] = useState({
    onPhone: true,
    onEmail: false,
    resolveStrategy: 'skip' // 'skip', 'merge'
  })

  // Auto-detect field types based on content
  useEffect(() => {
    if (data?.meta?.fields) {
      const autoMappings = {}
      data.meta.fields.forEach(field => {
        const fieldLower = field.toLowerCase()
        if (fieldLower.includes('phone') || fieldLower.includes('tel') || fieldLower.includes('mobile')) {
          autoMappings[field] = 'phone'
        } else if (fieldLower.includes('name') || fieldLower.includes('nome')) {
          autoMappings[field] = 'name'
        } else if (fieldLower.includes('email') || fieldLower.includes('mail')) {
          autoMappings[field] = 'email'
        } else if (fieldLower.includes('company') || fieldLower.includes('azienda') || fieldLower.includes('società')) {
          autoMappings[field] = 'company'
        } else if (fieldLower.includes('country') || fieldLower.includes('paese')) {
          autoMappings[field] = 'country'
        } else {
          autoMappings[field] = 'custom'
        }
      })
      setFieldMappings(autoMappings)
    }
  }, [data])

  const fieldTypes = [
    { value: 'phone', label: 'Phone Number', required: true, description: 'E.164 format (+39...)' },
    { value: 'name', label: 'Full Name', required: true, description: 'Contact full name' },
    { value: 'email', label: 'Email', required: false, description: 'Contact email' },
    { value: 'company', label: 'Company', required: false, description: 'Company name' },
    { value: 'country', label: 'Country', required: false, description: 'Country code (IT, US...)' },
    { value: 'notes', label: 'Notes', required: false, description: 'Additional notes' },
    { value: 'tags', label: 'Tags', required: false, description: 'Comma-separated tags' },
    { value: 'custom', label: 'Custom Field', required: false, description: 'Custom data' }
  ]

  const handleFieldMappingChange = (csvField, appField) => {
    setFieldMappings(prev => ({
      ...prev,
      [csvField]: appField
    }))
  }

  const handleNext = () => {
    // Validate required fields
    const requiredFields = fieldTypes.filter(f => f.required)
    const mappedRequired = requiredFields.every(f => 
      Object.values(fieldMappings).includes(f.value)
    )
    
    if (!mappedRequired) {
      alert('Please map all required fields (Phone Number and Full Name)')
      return
    }
    
    onNext({
      fieldMappings,
      prefixConfig,
      dedupeConfig
    })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {t('pages.import.mapping.title') || 'Field Mapping & Rules'}
        </h2>
        <p className="text-gray-600">
          {t('pages.import.mapping.subtitle') || 'Map CSV columns to contact fields and configure import rules'}
        </p>
      </div>

      {/* Field Mapping */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('pages.import.mapping.fields') || 'Field Mapping'}
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">CSV Column</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Map To</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Sample Values</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Required</th>
              </tr>
            </thead>
            <tbody>
              {data?.meta?.fields?.map((field, index) => {
                const sampleValues = data.data?.slice(0, 3).map(row => row[field]).filter(Boolean)
                const isRequired = fieldTypes.find(f => f.value === fieldMappings[field])?.required || false
                
                return (
                  <tr key={field} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-900 font-medium">{field}</td>
                    <td className="py-3 px-4">
                      <select
                        value={fieldMappings[field] || ''}
                        onChange={(e) => handleFieldMappingChange(field, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">Select field type...</option>
                        {fieldTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label} {type.required ? '*' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">
                      <div className="space-y-1">
                        {sampleValues.slice(0, 2).map((value, i) => (
                          <div key={i} className="truncate max-w-xs" title={value}>
                            {value}
                          </div>
                        ))}
                        {sampleValues.length > 2 && (
                          <div className="text-gray-400 text-xs">
                            +{sampleValues.length - 2} more...
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {isRequired && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Required
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prefix Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('pages.import.prefix.title') || 'Phone Number Prefix Configuration'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('pages.import.prefix.strategy') || 'Prefix Strategy'}
            </label>
            <select
              value={prefixConfig.strategy}
              onChange={(e) => setPrefixConfig(prev => ({...prev, strategy: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="auto">{t('pages.import.prefix.auto') || 'Auto-detect (+39, 0039, none)'}</option>
              <option value="+39">{t('pages.import.prefix.force_39') || 'Force +39 prefix'}</option>
              <option value="0039">{t('pages.import.prefix.force_0039') || 'Force 0039 prefix'}</option>
              <option value="none">{t('pages.import.prefix.no_prefix') || 'No prefix (keep as-is)'}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('pages.import.prefix.default_country') || 'Default Country'}
            </label>
            <select
              value={prefixConfig.defaultCountry}
              onChange={(e) => setPrefixConfig(prev => ({...prev, defaultCountry: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="IT">Italy (+39)</option>
              <option value="US">United States (+1)</option>
              <option value="GB">United Kingdom (+44)</option>
              <option value="FR">France (+33)</option>
              <option value="DE">Germany (+49)</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={prefixConfig.applyToAll}
              onChange={(e) => setPrefixConfig(prev => ({...prev, applyToAll: e.target.checked}))}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              {t('pages.import.prefix.apply_to_all') || 'Apply prefix rules to all phone numbers'}
            </span>
          </label>
        </div>
      </div>

      {/* Deduplication Rules */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('pages.import.dedupe.title') || 'Deduplication Rules'}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('pages.import.dedupe.check_on') || 'Check for duplicates on:'}
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={dedupeConfig.onPhone}
                  onChange={(e) => setDedupeConfig(prev => ({...prev, onPhone: e.target.checked}))}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Phone Number (E.164)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={dedupeConfig.onEmail}
                  onChange={(e) => setDedupeConfig(prev => ({...prev, onEmail: e.target.checked}))}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Email Address</span>
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('pages.import.dedupe.resolve_strategy') || 'When duplicates found:'}
            </label>
            <select
              value={dedupeConfig.resolveStrategy}
              onChange={(e) => setDedupeConfig(prev => ({...prev, resolveStrategy: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="skip">{t('pages.import.dedupe.skip') || 'Skip duplicates'}</option>
              <option value="merge">{t('pages.import.dedupe.merge') || 'Merge and update existing'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
        >
          ← {t('common.back') || 'Back'}
        </button>
        
        <button
          onClick={handleNext}
          className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          {t('common.next') || 'Next'} →
        </button>
      </div>
    </div>
  )
}

// Step 3: Review & Launch
function ReviewLaunchStep({ data, mappingData, onBack, onLaunch }) {
  const { t } = useI18n()
  const [isLaunching, setIsLaunching] = useState(false)
  const [jobId, setJobId] = useState(null)

  // Calculate import statistics
  const totalRows = data?.data?.length || 0
  const estimatedNew = Math.floor(totalRows * 0.7) // Mock calculation
  const estimatedUpdates = Math.floor(totalRows * 0.2)
  const estimatedDuplicates = Math.floor(totalRows * 0.1)

  const handleLaunch = async () => {
    setIsLaunching(true)
    
    try {
      // In production, this would call the backend API
      // const response = await apiFetch('/import/jobs', {
      //   method: 'POST',
      //   body: {
      //     data: data,
      //     mapping: mappingData.fieldMappings,
      //     prefix: mappingData.prefixConfig,
      //     dedupe: mappingData.dedupeConfig
      //   }
      // })
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mockJobId = `import_${Date.now()}`
      setJobId(mockJobId)
      
      // In production, redirect to job status page
      // onLaunch(mockJobId)
      
    } catch (error) {
      console.error('Import launch failed:', error)
      alert('Import failed. Please try again.')
    } finally {
      setIsLaunching(false)
    }
  }

  if (jobId) {
    return (
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8">
          <CheckCircleIcon className="mx-auto h-16 w-16 text-green-600 mb-4" />
          <h2 className="text-2xl font-semibold text-green-900 mb-2">
            {t('pages.import.launch.success') || 'Import Job Launched!'}
          </h2>
          <p className="text-green-700 mb-4">
            {t('pages.import.launch.success_desc') || 'Your import job has been queued and will start processing shortly.'}
          </p>
          <div className="bg-white rounded-lg p-4 inline-block">
            <p className="text-sm text-gray-600 mb-1">Job ID:</p>
            <p className="font-mono text-lg font-semibold text-gray-900">{jobId}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={() => window.location.href = `/import/jobs/${jobId}`}
            className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            {t('pages.import.launch.view_job') || 'View Job Status'}
          </button>
          
          <button
            onClick={() => window.location.href = '/import'}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
          >
            {t('pages.import.launch.new_import') || 'Start New Import'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {t('pages.import.review.title') || 'Review & Launch'}
        </h2>
        <p className="text-gray-600">
          {t('pages.import.review.subtitle') || 'Review your import configuration and launch the job'}
        </p>
      </div>

      {/* Import Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('pages.import.review.summary') || 'Import Summary'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{totalRows}</div>
            <div className="text-sm text-blue-700">Total Rows</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{estimatedNew}</div>
            <div className="text-sm text-green-700">New Contacts</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{estimatedUpdates}</div>
            <div className="text-sm text-yellow-700">Updates</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{estimatedDuplicates}</div>
            <div className="text-sm text-red-700">Duplicates</div>
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Field Mappings:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {Object.entries(mappingData?.fieldMappings || {}).map(([csvField, appField]) => (
              <div key={csvField} className="flex justify-between">
                <span className="text-gray-600">{csvField}:</span>
                <span className="font-medium text-gray-900">{appField}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Configuration Review */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('pages.import.review.config') || 'Configuration Review'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Prefix Configuration:</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div>Strategy: {mappingData?.prefixConfig?.strategy}</div>
              <div>Default Country: {mappingData?.prefixConfig?.defaultCountry}</div>
              <div>Apply to All: {mappingData?.prefixConfig?.applyToAll ? 'Yes' : 'No'}</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Deduplication:</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div>Check Phone: {mappingData?.dedupeConfig?.onPhone ? 'Yes' : 'No'}</div>
              <div>Check Email: {mappingData?.dedupeConfig?.onEmail ? 'Yes' : 'No'}</div>
              <div>Strategy: {mappingData?.dedupeConfig?.resolveStrategy}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Estimated Cost */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('pages.import.review.cost') || 'Estimated Cost'}
        </h3>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">
              {t('pages.import.review.cost_desc') || 'Based on your current plan and estimated new contacts'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {t('pages.import.review.cost_note') || 'Actual cost may vary based on final processing results'}
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">$0.00</div>
            <div className="text-sm text-gray-500">Free tier</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
        >
          ← {t('common.back') || 'Back'}
        </button>
        
        <button
          onClick={handleLaunch}
          disabled={isLaunching}
          className="px-8 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLaunching ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {t('pages.import.launch.launching') || 'Launching...'}
            </div>
          ) : (
            <>
              🚀 {t('pages.import.launch.launch') || 'Launch Import'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// Main Import component
export default function Import() {
  const { t } = useI18n()
  const [currentStep, setCurrentStep] = useState(1)
  const [importData, setImportData] = useState(null)
  const [mappingData, setMappingData] = useState(null)

  const handleDataDetected = (data) => {
    setImportData(data)
  }

  const handleMappingComplete = (mapping) => {
    setMappingData(mapping)
  }

  const handleNext = () => {
    setCurrentStep(currentStep + 1)
  }

  const handleBack = () => {
    setCurrentStep(currentStep - 1)
  }

  const handleLaunch = (jobId) => {
    // In production, this would redirect to job status page
    if (import.meta.env.DEV) {
      console.log('Import job launched:', jobId)
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
              step <= currentStep
                ? 'bg-green-600 border-green-600 text-white'
                : 'bg-white border-gray-300 text-gray-400'
            }`}>
              {step < currentStep ? (
                <CheckCircleIcon className="h-5 w-5" />
              ) : (
                step
              )}
            </div>
            <span className={`ml-2 text-sm font-medium ${
              step <= currentStep ? 'text-gray-900' : 'text-gray-500'
            }`}>
              {step === 1 && (t('pages.import.steps.upload') || 'Upload & Detect')}
              {step === 2 && (t('pages.import.steps.mapping') || 'Mapping & Rules')}
              {step === 3 && (t('pages.import.steps.review') || 'Review & Launch')}
            </span>
            {step < 3 && (
              <div className={`ml-8 w-16 h-0.5 ${
                step < currentStep ? 'bg-green-600' : 'bg-gray-300'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 1 && (
        <UploadStep 
          onDataDetected={handleDataDetected}
          onNext={handleNext}
        />
      )}

      {currentStep === 2 && importData && (
        <FieldMappingStep 
          data={importData}
          onNext={handleMappingComplete}
          onBack={handleBack}
        />
      )}

      {currentStep === 3 && importData && mappingData && (
        <ReviewLaunchStep 
          data={importData}
          mappingData={mappingData}
          onBack={handleBack}
          onLaunch={handleLaunch}
        />
      )}
    </div>
  )
}


