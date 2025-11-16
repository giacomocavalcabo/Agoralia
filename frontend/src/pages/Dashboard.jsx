import { useI18n } from '../lib/i18n.jsx'

export default function Dashboard() {
  const { t } = useI18n()
  
  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1>Dashboard</h1>
      <p>Benvenuto! Da qui ricominciamo.</p>
    </div>
  )
}
