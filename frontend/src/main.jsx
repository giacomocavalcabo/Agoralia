import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import { I18nProvider } from './lib/i18n.jsx'
import ToastProvider from './components/ToastProvider.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'
import { AuthProvider, RequireAuth } from './lib/auth.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import RouteLoader from './components/RouteLoader.jsx'

// Simple placeholder Dashboard
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const GoogleLoginCallback = lazy(() => import('./pages/GoogleLoginCallback.jsx'))

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('auth_token')
  const tenantId = localStorage.getItem('tenant_id')
  if (!token || !tenantId) return <Navigate to="/login" replace />
  return <RequireAuth>{children}</RequireAuth>
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary><NotFound /></ErrorBoundary>,
  },
  { path: '/login', element: <Login /> },
  { path: '/google-login/callback', element: <GoogleLoginCallback /> },
  { path: '*', element: <NotFound /> },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<RouteLoader />}>
            <RouterProvider router={router} />
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
)
