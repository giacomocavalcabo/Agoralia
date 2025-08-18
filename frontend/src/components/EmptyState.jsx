export default function EmptyState({ title, description, action }){
	return (
		<div className="panel" style={{ textAlign:'center', padding:'32px 24px' }}>
			<div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>{title}</div>
			<div className="kpi-title" style={{ marginBottom:16 }}>{description}</div>
			{action}
		</div>
	)
}


