import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import AppErrorBoundary from '../components/AppErrorBoundary'
import { ToastProvider } from '../components/ToastProvider.jsx'
import { AuthProvider } from '../lib/useAuth.jsx'
import { I18nextProvider } from 'react-i18next'
import i18n from '../lib/i18n.jsx'

// Lazy load pages with namespace preloading
const Dashboard = React.lazy(() => import('../pages/Dashboard'))
const KnowledgeBase = React.lazy(() => import('../pages/KnowledgeBase/KnowledgeBase'))
const KBEditor = React.lazy(() => import('../pages/KnowledgeBase/KBEditor'))
const Assignments = React.lazy(() => import('../pages/KnowledgeBase/Assignments'))
const Imports = React.lazy(() => import('../pages/KnowledgeBase/Imports'))
const Leads = React.lazy(() => import('../pages/Leads'))
const LeadDetails = React.lazy(() => import('../pages/LeadDetails'))
const LeadsImport = React.lazy(() => import('../pages/LeadsImport'))
const LeadsNew = React.lazy(() => import('../pages/LeadsNew'))
const Numbers = React.lazy(() => import('../pages/Numbers'))
import Campaigns from '../pages/Campaigns.jsx'
const Calendar = React.lazy(() => import('../pages/Calendar'))
const Settings = React.lazy(() => import('../pages/Settings'))
const SettingsCompany = React.lazy(() => import('../pages/SettingsCompany'))
const SettingsLayout = React.lazy(() => import('../components/SettingsLayout'))
const Integrations = React.lazy(() => import('../pages/Settings/Integrations'))
const Billing = React.lazy(() => import('../pages/Billing'))
const Analytics = React.lazy(() => import('../pages/Analytics'))
const Import = React.lazy(() => import('../pages/Import'))
const History = React.lazy(() => import('../pages/History'))
const Admin = React.lazy(() => import('../pages/Admin'))
const Invite = React.lazy(() => import('../pages/Invite'))
const Login = React.lazy(() => import('../pages/Login'))
const LoginVerify = React.lazy(() => import('../pages/LoginVerify'))
const Register = React.lazy(() => import('../pages/Register'))

// Enhanced loading component that preloads i18n namespaces
const RouteLoading = ({ component: Component, ...props }) => {
  // Preload i18n namespaces if the component exports them
  React.useEffect(() => {
    if (Component?.i18nNamespaces) {
      // Namespaces are already loaded via import.meta.glob, this is just for future optimization
      if (import.meta.env.DEV) {
        console.log('Preloading i18n namespaces:', Component.i18nNamespaces);
      }
    }
  }, [Component]);

  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

export default function Root() {
  return (
    <I18nextProvider i18n={i18n}>
      <AppErrorBoundary>
        <AuthProvider>
          <ToastProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/login/verify" element={<LoginVerify />} />
            <Route path="/auth/register" element={<Register />} />
            
            {/* Protected routes */}
            <Route path="/*" element={
              <AppShell>
                <Suspense fallback={<RouteLoading />}>
                  <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="knowledge" element={<KnowledgeBase />} />
                    <Route path="knowledge/company/:id" element={<KBEditor kind="company" />} />
                    <Route path="knowledge/offers/:id" element={<KBEditor kind="offer_pack" />} />
                    <Route path="knowledge/assignments" element={<Assignments />} />
                    <Route path="knowledge/imports" element={<Imports />} />
                    <Route path="leads" element={<Leads />} />
                    <Route path="leads/:id" element={<LeadDetails />} />
                    <Route path="leads/import" element={<LeadsImport />} />
                    <Route path="leads/new" element={<LeadsNew />} />
                    <Route path="numbers" element={<Numbers />} />
                    <Route path="campaigns" element={<Campaigns />} />
                    <Route path="calendar" element={<Calendar />} />
                    
                    {/* Settings routes with nested layout */}
                    <Route path="settings" element={<SettingsLayout />}>
                      <Route index element={<Navigate to="profile" replace />} />
                      <Route path="profile" element={<Settings />} />
                      <Route path="company" element={<Settings />} />
                      <Route path="integrations" element={<Integrations />} />
                      <Route path="billing" element={<Billing />} />
                    </Route>
                    
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="import" element={<Import />} />
                    <Route path="history" element={<History />} />
                    <Route path="admin" element={<Admin />} />
                    <Route path="invite" element={<Invite />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </AppShell>
            } />
          </Routes>
          </ToastProvider>
        </AuthProvider>
      </AppErrorBoundary>
    </I18nextProvider>
  )
}
