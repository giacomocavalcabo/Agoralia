import { useEffect, useMemo, useState } from 'react'

export default function SettingsTabs({ tabs, initialTab, onTabChange, children }) {
  const [active, setActive] = useState(() => initialTab || (tabs[0] && tabs[0].id))
  const byId = useMemo(() => Object.fromEntries(tabs.map((t) => [t.id, t])), [tabs])

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && byId[hash]) setActive(hash)
  }, [byId])

  useEffect(() => {
    if (!active) return
    window.history.replaceState({}, '', `#${active}`)
    onTabChange?.(active)
  }, [active, onTabChange])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12 }}>
      <div className="panel" style={{ padding: 12 }}>
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`nav-item ${active === t.id ? 'active' : ''}`}
            onClick={() => setActive(t.id)}
            style={{ cursor: 'pointer' }}
            aria-current={active === t.id ? 'page' : undefined}
          >{t.label}</div>
        ))}
      </div>
      <div>
        {typeof children === 'function' ? children(active) : children}
      </div>
    </div>
  )
}


