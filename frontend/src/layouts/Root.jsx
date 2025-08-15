import { NavLink, Outlet } from 'react-router-dom'
import './layout.css'
import { useEffect, useMemo, useState } from 'react'
import PaywallModal from '../components/PaywallModal.jsx'
import { useI18n } from '../lib/i18n.jsx'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import AvatarMenu from '../components/AvatarMenu.jsx'
import UsageBar from '../components/UsageBar.jsx'
import CommandPalette from '../components/CommandPalette.jsx'

export default function Root() {
  const { locale, setLocale, t } = useI18n()
  const [paywall, setPaywall] = useState({ open: false, message: '' })
  const [paletteOpen, setPaletteOpen] = useState(false)
  const langOptions = useMemo(() => null, [])
  useEffect(() => {
    const onShow = (e) => setPaywall({ open: true, message: e.detail?.message || '' })
    window.addEventListener('paywall:show', onShow)
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true) } }
    window.addEventListener('keydown', onKey)
    const savedTheme = localStorage.getItem('ui_theme')
    if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    return () => window.removeEventListener('paywall:show', onShow)
  }, [])
  return (
    <div className="layout">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <aside className="sidebar">
        <div className="brand">ColdAI</div>
        <nav className="nav nav-top">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>{t('Dashboard')}</NavLink>
          <NavLink to="/calls" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>{t('History')}</NavLink>
          <NavLink to="/leads" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>{t('Leads')}</NavLink>
          <NavLink to="/campaigns" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>{t('Campaigns')}</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>{t('Analytics')}</NavLink>
          <NavLink to="/calendar" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>{t('Calendar')}</NavLink>
        </nav>
        <div className="nav-footer">
          <NavLink to="/import" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>{t('Import')}</NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>{t('Settings')}</NavLink>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div className="topbar-left">{t('Overview')}</div>
          <div className="topbar-right" style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* TODO: Search scoped - MVP placeholder */}
            <input className="input" style={{ maxWidth: 260 }} placeholder="Search…" />
            <UsageBar />
            <LanguageSwitcher />
            <AvatarMenu />
          </div>
        </header>
        <section className="page">
          <Outlet />
        </section>
      </main>
      <PaywallModal open={paywall.open} reason={paywall.message} onClose={() => setPaywall({ open: false, message: '' })} />
    </div>
  )
}


