export default function KPI({ label, value, progressPct }){
	return (
		<div className="panel p-4 transition-transform duration-100 ease-out hover:-translate-y-px hover:shadow-md">
			<div className="kpi-title uppercase tracking-wide">{label}</div>
			<div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
			{typeof progressPct === 'number' && (
				<div className="mt-2 h-2 w-full rounded-full bg-line">
					<div className="h-2 rounded-full bg-brand-600" style={{ width:`${Math.min(100, Math.max(0, progressPct))}%` }} />
				</div>
			)}
		</div>
	)
}
