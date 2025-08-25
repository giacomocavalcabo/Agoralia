import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/ui/FormPrimitives.jsx'
import { formatDateSafe } from '../lib/format'
import { api } from '../lib/api'

export default function LeadDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('pages')
  
  const { data: lead, error, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => (await api.get(`/leads/${id}`)).data
  })

  if (isLoading) {
    return (
      <div className="px-6 lg:px-8 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="px-6 lg:px-8 py-6">
        <PageHeader
          title={t('leads.details.error.title') || 'Error Loading Lead'}
          description={t('leads.details.error.description') || 'Unable to load lead details'}
        />
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error?.message || 'Lead not found'}</p>
          <button 
            onClick={() => navigate('/leads')}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            {t('common.back') || 'Back to Leads'}
          </button>
        </div>
      </div>
    )
  }



  return (
    <div className="px-6 lg:px-8 py-6">
      <PageHeader
        title={t('leads.details.title', { name: lead.name || '—' })}
        description={t('leads.details.description')}
      >
        <div className="flex gap-2">
          <button 
            onClick={() => navigate('/leads')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t('common.back') || 'Back'}
          </button>
          <button 
            onClick={() => navigate(`/leads/${id}/edit`)}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {t('common.edit') || 'Edit'}
          </button>
        </div>
      </PageHeader>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t('leads.details.basic_info') || 'Basic Information'}
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('leads.details.fields.email')}</dt>
              <dd className="text-sm text-gray-900">{lead.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('leads.details.fields.phone')}</dt>
              <dd className="text-sm text-gray-900">{lead.phone_e164 || lead.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('leads.details.fields.company')}</dt>
              <dd className="text-sm text-gray-900">{lead.company || '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Status & Timeline */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t('leads.details.status_timeline') || 'Status & Timeline'}
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('leads.details.fields.status')}</dt>
              <dd className="text-sm">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  lead.status === 'active' ? 'bg-green-100 text-green-800' :
                  lead.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {t(`leads.status.${lead.status || 'unknown'}`)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('leads.details.fields.created_at')}</dt>
              <dd className="text-sm text-gray-900">{formatDateSafe(lead.created_at, i18n.language)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('leads.details.fields.last_contact')}</dt>
              <dd className="text-sm text-gray-900">{formatDateSafe(lead.last_contact, i18n.language)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
