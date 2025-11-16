import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '@/shared/layout/RootLayout'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { NotFoundPage } from '@/shared/pages/NotFoundPage'
import { SetupPage } from '@/features/setup/pages/SetupPage'
import { AgentsPage } from '@/features/agents/pages/AgentsPage'
import { NumbersPage } from '@/features/numbers/pages/NumbersPage'
import { KnowledgePage } from '@/features/knowledge/pages/KnowledgePage'
import { LeadsPage } from '@/features/leads/pages/LeadsPage'
import { CampaignsPage } from '@/features/campaigns/pages/CampaignsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token')
  const tenantId = localStorage.getItem('tenant_id')

  if (!token || !tenantId) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'setup', element: <SetupPage /> },
      { path: 'agents', element: <AgentsPage /> },
      { path: 'numbers', element: <NumbersPage /> },
      { path: 'knowledge', element: <KnowledgePage /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'campaigns', element: <CampaignsPage /> },
      // TODO: Add more routes
      // { path: 'campaigns/new', element: <CampaignNewPage /> },
      // { path: 'campaigns/:id', element: <CampaignDetailPage /> },
      // { path: 'calls', element: <CallsPage /> },
      // { path: 'compliance', element: <CompliancePage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
