import { useI18n } from '../../lib/i18n.jsx'
import Card from '../ui/Card'
import Button from '../ui/Button'

const BRICK_ICONS = {
  number: '📞',
  knowledge: '📚',
  agent: '🤖',
  leads: '👥'
}

export default function BrickCard({
  type,
  title,
  description,
  completed,
  onAction,
  actionLabel,
  variant = 'default'
}) {
  const { t } = useI18n()
  
  // Usa chiavi i18n se disponibili, altrimenti usa props
  const label = title || t(`pages.dashboard.setup.bricks.${type}.label`)
  const desc = description || t(`pages.dashboard.setup.bricks.${type}.description`)
  const icon = BRICK_ICONS[type] || '•'
  
  const defaultActionLabel = type === 'leads' 
    ? t('pages.dashboard.setup.import_now') 
    : t('pages.dashboard.setup.complete_now')
  const btnLabel = actionLabel || defaultActionLabel

  if (variant === 'compact') {
    // Versione compatta per SetupChecklist
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <div>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 500, 
              color: completed ? 'var(--green)' : 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              {completed ? '✅' : '⚠️'} {label}
            </div>
            {desc && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                {desc}
              </div>
            )}
          </div>
        </div>
        {!completed && onAction && (
          <Button variant="secondary" size="sm" onClick={onAction}>
            {btnLabel}
          </Button>
        )}
      </div>
    )
  }

  // Versione default per wizard
  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          fontSize: 48, 
          marginBottom: 12,
          textAlign: 'center'
        }}>
          {icon}
        </div>
        <div style={{ 
          fontSize: 20, 
          lineHeight: '28px', 
          fontWeight: 600, 
          color: 'var(--text)',
          marginBottom: 8,
          textAlign: 'center'
        }}>
          {label}
        </div>
        {desc && (
          <p style={{ 
            fontSize: 14, 
            lineHeight: '20px', 
            color: 'var(--muted)',
            textAlign: 'center',
            margin: 0
          }}>
            {desc}
          </p>
        )}
      </div>
      {completed && (
        <div style={{ 
          textAlign: 'center',
          color: 'var(--green)',
          fontSize: 14,
          fontWeight: 500,
          marginBottom: 16
        }}>
          ✅ {t('common.completed') || 'Completed'}
        </div>
      )}
      {onAction && (
        <Button 
          variant={completed ? 'secondary' : 'primary'} 
          size="lg"
          onClick={onAction}
          style={{ width: '100%' }}
        >
          {btnLabel}
        </Button>
      )}
    </Card>
  )
}

