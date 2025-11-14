<<<<<<< HEAD
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
=======
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './i18n';

function Nav() {
  const { t, i18n } = useTranslation('common');
  return (
    <nav style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <Link to="/login">{t('nav.to_login')}</Link>
      <Link to="/app">{t('nav.to_app')}</Link>
      <select style={{ marginLeft: 'auto' }} value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
        <option value="en-US">English</option>
        <option value="it-IT">Italiano</option>
      </select>
    </nav>
  );
}

function Login() {
  const { t } = useTranslation('common');
  return (
    <div>
      <h2>{t('login.title')}</h2>
      <div><label>{t('login.email_label')}</label><input type="email" /></div>
      <div><label>{t('login.password_label')}</label><input type="password" /></div>
      <button onClick={() => alert(t('toast.signed_in'))}>{t('login.submit')}</button>
    </div>
  );
}

function AppInfo() {
  const { t } = useTranslation('common');
  return (
    <div>
      <h2>{t('app.title')}</h2>
      <div><label>{t('app.name_label')}</label><input type="text" /></div>
      <div><label>{t('app.phone_label')}</label><input type="tel" placeholder={"+39 123 456 7890"} /></div>
      <button onClick={() => alert(t('toast.saved'))}>{t('app.submit')}</button>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<AppInfo />} />
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
>>>>>>> dd0457be19b60efc1dc92dc8ea703216870914f9
