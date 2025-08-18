export default function EmptyState({ title, description, action }){
	return (
		<div className="panel text-center p-6">
			<div className="text-lg font-semibold mb-1">{title}</div>
			<div className="kpi-title mb-4">{description}</div>
			{action}
		</div>
	)
}


