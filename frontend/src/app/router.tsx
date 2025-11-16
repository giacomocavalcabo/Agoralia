import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '@/shared/layout/RootLayout'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { NotFoundPage } from '@/shared/pages/NotFoundPage'

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
      // TODO: Aggiungere altre route quando implementate
      // { path: 'setup', element: <SetupPage /> },
      // { path: 'campaigns', element: <CampaignListPage /> },
      // ...
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
