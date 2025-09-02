import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiWithDemo } from '../lib/demoGate'
import { useAuth } from '../lib/useAuth'
import { useToast } from '../components/ToastProvider.jsx'
import DateCell from '../components/DateCell'

export default function SettingsAudit() {
  const { t } = useTranslation('settings')
  const { get } = useApiWithDemo()
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)

  // Check if user is admin
  const isAdmin = user?.roles?.includes('admin') || user?.is_admin

  useEffect(() => {
    if (isAdmin) {
      loadAuditLogs()
    }
  }, [isAdmin])

  const loadAuditLogs = async (cursor = null) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (cursor) params.append('cursor', cursor)
      
      const data = await get(`/audit?${params}`)
      if (cursor) {
        setEvents(prev => [...prev, ...data.events])
      } else {
        setEvents(data.events || [])
      }
      setNextCursor(data.next_cursor)
    } catch (error) {
      toast({
        title: 'Error loading audit logs',
        description: error.message,
        type: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (nextCursor && !loading) {
      loadAuditLogs(nextCursor)
    }
  }

  const getActionColor = (action) => {
    if (action.includes('success')) return 'text-green-600'
    if (action.includes('failed')) return 'text-red-600'
    if (action.includes('change')) return 'text-blue-600'
    if (action.includes('update')) return 'text-purple-600'
    return 'text-gray-600'
  }

  const getActionIcon = (action) => {
    if (action.includes('login')) return '🔐'
    if (action.includes('timezone')) return '🌍'
    if (action.includes('workspace')) return '🏢'
    if (action.includes('profile')) return '👤'
    return '📝'
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Access Denied
            </h3>
            <p className="text-gray-500">
              You need admin permissions to view audit logs.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Activity Log
        </h3>
        
        {loading && events.length === 0 ? (
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="flex items-start space-x-4 p-4 border border-gray-100 rounded-lg">
                <div className="text-2xl">{getActionIcon(event.action)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${getActionColor(event.action)}`}>
                      {event.action.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <DateCell 
                      isoUtc={event.created_at} 
                      options={{ dateStyle: "short", timeStyle: "short" }}
                    />
                  </div>
                  
                  {event.user && (
                    <p className="text-sm text-gray-600 mt-1">
                      by {event.user.name || event.user.email}
                    </p>
                  )}
                  
                  {event.resource && (
                    <p className="text-xs text-gray-500 mt-1">
                      {event.resource.type}: {event.resource.id}
                    </p>
                  )}
                  
                  {event.meta && Object.keys(event.meta).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {Object.entries(event.meta).map(([key, value]) => (
                        <span key={key} className="inline-block mr-2">
                          {key}: <span className="font-mono">{String(value)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {event.ip && (
                    <p className="text-xs text-gray-400 mt-1">
                      IP: {event.ip}
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            {events.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No audit events found
              </div>
            )}
            
            {nextCursor && (
              <div className="text-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
