import Card from '../ui/Card.jsx'

export default function CampaignHealth({ rows=[], loading=false }){
	return (
		<Card title="Campaign Health">
			<div className="overflow-auto">
				<table className="w-full border-separate text-sm" style={{ borderSpacing:0 }}>
					<thead><tr><th className="kpi-title text-left px-3 py-2">Campaign</th><th className="kpi-title text-left px-3 py-2">Status</th><th className="kpi-title text-left px-3 py-2">Progress</th><th className="kpi-title text-left px-3 py-2">Qualified %</th><th className="kpi-title text-left px-3 py-2">Spend</th></tr></thead>
					<tbody>
						{loading ? (
							Array.from({ length: 5 }).map((_,i)=> (<tr key={i}><td colSpan={5} className="px-3 py-2"><div className="h-7 rounded bg-line"/></td></tr>))
						) : rows.map((r,i)=> (
							<tr key={i} className="hover:bg-bg-app/60">
								<td className="px-3 py-2">{r.name}</td>
								<td className="px-3 py-2">{r.status}</td>
								<td className="px-3 py-2">
									<div className="h-2 bg-line rounded-full"><div className="h-2 bg-brand-600 rounded-full" style={{ width:`${Math.min(100, Math.max(0, r.progress||0))}%` }} /></div>
								</td>
								<td className="px-3 py-2">{typeof r.qualified_pct==='number'? `${Math.round(r.qualified_pct)}%` : '—'}</td>
								<td className="px-3 py-2">{r.spend ?? '—'}</td>
							</tr>
						))}
						{!rows.length && !loading && <tr><td colSpan={5} className="kpi-title px-3 py-2">No campaigns</td></tr>}
					</tbody>
				</table>
			</div>
		</Card>
	)
}


