import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SettingsLayout } from '../components/SettingsLayout'
import { GeneralSection } from '../components/WorkspaceSettings/GeneralSection'
import { Button } from '@/shared/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks'

export function SettingsPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('general')
  const { data: authData, refetch: refetchAuth } = useAuth()
  
  // Force refresh auth status when entering Settings page
  useEffect(() => {
    // Refresh auth status to get latest admin status
    refetchAuth()
  }, [refetchAuth])
  
  // Check if user is admin (from auth hook, fallback to localStorage)
  const isAdmin = authData?.is_admin ?? (localStorage.getItem('is_admin') === '1' || localStorage.getItem('is_admin') === 'true')
  
  // Update localStorage when auth data changes
  useEffect(() => {
    if (authData?.is_admin !== undefined) {
      if (authData.is_admin) {
        localStorage.setItem('is_admin', '1')
      } else {
        localStorage.removeItem('is_admin')
      }
    }
  }, [authData?.is_admin])

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // This is a simple check - in production, track unsaved changes per section
      e.preventDefault()
      e.returnValue = ''
    }

    // Only warn if there are actual unsaved changes (simplified for now)
    // window.addEventListener('beforeunload', handleBeforeUnload)
    // return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage workspace settings and your preferences
            </p>
          </div>
        </div>
      </div>

      <SettingsLayout
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        isAdmin={isAdmin}
      >
        {activeSection === 'general' && isAdmin && <GeneralSection />}
        {activeSection === 'general' && !isAdmin && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            You need admin access to view workspace settings.
          </div>
        )}
        {activeSection === 'ui' && <div>UI Preferences (coming soon)</div>}
        {activeSection === 'notifications' && <div>Notifications (coming soon)</div>}
        {activeSection === 'dashboard' && <div>Dashboard (coming soon)</div>}
      </SettingsLayout>
    </div>
  )
}

