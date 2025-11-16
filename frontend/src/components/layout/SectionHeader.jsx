export default function SectionHeader({
  title,
  description,
  actions
}) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      flexWrap: 'wrap', 
      gap: 12,
      marginBottom: 16
    }}>
      <div>
        <div style={{ fontSize: '16px', lineHeight: '24px', fontWeight: 600, color: 'var(--text)' }}>
          {title}
        </div>
        {description && (
          <p style={{ 
            margin: '4px 0 0 0', 
            fontSize: '14px', 
            lineHeight: '20px', 
            fontWeight: 400, 
            color: 'var(--muted)' 
          }}>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  )
}

