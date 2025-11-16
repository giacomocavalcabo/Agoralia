import { Outlet } from 'react-router-dom'
import { useI18n } from '../lib/i18n.jsx'

export default function Root() {
  const { t } = useI18n()
  
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Outlet />
    </div>
  )
}
