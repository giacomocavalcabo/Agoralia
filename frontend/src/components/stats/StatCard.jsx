import Card from '../ui/Card'

export default function StatCard({
  label,
  value,
  icon,
  trend,
  loading,
  variant = 'default'
}) {
  if (loading) {
    return (
      <Card>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, height: 18, background: 'var(--border)', borderRadius: 4 }} />
        <div style={{ height: 32, background: 'var(--border)', borderRadius: 8 }} />
      </Card>
    )
  }

  const sizeStyles = {
    default: { labelSize: 13, valueSize: 32 },
    large: { labelSize: 14, valueSize: 40 },
    compact: { labelSize: 12, valueSize: 24 }
  }

  const sizes = sizeStyles[variant] || sizeStyles.default

  return (
    <Card>
      <div style={{ 
        fontSize: sizes.labelSize, 
        lineHeight: sizes.labelSize + 5,
        color: 'var(--muted)', 
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}>
        {icon && <span style={{ fontSize: sizes.labelSize + 2 }}>{icon}</span>}
        <span>{label}</span>
      </div>
      <div style={{ 
        fontSize: sizes.valueSize, 
        lineHeight: sizes.valueSize + 8,
        fontWeight: 700, 
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'baseline',
        gap: 8
      }}>
        <span>{value}</span>
        {trend && (
          <span style={{
            fontSize: sizes.labelSize,
            color: trend.direction === 'up' ? 'var(--green)' : 'var(--red)',
            fontWeight: 500
          }}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
    </Card>
  )
}

