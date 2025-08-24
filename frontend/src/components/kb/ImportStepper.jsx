import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { Card } from '../ui/Card'

const STEPS = [
  { id: 'upload', label: 'kb.imports.steps.upload', icon: '📁' },
  { id: 'mapping', label: 'kb.imports.steps.mapping', icon: '🔗' },
  { id: 'validate', label: 'kb.imports.steps.validate', icon: '✅' },
  { id: 'confirm', label: 'kb.imports.steps.confirm', icon: '🚀' }
]

export function ImportStepper({ isOpen, onClose, onSuccess }) {
  const { t } = useTranslation('pages')
  const [currentStep, setCurrentStep] = useState(0)
  const [importData, setImportData] = useState({})
  const [validationErrors, setValidationErrors] = useState([])
  
  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }
  
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }
  
  const downloadErrorReport = () => {
    // Generate and download CSV error report
    const csv = validationErrors.map(err => `${err.row},${err.field},${err.error}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import-errors.csv'
    a.click()
  }
  
  if (!isOpen) return null
  
  return (
    <Card className="p-6" data-testid="import-stepper">
      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              index <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {index < currentStep ? '✓' : step.icon}
            </div>
            <span className="ml-2 text-sm font-medium">
              {t(step.label)}
            </span>
            {index < STEPS.length - 1 && (
              <div className="w-16 h-px bg-gray-300 mx-4" />
            )}
          </div>
        ))}
      </div>
      
      {/* Step Content */}
      <div className="min-h-64">
        {currentStep === 0 && (
          <UploadStep 
            data={importData} 
            onChange={setImportData} 
            onNext={handleNext} 
            data-testid="step-upload"
          />
        )}
        
        {currentStep === 1 && (
          <MappingStep 
            data={importData} 
            onChange={setImportData} 
            onNext={handleNext} 
            onBack={handleBack} 
          />
        )}
        
        {currentStep === 2 && (
          <ValidateStep 
            data={importData} 
            errors={validationErrors} 
            onDownloadReport={downloadErrorReport}
            onNext={handleNext} 
            onBack={handleBack} 
          />
        )}
        
        {currentStep === 3 && (
          <ConfirmStep 
            data={importData} 
            onConfirm={onSuccess} 
            onBack={handleBack} 
          />
        )}
      </div>
    </Card>
  )
}

function UploadStep({ data, onChange, onNext }) {
  const { t } = useTranslation('pages')
  
  return (
    <div className="text-center">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
        <div className="text-4xl mb-4">📁</div>
        <h3 className="text-lg font-medium mb-2">{t('kb.imports.upload.drop_here')}</h3>
        <p className="text-gray-500 mb-4">{t('kb.imports.upload.or_browse')}</p>
        <p className="text-sm text-gray-400 mb-4">{t('kb.imports.upload.allowed_types')}</p>
        <Button onClick={onNext}>{t('kb.imports.upload.next')}</Button>
      </div>
    </div>
  )
}

function MappingStep({ data, onChange, onNext, onBack }) {
  const { t } = useTranslation('pages')
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{t('kb.imports.mapping.title')}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('kb.imports.mapping.source_field')}</label>
          <input className="w-full px-3 py-2 border rounded" placeholder="Source field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('kb.imports.mapping.target_field')}</label>
          <input className="w-full px-3 py-2 border rounded" placeholder="Target field" />
        </div>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>{t('kb.imports.mapping.back')}</Button>
        <Button onClick={onNext}>{t('kb.imports.mapping.next')}</Button>
      </div>
    </div>
  )
}

function ValidateStep({ data, errors, onDownloadReport, onNext, onBack }) {
  const { t } = useTranslation('pages')
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{t('kb.imports.validate.title')}</h3>
      {errors.length > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 mb-2">{t('kb.imports.validate.errors_found')}</p>
          <Button variant="outline" size="sm" onClick={onDownloadReport} data-testid="download-report">
            {t('kb.imports.validate.download_report')}
          </Button>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">✅ All data validated successfully</p>
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>{t('kb.imports.validate.back')}</Button>
        <Button onClick={onNext} disabled={errors.length > 0}>{t('kb.imports.validate.next')}</Button>
      </div>
    </div>
  )
}

function ConfirmStep({ data, onConfirm, onBack }) {
  const { t } = useTranslation('pages')
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{t('kb.imports.confirm.summary')}</h3>
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-600">Ready to import your data</p>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>{t('kb.imports.confirm.back')}</Button>
        <Button onClick={onConfirm}>{t('kb.imports.confirm.import_now')}</Button>
      </div>
    </div>
  )
}
