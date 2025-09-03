import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/useAuth'
import { PageHeader } from '../components/ui/FormPrimitives.jsx'
import { Outlet, NavLink } from 'react-router-dom'

// Main Settings component with sidebar navigation
export default function Settings() {
  const { t } = useTranslation('settings')
  const { user } = useAuth()
  
  const isAdmin = user?.roles?.includes('admin') || user?.is_admin
  
  const navigation = [
    { id: 'profile', name: t('tabs.profile'), path: '/settings/profile' },
    { id: 'company', name: t('tabs.company'), path: '/settings/company' }
  ]
  
  // Add audit tab for admins
  if (isAdmin) {
    navigation.push({ id: 'audit', name: 'Activity Log', path: '/settings/audit' })
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={t('title')}
        description={t('description')}
      />

      <div className="flex gap-8">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}


