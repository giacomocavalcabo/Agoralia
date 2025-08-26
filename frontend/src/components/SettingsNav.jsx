import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  UserIcon, 
  BuildingOfficeIcon, 
  PhoneIcon, 
  UserGroupIcon, 
  ShieldCheckIcon, 
  CogIcon,
  CreditCardIcon,
  DocumentTextIcon,
  KeyIcon,
  BellIcon
} from '@heroicons/react/24/outline'

const settingsNavigation = [
  { 
    id: 'profile', 
    name: 'settings.nav.profile',
    href: 'profile', 
    icon: UserIcon,
    description: 'settings.nav.profile_desc'
  },
  { 
    id: 'company', 
    name: 'settings.nav.company',
    href: 'company', 
    icon: BuildingOfficeIcon,
    description: 'settings.nav.company_desc'
  },
  { 
    id: 'integrations', 
    name: 'settings.nav.integrations',
    href: 'integrations', 
    icon: CogIcon,
    description: 'settings.nav.integrations_desc'
  },
  { 
    id: 'billing', 
    name: 'settings.nav.billing',
    href: 'billing', 
    icon: CreditCardIcon,
    description: 'settings.nav.billing_desc'
  },
  { 
    id: 'telephony', 
    name: 'settings.nav.telephony',
    href: 'telephony', 
    icon: PhoneIcon,
    description: 'settings.nav.telephony_desc'
  }
]

export default function SettingsNav({ className }) {
  const { t } = useTranslation('settings')
  const location = useLocation()
  
  const isActive = (href) => {
    if (href === 'profile') {
      return location.pathname === '/settings' || location.pathname === '/settings/profile'
    }
    return location.pathname.endsWith(href)
  }

  return (
    <nav data-testid="settings-nav" className={`w-64 bg-white border-r border-gray-200 p-6 space-y-2 ${className}`}>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('nav.title')}
        </h2>
        <p className="text-sm text-gray-500">
          {t('nav.subtitle')}
        </p>
      </div>
      
      <div className="space-y-1">
        {settingsNavigation.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          
          return (
            <Link
              key={item.id}
              to={item.href}
              className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                active
                  ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className={`mr-3 h-5 w-5 ${
                active ? 'text-green-500' : 'text-gray-400 group-hover:text-gray-500'
              }`} />
              <div className="flex-1">
                <div className="font-medium">
                  {t(item.name)}
                </div>
                {item.description && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {t(item.description)}
                  </div>
                )}
              </div>

            </Link>
          )
        })}
      </div>
    </nav>
  )
}
