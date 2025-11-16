export default function StatGrid({ children, columns }) {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: columns 
        ? `repeat(${columns}, 1fr)`
        : 'repeat(auto-fit, minmax(200px, 1fr))', 
      gap: 16 
    }}>
      {children}
    </div>
  )
}

