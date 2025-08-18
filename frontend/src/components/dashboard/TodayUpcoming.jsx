import Card from '../ui/Card.jsx'

export default function TodayUpcoming({ items=[], loading=false }){
	return (
		<Card title="Today & Upcoming">
			<div className="grid gap-2">
				{loading ? (
					Array.from({ length: 4 }).map((_,i)=> (<div key={i} className="rounded-xl border border-line bg-bg-app px-3 py-3" />))
				) : (
					items.length ? items.map((it,i)=> (
						<div key={i} className="flex items-center justify-between rounded-xl border border-line bg-bg-app px-3 py-2">
							<div className="kpi-title flex items-center gap-2">
								<span className="rounded-full border border-line bg-white px-2 py-0.5 text-xs">{it.type||'Scheduled'}</span>
								<span className="rounded-full border border-line bg-white px-2 py-0.5 text-xs">{it.lang||'—'}</span>
								<span>{it.lead||'—'}</span>
							</div>
							<div className="kpi-title">{it.localTime||'—'}</div>
						</div>
					)) : <div className="kpi-title">No upcoming</div>
				)}
			</div>
		</Card>
	)
}


