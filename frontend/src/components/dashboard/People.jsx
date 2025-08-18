import Card from '../ui/Card.jsx'

export default function People({ members=[], loading=false }){
	return (
		<Card title="People in workspace">
			<div className="grid gap-2">
				{loading ? (
					Array.from({ length: 4 }).map((_,i)=> (<div key={i} className="h-10 rounded-xl border border-line bg-bg-app"/>))
				) : members.map((m,i)=> (
					<div key={i} className="flex items-center justify-between rounded-xl border border-line bg-bg-app px-3 py-2">
						<div className="flex items-center gap-2">
							<div className="h-7 w-7 rounded-full bg-line" aria-hidden></div>
							<div>
								<div className="text-sm font-semibold text-ink-900">{m.name || m.email || '—'}</div>
								<div className="kpi-title">{m.role || '—'}</div>
							</div>
						</div>
						<div className="kpi-title">{m.last_activity || '—'}</div>
					</div>
				))}
				{!members.length && !loading && <div className="kpi-title">No members</div>}
			</div>
		</Card>
	)
}


