export default function EmptyState({ title, description, actions }) {
  return (
    <div className="panel" style={{ textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ color: '#6b7280', marginBottom: 12 }}>{description}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div>
    </div>
  )
}


