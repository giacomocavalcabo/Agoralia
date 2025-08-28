import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, Link } from 'react-router-dom'
import { useAuth } from '../lib/useAuth.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'
import { useIsDemo } from '../lib/demoGate.js'
import { 
  HomeIcon, 
  ChartBarIcon, 
  PhoneIcon, 
  CogIcon, 
  CreditCardIcon, 
  UserGroupIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  BellIcon,
  UserIcon,
  CalendarIcon,
  HashtagIcon,
  BookOpenIcon,
  ClockIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Leads', href: '/leads', icon: UserIcon },
  { name: 'Campaigns', href: '/campaigns', icon: PhoneIcon },
  { name: 'Calendar', href: '/calendar', icon: CalendarIcon },
  { name: 'Numbers', href: '/numbers', icon: HashtagIcon },
  { name: 'Knowledge Base', href: '/knowledge', icon: BookOpenIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'History', href: '/history', icon: ClockIcon },
  { name: 'Import', href: '/import', icon: DocumentTextIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
  { name: 'Members', href: '/invite', icon: UserGroupIcon },
]

// Admin navigation (only for global admins)
const adminNavigation = [
  { name: 'Admin', href: '/admin', icon: ShieldCheckIcon },
]

export default function AppShell({ children }) {
  const { t } = useTranslation('common')
  const location = useLocation()
  const { user, logout } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const isDemo = useIsDemo()
  
  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuOpen && !event.target.closest('.user-menu')) {
        setUserMenuOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])
  
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${
          sidebarExpanded ? 'w-64' : 'w-16'
        } group hover:w-64`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b border-gray-200">
            <div className="flex-shrink-0">
              <h1 className={`font-semibold text-gray-900 transition-all duration-300 ${
                sidebarExpanded ? 'text-xl' : 'text-lg'
              }`}>
                {sidebarExpanded ? 'Agoralia' : 'A'}
              </h1>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-500'
                      : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
                  }`}
                  title={t(`nav.${item.name.toLowerCase()}`) || item.name}
                  aria-label={t(`nav.${item.name.toLowerCase()}`) || item.name}
                >
                  <item.icon className={`flex-shrink-0 h-5 w-5 transition-all duration-300 ${
                    sidebarExpanded ? 'mr-3' : 'mr-0'
                  }`} />
                  <span className={`transition-all duration-300 ${
                    sidebarExpanded ? 'opacity-100' : 'opacity-0'
                  }`}>
                    {item.name}
                  </span>
                </Link>
              )
            })}
          </nav>
          
          {/* Admin Navigation */}
          {user?.is_admin && (
            <div className="px-2 py-4 border-t border-gray-200">
              <div className="text-xs font-medium text-gray-500 px-3 mb-2">
                {sidebarExpanded ? 'Admin' : ''}
              </div>
              {adminNavigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                      isActive
                        ? 'bg-red-100 text-red-700 border-r-2 border-red-500'
                        : 'text-gray-600 hover:bg-red-50 hover:text-red-600'
                    }`}
                    title={t(`nav.${item.name.toLowerCase()}`) || item.name}
                    aria-label={t(`nav.${item.name.toLowerCase()}`) || item.name}
                  >
                    <item.icon className={`flex-shrink-0 h-5 w-5 transition-all duration-300 ${
                      sidebarExpanded ? 'mr-3' : 'mr-0'
                    }`} />
                    <span className={`transition-all duration-300 ${
                      sidebarExpanded ? 'opacity-100' : 'opacity-0'
                    }`}>
                      {item.name}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ease-in-out ${
        sidebarExpanded ? 'ml-64' : 'ml-16'
      }`}>
        {/* Topbar */}
        <div className="bg-white border-b border-gray-200">
          <div className="flex h-16 items-center justify-between px-6">
            {/* Left: Demo Badge */}
            <div className="flex items-center gap-2">
              {isDemo && (
                <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
                  Demo
                </span>
              )}
            </div>
          
            {/* Center: Global Search */}
            <div className="flex-1 max-w-lg mx-8">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('common.search', 'Search')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-transparent"
                />
              </div>
            </div>
          
            {/* Right: Actions */}
            <div className="flex items-center space-x-4">
              {/* Language Switcher */}
              <LanguageSwitcher />
              
              {/* Notifications */}
              {/* TODO: Notifications – hidden until wired */}
              <button className="hidden p-2 text-gray-400 hover:text-gray-500" aria-hidden="true" tabIndex={-1}>
                <BellIcon className="h-5 w-5" />
              </button>
              
              {/* User Menu */}
              <div className="relative user-menu">
                <button 
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {user?.name || user?.email?.split('@')[0] || 'User'}
                  </span>
                  {user?.email === 'giacomo.cavalcabo14@gmail.com' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      Admin
                    </span>
                  )}
                  {/* Dropdown arrow */}
                  <svg 
                    className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.name || user?.email?.split('@')[0] || 'User'}</p>
                      <p className="text-xs text-gray-500 break-all leading-snug" title={user?.email}>
                        {user?.email}
                      </p>
                      {user?.email === 'giacomo.cavalcabo14@gmail.com' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mt-1">
                          Admin
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      
        {/* Main Content */}
        <div className="flex-1 p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
