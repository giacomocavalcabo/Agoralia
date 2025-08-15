import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'

export default function AvatarMenu({ email = 'user@example.com' }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const initials = String(email).slice(0, 2).toUpperCase()
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <span style={{ display: 'inline-flex', width: 24, height: 24, borderRadius: '50%', background: '#111827', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{initials}</span>
      </button>
      {open && (
        <div role="menu" className="panel" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 180, display: 'grid', gap: 6 }}>
          <a className="nav-item" href="/billing">{t('pages.billing.title')}</a>
          <a className="nav-item" href="/settings">{t('app.Settings')}</a>
          <button className="btn" onClick={() => {
            const v = document.documentElement.getAttribute('data-theme') === 'dark' ? '' : 'dark'
            if (v) document.documentElement.setAttribute('data-theme', v); else document.documentElement.removeAttribute('data-theme')
            localStorage.setItem('ui_theme', v || 'light')
          }}>Toggle theme</button>
          <button className="btn" onClick={() => { localStorage.clear(); window.location.href = '/'; }}>Logout</button>
        </div>
      )}
    </div>
  )
}


