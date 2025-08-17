export default function KPI({ label, value, progressPct }){
	return (
		<div className="panel" style={{ padding:16 }}>
			<div className="kpi-title" style={{ textTransform:'uppercase', letterSpacing:.4 }}>{label}</div>
			<div style={{ fontSize:24, fontWeight:800, marginTop:6 }}>{value}</div>
			{typeof progressPct === 'number' && (
				<div style={{ marginTop:10, height:8, background:'var(--border)', borderRadius:999 }}>
					<div style={{ width:`${Math.min(100, Math.max(0, progressPct))}%`, height:8, background:'var(--primary)', borderRadius:999 }} />
				</div>
			)}
		</div>
	)
}
