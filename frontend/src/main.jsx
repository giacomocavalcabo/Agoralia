import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Contacts from './pages/Contacts.jsx'
import Analytics from './pages/Analytics.jsx'
import Settings from './pages/Settings.jsx'
import Root from './layouts/Root.jsx'
import Calls from './pages/Calls.jsx'
import History from './pages/History.jsx'
import ContactHistory from './pages/ContactHistory.jsx'
import CallDetail from './pages/CallDetail.jsx'
import ImportPage from './pages/Import.jsx'
import CrmMapping from './pages/CrmMapping.jsx'
import Agents from './pages/Agents.jsx'
import KnowledgeBases from './pages/KnowledgeBases.jsx'
import Numbers from './pages/Numbers.jsx'
import Compliance from './pages/Compliance.jsx'
import Leads from './pages/Leads.jsx'
import Campaigns from './pages/Campaigns.jsx'
import Calendar from './pages/Calendar.jsx'
import Billing from './pages/Billing.jsx'
import { I18nProvider } from './lib/i18n.jsx'
import ToastProvider from './components/ToastProvider.jsx'
// import Login from './pages/Login.jsx'
import HubSpotCallback from './pages/HubSpotCallback.jsx'
import GoogleCallback from './pages/GoogleCallback.jsx'
import GoogleLoginCallback from './pages/GoogleLoginCallback.jsx'
import Admin from './pages/Admin.jsx'

function Protected({ children }) {
  // Temporaneamente disabilitato per sviluppo
  return children
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Protected>
        <Root />
      </Protected>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'leads', element: <Leads /> },
      { path: 'contacts', element: <Navigate to="/leads" replace /> },
      { path: 'contatti', element: <Navigate to="/leads" replace /> },
      { path: 'campaigns', element: <Campaigns /> },
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
  { path: '*', element: <Navigate to="/" replace /> },
  // { path: '/login', element: <Login /> },
  { path: '/hubspot/callback', element: <HubSpotCallback /> },
  { path: '/google/callback', element: <GoogleCallback /> },
  { path: '/google-login/callback', element: <GoogleLoginCallback /> },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </I18nProvider>
  </StrictMode>,
)
