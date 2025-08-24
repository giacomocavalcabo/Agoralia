import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/FormPrimitives.jsx'
import { formatDateSafe } from '../lib/format'
import { useApiWithDemo } from '../lib/demoGate'

export default function LeadDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('pages')
  const { get } = useApiWithDemo()
  
  const [lead, setLead] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    let alive = true
    
    ;(async () => {
      try {
        const data = await get(`/leads/${id}`)
        if (!alive) return
        setLead(data)
      } catch (e) {
        if (!alive) return
        setError(e)
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => { alive = false }
  }, [id, get])

  if (loading) {
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

  if (error) {
    return (
      <div className="px-6 lg:px-8 py-6">
        <PageHeader
          title={t('leads.details.error.title') || 'Error Loading Lead'}
          description={t('leads.details.error.description') || 'Unable to load lead details'}
        />
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error.message || 'Unknown error occurred'}</p>
          <button 
            onClick={() => navigate('/leads')}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            {t('common.back_to_leads') || 'Back to Leads'}
          </button>
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="px-6 lg:px-8 py-6">
        <PageHeader
          title={t('leads.details.not_found.title') || 'Lead Not Found'}
          description={t('leads.details.not_found.description') || 'The requested lead could not be found'}
        />
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">{t('leads.details.not_found.message') || 'Lead not found or you may not have permission to view it.'}</p>
          <button 
            onClick={() => navigate('/leads')}
            className="mt-2 text-yellow-600 hover:text-yellow-800 underline"
          >
            {t('common.back_to_leads') || 'Back to Leads'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 lg:px-8 py-6">
      <PageHeader
        title={lead.name || lead.email || `Lead ${id}`}
        description={t('leads.details.description') || 'Lead details and information'}
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
              <dt className="text-sm font-medium text-gray-500">{t('leads.fields.name') || 'Name'}</dt>
              <dd className="text-sm text-gray-900">{lead.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('leads.fields.email') || 'Email'}</dt>
              <dd className="text-sm text-gray-900">{lead.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('leads.fields.phone') || 'Phone'}</dt>
              <dd className="text-sm text-gray-900">{lead.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('leads.fields.company') || 'Company'}</dt>
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
              <dt className="text-sm font-medium text-gray-500">{t('leads.fields.status') || 'Status'}</dt>
              <dd className="text-sm">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  lead.status === 'active' ? 'bg-green-100 text-green-800' :
                  lead.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {lead.status || 'unknown'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('leads.fields.created_at') || 'Created'}</dt>
              <dd className="text-sm text-gray-900">{formatDateSafe(lead.created_at)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('leads.fields.last_contact') || 'Last Contact'}</dt>
              <dd className="text-sm text-gray-900">{formatDateSafe(lead.last_contact)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
