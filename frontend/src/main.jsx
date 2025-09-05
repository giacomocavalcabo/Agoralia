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
