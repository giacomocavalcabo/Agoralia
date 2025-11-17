import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SettingsLayout } from '../components/SettingsLayout'
import { GeneralSection } from '../components/WorkspaceSettings/GeneralSection'
import { TelephonySection } from '../components/WorkspaceSettings/TelephonySection'
import { BudgetSection } from '../components/WorkspaceSettings/BudgetSection'
import { ComplianceSection } from '../components/WorkspaceSettings/ComplianceSection'
import { QuietHoursSection } from '../components/WorkspaceSettings/QuietHoursSection'
import { IntegrationsSection } from '../components/WorkspaceSettings/IntegrationsSection'
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

  const renderSection = () => {
    if (!isAdmin && ['general', 'telephony', 'budget', 'compliance', 'quiet-hours', 'integrations'].includes(activeSection)) {
      return (
        <div className="py-12 text-center text-sm text-muted-foreground">
          You need admin access to view workspace settings.
        </div>
      )
    }

    switch (activeSection) {
      case 'general':
        return <GeneralSection />
      case 'telephony':
        return <TelephonySection />
      case 'budget':
        return <BudgetSection />
      case 'compliance':
        return <ComplianceSection />
      case 'quiet-hours':
        return <QuietHoursSection />
      case 'integrations':
        return <IntegrationsSection />
      case 'ui':
        return <div>UI Preferences (coming soon)</div>
      case 'notifications':
        return <div>Notifications (coming soon)</div>
      case 'dashboard':
        return <div>Dashboard (coming soon)</div>
      default:
        return <div>Section not found</div>
    }
  }

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
        {renderSection()}
      </SettingsLayout>
    </div>
  )
}
