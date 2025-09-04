import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/ui/FormPrimitives.jsx'
import { api } from '../lib/api'
import { normalizePhoneNumber } from '../lib/phoneUtils'

export default function LeadsNew() {
  const { t } = useTranslation('pages')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    country_iso: 'IT',
    lang: 'it-IT',
    role: '',
    contact_class: 'unknown',
    relationship_basis: 'unknown',
    opt_in: false,
    national_dnc: 'unknown',
    notes: ''
  })
  
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const createLead = useMutation({
    mutationFn: async (leadData) => {
      // Normalize phone number
      const normalized = normalizePhoneNumber(leadData.phone, leadData.country_iso)
      if (!normalized.isValid) {
        throw new Error(t('leads.new.errors.invalid_phone') || 'Invalid phone number')
      }
      
      const payload = {
        ...leadData,
        phone_e164: normalized.e164,
        country_iso: normalized.country || leadData.country_iso
      }
      
      const { data } = await api.post('/leads', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      navigate('/leads')
    },
    onError: (error) => {
      setErrors({ submit: error.message })
    }
  })
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setIsSubmitting(true)
    
    try {
      await createLead.mutateAsync(formData)
    } catch (error) {
      // Error handled in mutation
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }
  
  return (
    <div className="px-6 lg:px-8 py-6">
      <PageHeader
        title={t('leads.new.title') || 'New Lead'}
        description={t('leads.new.description') || 'Create a new lead manually'}
      />
      
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('leads.fields.name') || 'Name'} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>
            
            {/* Company */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('leads.fields.company') || 'Company'}
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => handleChange('company', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('leads.fields.email') || 'Email'}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('leads.fields.phone') || 'Phone'} *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+39 123 456 7890"
                required
              />
              {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
            </div>
            
            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('leads.fields.country') || 'Country'}
              </label>
              <select
                value={formData.country_iso}
                onChange={(e) => handleChange('country_iso', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="IT">Italy</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="FR">France</option>
                <option value="DE">Germany</option>
                <option value="ES">Spain</option>
              </select>
            </div>
            
            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('leads.fields.language') || 'Language'}
              </label>
              <select
                value={formData.lang}
                onChange={(e) => handleChange('lang', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="it-IT">Italian</option>
                <option value="en-US">English</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
              </select>
            </div>
            
            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('leads.fields.role') || 'Role'}
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('leads.fields.role_placeholder') || 'e.g. CEO, Manager, Director'}
              />
            </div>
            
            {/* Contact Class */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('leads.fields.contact_class') || 'Contact Type'}
              </label>
              <select
                value={formData.contact_class}
                onChange={(e) => handleChange('contact_class', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="unknown">{t('leads.fields.contact_class_unknown') || 'Unknown'}</option>
                <option value="b2b">{t('leads.fields.contact_class_b2b') || 'B2B'}</option>
                <option value="b2c">{t('leads.fields.contact_class_b2c') || 'B2C'}</option>
              </select>
            </div>
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('leads.fields.notes') || 'Notes'}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('leads.fields.notes_placeholder') || 'Additional notes about this lead...'}
            />
          </div>
          
          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/leads')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (t('common.creating') || 'Creating...') : (t('common.create') || 'Create Lead')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
