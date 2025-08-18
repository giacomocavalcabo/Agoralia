import Card from '../ui/Card.jsx'

export default function TodayUpcoming({ items=[] }){
	return (
		<Card title="Today & Upcoming">
			<div className="grid gap-2">
				{items.map((it,i)=> (
					<div key={i} className="flex items-center justify-between rounded-xl border border-line bg-bg-app px-3 py-2">
						<div className="kpi-title">{it.type||'Scheduled'} • {it.lang||'—'} • {it.lead||'—'}</div>
						<div className="kpi-title">{it.localTime||'—'}</div>
					</div>
				))}
				{!items.length && <div className="kpi-title">No upcoming</div>}
			</div>
		</Card>
	)
}


