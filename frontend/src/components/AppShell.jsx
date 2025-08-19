import React from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { useLocation, Link } from 'react-router-dom'
import { 
  HomeIcon, 
  ChartBarIcon, 
  PhoneIcon, 
  CogIcon, 
  CreditCardIcon, 
  UserGroupIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  BellIcon
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Campaigns', href: '/campaigns', icon: PhoneIcon },
  { name: 'Import', href: '/import', icon: DocumentTextIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
  { name: 'Billing', href: '/billing', icon: CreditCardIcon },
  { name: 'Members', href: '/invite', icon: UserGroupIcon },
]

export default function AppShell({ children }) {
  const { t } = useI18n()
  const location = useLocation()
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex h-16 items-center justify-between px-6">
          {/* Left: Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-semibold text-gray-900">Agoralia</h1>
            </div>
          </div>
          
          {/* Center: Global Search */}
          <div className="flex-1 max-w-lg mx-8">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('common.search') || 'Search...'}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center space-x-4">
            {/* Test Mode Pill */}
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              Test Mode
            </div>
            
            {/* Notifications */}
            <button className="p-2 text-gray-400 hover:text-gray-500">
              <BellIcon className="h-5 w-5" />
            </button>
            
            {/* User Menu */}
            <div className="relative">
              <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100">
                <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">A</span>
                </div>
                <span className="text-sm font-medium text-gray-700">Admin</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex">
        {/* Sidebar Compatta */}
        <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group relative p-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-green-50 text-green-600' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
                title={item.name}
              >
                <item.icon className="h-6 w-6" />
                
                {/* Label on hover */}
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {item.name}
                </div>
              </Link>
            )
          })}
        </div>
        
        {/* Main Content */}
        <div className="flex-1">
          <main className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
