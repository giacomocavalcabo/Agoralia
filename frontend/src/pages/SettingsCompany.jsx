import React from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/FormPrimitives.jsx'

export default function SettingsCompany() {
  const { t } = useTranslation('settings')
  
  return (
    <div className="px-6 lg:px-8 py-6">
      <PageHeader
        title={t('settings.company.title') || 'Company Settings'}
        description={t('settings.company.description') || 'Manage your company information and settings'}
      />
      
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('settings.company.coming_soon') || 'Coming Soon'}
          </h3>
          <p className="text-gray-500">
            {t('settings.company.description') || 'Company settings will be available soon.'}
          </p>
        </div>
      </div>
    </div>
  )
}
