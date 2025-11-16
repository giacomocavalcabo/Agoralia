import { useI18n } from '../../lib/i18n.jsx'
import Card from '../ui/Card'
import Button from '../ui/Button'
import BrickCard from './BrickCard'

export default function SetupChecklist({
  items,
  totalCompleted,
  totalItems,
  onStartSetup
}) {
  const { t } = useI18n()
  
  const isComplete = totalCompleted === totalItems
  const progress = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0

  if (isComplete) {
    return (
      <Card style={{
        background: '#F0FDF4',
        border: '1px solid #86EFAC',
        padding: 16
      }}>
        <div style={{
          fontSize: 16,
          lineHeight: '24px',
          fontWeight: 600,
          color: '#15803D',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          ✅ {t('pages.dashboard.setup.ready')}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 16,
          lineHeight: '24px',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 4
        }}>
          ⚠️ {t('pages.dashboard.setup.incomplete')}
        </div>
        <p style={{
          fontSize: 14,
          lineHeight: '20px',
          color: 'var(--muted)',
          margin: 0
        }}>
          {t('pages.dashboard.setup.description')}
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        {items.map((item) => (
          <BrickCard
            key={item.id}
            type={item.type}
            title={item.label}
            description={item.description}
            completed={item.completed}
            onAction={item.onAction}
            actionLabel={item.actionLabel}
            variant="compact"
          />
        ))}
      </div>

      <div style={{
        fontSize: 13,
        lineHeight: '18px',
        fontWeight: 500,
        color: 'var(--muted)',
        marginBottom: 16
      }}>
        {t('pages.dashboard.setup.progress', { completed: totalCompleted, total: totalItems })}
      </div>

      {onStartSetup && (
        <Button 
          variant="primary" 
          size="lg"
          onClick={onStartSetup}
          style={{ width: '100%' }}
        >
          {t('pages.dashboard.setup.start_setup')}
        </Button>
      )}
    </Card>
  )
}

