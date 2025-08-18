import Card from '../ui/Card.jsx'

export default function Tasks({ items=[], onAction }){
	return (
		<Card title="Tasks & Follow-ups">
			<div className="grid gap-2">
				{items.map((t,i)=> (
					<div key={i} className="flex items-center justify-between rounded-xl border border-line bg-bg-app px-3 py-2">
						<div className="kpi-title">{t.text||'—'}</div>
						<div className="flex items-center gap-2">
							<button className="rounded-lg border border-line bg-white px-2 py-1 text-sm" onClick={()=> onAction?.('done', t)}>Mark done</button>
							<button className="rounded-lg border border-line bg-white px-2 py-1 text-sm" onClick={()=> onAction?.('schedule', t)}>Programma</button>
							<button className="rounded-lg border border-line bg-white px-2 py-1 text-sm" onClick={()=> onAction?.('open', t)}>Apri</button>
						</div>
					</div>
				))}
				{!items.length && <div className="kpi-title">No tasks</div>}
			</div>
		</Card>
	)
}


