import { ReactNode, useState } from 'react'
import { Card } from '@/shared/ui/card'
import { Settings, User } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

interface SettingsLayoutProps {
  children: ReactNode
  activeSection: string
  onSectionChange: (section: string) => void
  isAdmin: boolean
}

const workspaceSections = [
  { id: 'general', label: 'General' },
  { id: 'telephony', label: 'Telephony' },
  { id: 'budget', label: 'Budget' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'quiet-hours', label: 'Quiet Hours' },
  { id: 'integrations', label: 'Integrations' },
]

const preferencesSections = [
  { id: 'ui', label: 'UI' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'dashboard', label: 'Dashboard' },
]

export function SettingsLayout({
  children,
  activeSection,
  onSectionChange,
  isAdmin,
}: SettingsLayoutProps) {
  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0">
        <Card className="p-4">
          <nav className="space-y-6">
            {isAdmin && (
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Settings className="h-4 w-4" />
                  Workspace Settings
                </div>
                <div className="space-y-1">
                  {workspaceSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => onSectionChange(section.id)}
                      className={cn(
                        'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                        activeSection === section.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <User className="h-4 w-4" />
                Preferences
              </div>
              <div className="space-y-1">
                {preferencesSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => onSectionChange(section.id)}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                      activeSection === section.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </Card>
      </aside>

      {/* Content */}
      <div className="flex-1">{children}</div>
    </div>
  )
}

