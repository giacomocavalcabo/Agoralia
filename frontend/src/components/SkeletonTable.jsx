export default function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div className="panel" aria-busy="true" aria-label="Loading table">
      <div className="skeleton-line" style={{ width: '30%', marginBottom: 8 }} />
      <div className="table">
        <div className="skeleton-row" style={{ height: 36 }} />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-row" style={{ height: 44, marginTop: 6 }} />
        ))}
      </div>
      <style>{`
        .skeleton-line, .skeleton-row { background: linear-gradient(90deg,#eee,#f5f5f5,#eee); background-size: 200% 100%; animation: sk 1.2s ease-in-out infinite; border-radius: 6px; }
        .table { width:100%; }
        @keyframes sk { 0%{background-position: 200% 0} 100%{background-position: -200% 0} }
      `}</style>
    </div>
  )
}


