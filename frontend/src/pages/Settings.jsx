import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiWithDemo } from '../lib/demoGate'
import { useIsDemo } from '../lib/useDemoData'
import { useAuth } from '../lib/useAuth'
import { useToast } from '../components/ToastProvider.jsx'
import { personalSettingsSchema } from '../lib/validation/settings.js'
import { 
  FormRow, 
  FieldLabel, 
  FieldHelp, 
  FieldError, 
  FormActions, 
  PageHeader 
} from '../components/ui/FormPrimitives.jsx'
import SettingsCompany from './SettingsCompany'
import SettingsAudit from './SettingsAudit'
import tzdata from "../lib/timezones.js"

// Personal/Account Tab Component
function PersonalTab() {
  const { t } = useTranslation('settings')
  const { toast } = useToast()
  const { get, put } = useApiWithDemo()
  const { user, setUser } = useAuth()
  const isDemo = useIsDemo()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    language: 'en-US',
    timezone: 'UTC',
    dualTime: false
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadPersonalSettings()
  }, [])

  const loadPersonalSettings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Usa endpoint corretto per profilo utente
      const data = await get('/settings/profile')
      setFormData(data || {
        name: '',
        email: '',
        language: 'en-US',
        timezone: 'UTC',
        dualTime: false
      })
    } catch (error) {
      setError(error)
      // Fallback: usa dati da AuthContext se disponibili
      if (user) {
        setFormData({
          name: user.name || user.email?.split('@')[0] || '',
          email: user.email || '',
          language: user.locale || 'en-US',
          timezone: user.timezone || 'UTC',
          dualTime: false
        })
      } else if (isDemo) {
        // In demo, mostra dati fittizi per non far biancheggiare la UI
        setFormData({
          name: 'Demo User',
          email: 'demo@example.com',
          language: 'en-US',
          timezone: 'Europe/Rome',
          dualTime: false
        })
      } else {
        toast({
          title: t('account.errors.load_failed'),
          description: error.message,
          type: 'error'
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = () => {
    try {
      personalSettingsSchema.parse(formData)
      setErrors({})
      return true
    } catch (error) {
      const newErrors = {}
      error.errors.forEach((err) => {
        newErrors[err.path[0]] = err.message
      })
      setErrors(newErrors)
      return false
    }
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setIsSaving(true)
    try {
      // Usa endpoint corretto per aggiornare profilo
      await put('/auth/me', formData)
      
      // Aggiorna AuthContext per header
      if (user && setUser) {
        setUser({...user, ...formData})
      }
      
      toast({
        title: t('account.messages.saved'),
        type: 'success'
      })
    } catch (error) {
      toast({
        title: t('account.errors.save_failed'),
        description: error.message,
        type: 'error'
      })
    } finally {
      setIsSaving(false)
    }
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
          {t('settings.account.title', { ns: 'pages' })}
        </h3>
        
        <div className="grid grid-cols-2 gap-6">
          <FormRow>
            <FieldLabel htmlFor="name" required>
              {t('account.fields.name')}
            </FieldLabel>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            <FieldError>{errors.name}</FieldError>
          </FormRow>
          
          <FormRow>
            <FieldLabel htmlFor="email" required>
              {t('account.fields.email')}
            </FieldLabel>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.email ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            <FieldError>{errors.email}</FieldError>
          </FormRow>
          
          <FormRow>
            <FieldLabel htmlFor="language" required>
              {t('account.fields.language')}
            </FieldLabel>
            <select
              id="language"
              value={formData.language}
              onChange={(e) => setFormData({...formData, language: e.target.value})}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.language ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="en-US">{t('account.languages.english')}</option>
              <option value="it-IT">{t('account.languages.italian')}</option>
              <option value="fr-FR">{t('account.languages.french')}</option>
            </select>
            <FieldError>{errors.language}</FieldError>
          </FormRow>
          
          <FormRow>
            <FieldLabel htmlFor="timezone" required>
              {t('account.fields.timezone')}
            </FieldLabel>
            <select
              id="timezone"
              value={formData.timezone}
              onChange={(e) => setFormData({...formData, timezone: e.target.value})}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.timezone ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              {tzdata.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            <FieldError>{errors.timezone}</FieldError>
          </FormRow>
        </div>
        
        <div className="flex items-center mt-6">
          <input
            type="checkbox"
            id="dualTime"
            checked={formData.dualTime}
            onChange={(e) => setFormData({...formData, dualTime: e.target.checked})}
            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
          />
          <label htmlFor="dualTime" className="ml-2 text-sm text-sm text-gray-700">
            {t('account.fields.dual_time')}
          </label>
        </div>
        
        <FormActions>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? t('common.saving') : t('account.actions.save')}
          </button>
        </FormActions>
      </div>
    </div>
  )
}

// Main Settings component
export default function Settings() {
  const { t } = useTranslation('settings')
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  
  const isAdmin = user?.roles?.includes('admin') || user?.is_admin
  
  const tabs = [
    { id: 'profile', name: t('tabs.profile'), component: PersonalTab },
    { id: 'company', name: t('tabs.company'), component: SettingsCompany }
  ]
  
  // Add audit tab for admins
  if (isAdmin) {
    tabs.push({ id: 'audit', name: 'Activity Log', component: SettingsAudit })
  }

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component

  return (
    <div className="space-y-6">
      <PageHeader 
        title={t('title')}
        description={t('description')}
      />

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  )
}


