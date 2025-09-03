import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiWithDemo } from '../lib/demoGate'
import { useAuth } from '../lib/useAuth'
import { useToast } from '../components/ToastProvider.jsx'
import { PageHeader } from '../components/ui/FormPrimitives.jsx'

export default function SettingsCompany() {
  const { t } = useTranslation('settings')
  const { get, put } = useApiWithDemo()
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [formData, setFormData] = useState({
    company_name: '',
    domain: '',
    vat_id: '',
    brand_color: '#0EA5E9',
    logo_url: '',
    support_email: '',
    legal_name: '',
    website_url: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Check if user is admin
  const isAdmin = user?.roles?.includes('admin') || user?.is_admin

  useEffect(() => {
    if (isAdmin) {
      loadCompanySettings()
    }
  }, [isAdmin])

  const loadCompanySettings = async () => {
    setIsLoading(true)
    try {
      const data = await get('/settings/company')
      setFormData({
        company_name: data?.company_name || 'Your Company',
        domain: data?.domain || '',
        vat_id: data?.vat_id || '',
        brand_color: data?.brand_color || '#0EA5E9',
        logo_url: data?.logo_url || '',
        support_email: data?.support_email || '',
        legal_name: data?.legal_name || '',
        website_url: data?.website_url || ''
      })
    } catch (error) {
      // Fallback per demo o errori
      setFormData({
        company_name: 'Your Company',
        domain: '',
        vat_id: '',
        brand_color: '#0EA5E9',
        logo_url: '',
        support_email: '',
        legal_name: '',
        website_url: ''
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await put('/settings/company', formData)
      toast({
        title: t('company.messages.saved'),
        type: 'success'
      })
    } catch (error) {
      toast({
        title: t('company.errors.save_failed'),
        description: error.message,
        type: 'error'
      })
    } finally {
      setIsSaving(false)
    }
  }



  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('company.access_denied')}
            </h3>
            <p className="text-gray-500">
              You need admin permissions to access company settings.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('company.branding.title')}
        </h3>
        
        <div className="grid grid-cols-2 gap-6">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => setFormData({...formData, company_name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Domain */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domain
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({...formData, domain: e.target.value})}
              placeholder="example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* VAT ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              VAT ID
            </label>
            <input
              type="text"
              value={formData.vat_id}
              onChange={(e) => setFormData({...formData, vat_id: e.target.value})}
              placeholder="IT12345678901"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Brand Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand Color
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.brand_color}
                onChange={(e) => setFormData({...formData, brand_color: e.target.value})}
                className="h-10 w-20 rounded border border-gray-300"
              />
              <input
                type="text"
                value={formData.brand_color}
                onChange={(e) => setFormData({...formData, brand_color: e.target.value})}
                placeholder="#0EA5E9"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Support Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Support Email
            </label>
            <input
              type="email"
              value={formData.support_email}
              onChange={(e) => setFormData({...formData, support_email: e.target.value})}
              placeholder="support@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website URL
            </label>
            <input
              type="url"
              value={formData.website_url}
              onChange={(e) => setFormData({...formData, website_url: e.target.value})}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>


        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? t('common.saving') : t('account.actions.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
