import React, { useState, useEffect } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch } from '../lib/api.js'
import { useToast } from '../components/ToastProvider.jsx'
import { 
  UserIcon, 
  BuildingOfficeIcon, 
  PhoneIcon, 
  UserGroupIcon, 
  ShieldCheckIcon, 
  CogIcon,
  CreditCardIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

// Tab components
function PersonalTab() {
  const { t } = useI18n()
  const [formData, setFormData] = useState({
    name: 'Admin User',
    email: 'admin@example.com',
    language: 'en-US',
    timezone: 'UTC',
    dualTime: false
  })

  const handleSave = async () => {
    try {
      await apiFetch('/settings/personal', { 
        method: 'PUT', 
        body: formData 
      })
      // Show success toast
    } catch (error) {
      console.error('Save failed:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('settings.personal.title') || 'Personal Information'}
        </h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.personal.name') || 'Full Name'}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.personal.email') || 'Email'}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.personal.language') || 'Language'}
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({...formData, language: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="en-US">English</option>
              <option value="it-IT">Italiano</option>
              <option value="fr-FR">Français</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.personal.timezone') || 'Timezone'}
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({...formData, timezone: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="UTC">UTC</option>
              <option value="Europe/Rome">Europe/Rome (UTC+1)</option>
              <option value="Europe/London">Europe/London (UTC+0)</option>
              <option value="America/New_York">America/New_York (UTC-5)</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center mt-6">
          <input
            type="checkbox"
            id="dualTime"
            checked={formData.dualTime}
            onChange={(e) => setFormData({...formData, dualTime: e.target.checked})}
            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
          />
          <label htmlFor="dualTime" className="ml-2 text-sm text-gray-700">
            {t('settings.personal.dual_time') || 'Show dual time in interface'}
          </label>
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            {t('common.save') || 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WorkspaceTab() {
  const { t } = useI18n()
  const [formData, setFormData] = useState({
    name: 'Demo Workspace',
    domain: 'demo.agoralia.com',
    logo: null,
    timezone: 'Europe/Rome'
  })

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('settings.workspace.title') || 'Workspace Settings'}
        </h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.workspace.name') || 'Workspace Name'}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.workspace.domain') || 'Custom Domain'}
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({...formData, domain: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.workspace.logo') || 'Workspace Logo'}
          </label>
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center">
              {formData.logo ? (
                <img src={formData.logo} alt="Logo" className="h-12 w-12 object-contain" />
              ) : (
                <BuildingOfficeIcon className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              {t('settings.workspace.upload_logo') || 'Upload Logo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TelephonyTab() {
  const { t } = useI18n()
  const [numbers, setNumbers] = useState([
    { id: '1', number: '+1234567890', country: 'US', status: 'verified', assigned: 'Agent 1' },
    { id: '2', number: '+393331234567', country: 'IT', status: 'pending', assigned: null }
  ])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('settings.telephony.numbers') || 'Phone Numbers'}
          </h3>
          <button className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700">
            {t('settings.telephony.buy_number') || 'Buy Number'}
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Number</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Country</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Assigned To</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((num) => (
                <tr key={num.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-900 font-mono">{num.number}</td>
                  <td className="py-3 px-4 text-gray-600">{num.country}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      num.status === 'verified' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {num.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {num.assigned || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      {num.status === 'pending' && (
                        <button className="text-sm text-blue-600 hover:text-blue-800">
                          Verify
                        </button>
                      )}
                      <button className="text-sm text-gray-600 hover:text-gray-800">
                        Assign
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MembersTab() {
  const { t } = useI18n()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'viewer' })

  useEffect(() => {
    // Load members and invites
    const loadData = async () => {
      try {
        const [membersRes, invitesRes] = await Promise.all([
          apiFetch('/workspaces/members'),
          apiFetch('/workspaces/invites')
        ])
        setMembers(membersRes.items || [])
        setInvites(invitesRes.items || [])
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }
    loadData()
  }, [])

  const handleInvite = async () => {
    try {
      await apiFetch('/workspaces/invites', {
        method: 'POST',
        body: inviteForm
      })
      setInviteForm({ email: '', role: 'viewer' })
      // Reload invites
    } catch (error) {
      console.error('Invite failed:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('settings.workspace.members') || 'Team Members'}
        </h3>
        
        {/* Invite Form */}
        <div className="flex space-x-4 mb-6">
          <input
            type="email"
            placeholder={t('settings.workspace.invite_email') || 'Email address'}
            value={inviteForm.email}
            onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <select
            value={inviteForm.role}
            onChange={(e) => setInviteForm({...inviteForm, role: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={!inviteForm.email}
            className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {t('settings.workspace.invite') || 'Invite'}
          </button>
        </div>
        
        {/* Members List */}
        <div className="space-y-4">
          {members.map((member) => (
            <div key={member.user_id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{member.email}</p>
                <p className="text-sm text-gray-500">{member.role}</p>
              </div>
              <button className="text-sm text-red-600 hover:text-red-800">
                {t('settings.workspace.remove') || 'Remove'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Main Settings component
export default function Settings() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('personal')
  
  const tabs = [
    { id: 'personal', name: t('settings.tabs.personal') || 'Personal', icon: UserIcon },
    { id: 'workspace', name: t('settings.tabs.workspace') || 'Workspace', icon: BuildingOfficeIcon },
    { id: 'telephony', name: t('settings.tabs.telephony') || 'Telephony', icon: PhoneIcon },
    { id: 'members', name: t('settings.tabs.members') || 'Members', icon: UserGroupIcon },
    { id: 'compliance', name: t('settings.tabs.compliance') || 'Compliance', icon: ShieldCheckIcon },
    { id: 'integrations', name: t('settings.tabs.integrations') || 'Integrations', icon: CogIcon },
    { id: 'billing', name: t('settings.tabs.billing') || 'Billing', icon: CreditCardIcon },
    { id: 'audit', name: t('settings.tabs.audit') || 'Audit', icon: DocumentTextIcon }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'personal':
        return <PersonalTab />
      case 'workspace':
        return <WorkspaceTab />
      case 'telephony':
        return <TelephonyTab />
      case 'members':
        return <MembersTab />
      default:
        return (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {tabs.find(t => t.id === activeTab)?.name}
            </h3>
            <p className="text-gray-600">
              {t('settings.coming_soon') || 'This section is coming soon...'}
            </p>
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {t('settings.title') || 'Settings'}
        </h1>
        <p className="text-gray-600">
          {t('settings.subtitle') || 'Manage your workspace, team, and preferences'}
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Tab Content */}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}


