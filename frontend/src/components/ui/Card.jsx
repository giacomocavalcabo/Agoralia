export default function Card({ title, children, footer }){
	return (
		<div className="panel" style={{ boxShadow:'var(--sh-card)', borderRadius:'var(--r-md)' }}>
			{title && <div style={{ fontWeight:700, marginBottom:8 }}>{title}</div>}
			{children}
			{footer && <div style={{ marginTop:12 }}>{footer}</div>}
		</div>
	)
}
