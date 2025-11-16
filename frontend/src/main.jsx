import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Contacts = lazy(() => import('./pages/Contacts.jsx'))
const Analytics = lazy(() => import('./pages/Analytics.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Root = lazy(() => import('./layouts/Root.jsx'))
const Calls = lazy(() => import('./pages/Calls.jsx'))
const History = lazy(() => import('./pages/History.jsx'))
const ContactHistory = lazy(() => import('./pages/ContactHistory.jsx'))
const CallDetail = lazy(() => import('./pages/CallDetail.jsx'))
const ImportPage = lazy(() => import('./pages/Import.jsx'))
const CrmMapping = lazy(() => import('./pages/CrmMapping.jsx'))
const Agents = lazy(() => import('./pages/Agents.jsx'))
const KnowledgeBases = lazy(() => import('./pages/KnowledgeBases.jsx'))
const Numbers = lazy(() => import('./pages/Numbers.jsx'))
const Compliance = lazy(() => import('./pages/Compliance.jsx'))
const Leads = lazy(() => import('./pages/Leads.jsx'))
const Campaigns = lazy(() => import('./pages/Campaigns.jsx'))
const Calendar = lazy(() => import('./pages/Calendar.jsx'))
const Billing = lazy(() => import('./pages/Billing.jsx'))
const Setup = lazy(() => import('./pages/Setup.jsx'))
const CampaignNew = lazy(() => import('./pages/CampaignNew.jsx'))
import { I18nProvider } from './lib/i18n.jsx'
import ToastProvider from './components/ToastProvider.jsx'
import Login from './pages/Login.jsx'
const HubSpotCallback = lazy(() => import('./pages/HubSpotCallback.jsx'))
const GoogleCallback = lazy(() => import('./pages/GoogleCallback.jsx'))
const GoogleLoginCallback = lazy(() => import('./pages/GoogleLoginCallback.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))
import { AuthProvider, RequireAuth } from './lib/auth.jsx'
import NotFound from './pages/NotFound.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import RouteLoader from './components/RouteLoader.jsx'

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
        <Root />
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary><NotFound /></ErrorBoundary>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'leads', element: <Leads /> },
      { path: 'contacts', element: <Navigate to="/leads" replace /> },
      { path: 'contatti', element: <Navigate to="/leads" replace /> },
      { path: 'campaigns', element: <Campaigns /> },
      { path: 'campaigns/new', element: <CampaignNew /> },
      { path: 'setup', element: <Setup /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'calendar', element: <Calendar /> },
      { path: 'billing', element: <Billing /> },
      { path: 'settings', element: <Settings /> },
      { path: 'app', element: <App /> },
      { path: 'calls', element: <History /> },
      { path: 'history/:phone', element: <ContactHistory /> },
      { path: 'calls/:id', element: <CallDetail /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'crm', element: <CrmMapping /> },
      { path: 'agents', element: <Agents /> },
      { path: 'kbs', element: <KnowledgeBases /> },
      { path: 'numbers', element: <Numbers /> },
      { path: 'compliance', element: <Compliance /> },
      { path: 'admin', element: <Admin /> },
    ],
  },
  { path: '/login', element: <Login /> },
  { path: '*', element: <NotFound /> },
  { path: '/hubspot/callback', element: <HubSpotCallback /> },
  { path: '/google/callback', element: <GoogleCallback /> },
  { path: '/google-login/callback', element: <GoogleLoginCallback /> },
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
