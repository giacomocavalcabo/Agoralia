import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { I18nProvider } from '../lib/i18n.jsx'
import { ToastProvider } from '../components/ToastProvider.jsx'
import { AuthProvider } from '../lib/useAuth'

// Lazy load pages
const Dashboard = React.lazy(() => import('../pages/Dashboard'))
const KnowledgeBase = React.lazy(() => import('../pages/KnowledgeBase/KnowledgeBase'))
const KBEditor = React.lazy(() => import('../pages/KnowledgeBase/KBEditor'))
const Assignments = React.lazy(() => import('../pages/KnowledgeBase/Assignments'))
const Imports = React.lazy(() => import('../pages/KnowledgeBase/Imports'))
const Leads = React.lazy(() => import('../pages/Leads'))
const Numbers = React.lazy(() => import('../pages/Numbers'))
const Campaigns = React.lazy(() => import('../pages/Campaigns'))
const Calendar = React.lazy(() => import('../pages/Calendar'))
const Settings = React.lazy(() => import('../pages/Settings'))
const Billing = React.lazy(() => import('../pages/Billing'))
const Analytics = React.lazy(() => import('../pages/Analytics'))
const Import = React.lazy(() => import('../pages/Import'))
const History = React.lazy(() => import('../pages/History'))
const Admin = React.lazy(() => import('../pages/Admin'))
const Invite = React.lazy(() => import('../pages/Invite'))
const Login = React.lazy(() => import('../pages/Login'))
const LoginVerify = React.lazy(() => import('../pages/LoginVerify'))

// Loading component for routes
const RouteLoading = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
)

export default function Root() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/login/verify" element={<LoginVerify />} />
            
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
                    <Route path="numbers" element={<Numbers />} />
                    <Route path="campaigns" element={<Campaigns />} />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="billing" element={<Billing />} />
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
    </I18nProvider>
  )
}
