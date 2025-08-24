import React from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/FormPrimitives.jsx'

export default function LeadsImport() {
  const { t } = useTranslation('pages')
  
  return (
    <div className="px-6 lg:px-8 py-6">
      <PageHeader
        title={t('leads.import.title') || 'Import Leads'}
        description={t('leads.import.description') || 'Import leads from CSV or other sources'}
      />
      
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('leads.import.coming_soon') || 'Coming Soon'}
          </h3>
          <p className="text-gray-500">
            {t('leads.import.description') || 'Lead import functionality will be available soon.'}
          </p>
        </div>
      </div>
    </div>
  )
}
