export default function KpiTile({ icon=null, value='—', label='', delta=null, status='neutral' }){
	const pill = status==='success' ? 'bg-success' : status==='warn' ? 'bg-warn' : status==='danger' ? 'bg-danger' : 'bg-ink-600'
	return (
		<div className="rounded-xl border border-line bg-bg-card shadow-soft p-4 transition-transform duration-100 ease-out hover:-translate-y-px hover:shadow-md">
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-2">
					{icon}
					<div className="kpi-title">{label}</div>
				</div>
				{delta!=null && (
					<span className={`kpi-title inline-flex items-center gap-1 rounded-full border border-line bg-bg-app px-2 py-0.5 text-xs`}>
						<span className={`h-1.5 w-1.5 rounded-full ${pill}`}></span>
						{delta}
					</span>
				)}
			</div>
			<div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
		</div>
	)
}


