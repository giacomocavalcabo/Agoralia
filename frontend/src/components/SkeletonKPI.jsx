export default function SkeletonKPI() {
  return (
    <div className="kpi-card" aria-busy="true" aria-label="Loading">
      <div className="kpi-title skeleton-line" style={{ width: 90 }} />
      <div className="skeleton-block" style={{ height: 28, marginTop: 8, borderRadius: 8 }} />
      <style>{`
        .skeleton-line { height: 12px; background: linear-gradient(90deg,#eee,#f5f5f5,#eee); background-size: 200% 100%; animation: sk 1.2s ease-in-out infinite; border-radius: 6px; }
        .skeleton-block { background: linear-gradient(90deg,#eee,#f5f5f5,#eee); background-size: 200% 100%; animation: sk 1.2s ease-in-out infinite; }
        @keyframes sk { 0%{background-position: 200% 0} 100%{background-position: -200% 0} }
      `}</style>
    </div>
  )
}


