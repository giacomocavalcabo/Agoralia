import { useI18n } from '../../lib/i18n.jsx'
import Button from '../ui/Button'

export default function PageHeader({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  actions
}) {
  const { t } = useI18n()

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      flexWrap: 'wrap', 
      gap: 12,
      marginBottom: 24
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '40px', lineHeight: '44px', fontWeight: 700, color: 'var(--text)' }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ 
            margin: '8px 0 0 0', 
            fontSize: '16px', 
            lineHeight: '24px', 
            fontWeight: 400, 
            color: 'var(--muted)' 
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {(primaryAction || secondaryAction || actions) && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {actions}
          {secondaryAction && (
            <Button 
              variant="secondary" 
              size={secondaryAction.size || "sm"}
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              loading={secondaryAction.loading}
            >
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button 
              variant="primary" 
              size={primaryAction.size || "lg"}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              loading={primaryAction.loading}
            >
              {primaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

