import Card from '../ui/Card.jsx'

export default function SpendCard({ title='Spend vs Budget', spendCents=0, budgetCents=0, costPerMin='—' }){
	const pct = Math.min(100, budgetCents>0 ? Math.round((spendCents / budgetCents) * 100) : 0)
	const tone = pct>=100 ? 'bg-danger' : pct>=80 ? 'bg-warn' : 'bg-success'
	return (
		<Card title={title}>
			<div className="grid gap-2">
				<div className="kpi-title">{`€${(spendCents/100).toFixed(2)} / €${(budgetCents/100).toFixed(2)}`}</div>
				<div className="h-2 bg-line rounded-full">
					<div className={`h-2 rounded-full ${tone}`} style={{ width:`${pct}%` }} />
				</div>
				<div className="kpi-title">{`Avg cost/min: ${costPerMin}`}</div>
			</div>
		</Card>
	)
}


