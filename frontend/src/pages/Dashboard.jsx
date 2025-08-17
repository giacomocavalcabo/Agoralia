import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import KPI from '../components/ui/KPI.jsx'
import Card from '../components/ui/Card.jsx'
import { Skeleton, SkeletonRow } from '../components/ui/Skeleton.jsx'
import { useI18n } from '../lib/i18n.jsx'
import { Line, Bar } from 'react-chartjs-2'
import {
	Chart as ChartJS,
	LineElement,
	BarElement,
	CategoryScale,
	LinearScale,
	PointElement,
	Tooltip,
	Legend
} from 'chart.js'
ChartJS.register(LineElement, BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend)

export default function Dashboard() {
	const { t } = useI18n()
	const [summary, setSummary] = useState(null)
	const [live, setLive] = useState([])
	const [events, setEvents] = useState([])
	const [health, setHealth] = useState(null)
	const [trendDays, setTrendDays] = useState(7)
	const [trends, setTrends] = useState({ calls: [], labels: [], outcomes: [] })
	const [loading, setLoading] = useState(true)

	async function load() {
		setLoading(true)
		try {
			const [s, l, e] = await Promise.all([
				apiFetch(`/dashboard/summary?days=${trendDays}`),
				apiFetch('/calls/live'),
				apiFetch('/events/recent?limit=10')
			])
			setSummary(s)
			setLive(Array.isArray(l.items) ? l.items : [])
			setEvents(Array.isArray(e.items) ? e.items : [])
			// mock health + trends for now
			setHealth({ services:[
				{ name:'DB', status:'ok' },
				{ name:'Redis', status:'ok' },
				{ name:'R2', status:'ok' },
				{ name:'Retell', status:'ok' },
			]})
			const labels = Array.from({ length: trendDays }).map((_,i)=> `${i+1}`)
			setTrends({ labels, calls: labels.map(()=> Math.floor(Math.random()*10)), outcomes: labels.map(()=> Math.floor(Math.random()*5)) })
		} finally { setLoading(false) }
	}

	useEffect(() => {
		load()
		const id = setInterval(load, 15000)
		return () => clearInterval(id)
	}, [trendDays])

	return (
		<div style={{ display:'grid', gap:16 }}>
			<h1>{t('pages.dashboard.title')}</h1>
			{/* KPI strip */}
			{loading && !summary ? (
				<div style={{ display:'grid', gridTemplateColumns:'repeat(6, minmax(0,1fr))', gap:12 }}>
					{Array.from({ length: 6 }).map((_,i)=>(<Skeleton key={i} height={84}/>))}
				</div>
			) : (
				<div style={{ display:'grid', gridTemplateColumns:'repeat(6, minmax(0,1fr))', gap:12 }}>
					<KPI label={t('pages.dashboard.kpi.minutes')} value={summary.minutes_mtd} progressPct={(summary.minutes_mtd/summary.minutes_cap)*100} />
					<KPI label={t('pages.dashboard.kpi.calls_today')} value={summary.calls_today} />
					<KPI label={t('pages.dashboard.kpi.success')} value={`${Math.round(summary.success_rate*100)}%`} />
					<KPI label="Avg duration" value={`${summary.avg_duration_sec ?? 0}s`} />
					<KPI label="p95 turn-taking" value={`${summary.p95_turn_taking_ms ?? 0}ms`} />
					<KPI label="Errors (24h)" value={summary.errors_24h ?? 0} />
				</div>
			)}

			{/* Health + Trends */}
			<div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:16 }}>
				<Card title={t('pages.dashboard.health.title')}>
					{loading && !health ? <SkeletonRow lines={4} /> : (
						<div style={{ display:'grid', gap:8 }}>
							{health?.services?.map((s,i)=> (
								<div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
									<span style={{ width:8, height:8, borderRadius:999, background: s.status==='ok' ? '#10b981' : s.status==='warn' ? '#f59e0b' : '#ef4444' }} />
									<span>{s.name}</span>
								</div>
							))}
						</div>
					)}
				</Card>
				<Card title={t('pages.dashboard.trends.calls') || 'Trends'}>
					{loading ? <SkeletonRow lines={6} /> : (
						<Line height={120} options={{ plugins:{ legend:{ display:false }}, responsive:true, scales:{ y:{ grid:{ color:'rgba(0,0,0,.06)' }}, x:{ grid:{ display:false }}} }} data={{
							labels: trends.labels,
							datasets:[{ data: trends.calls, borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.15)', fill:true, tension:.3 }]
						}}/>
					)}
					<div style={{ display:'flex', gap:8, marginTop:8 }}>
						<button className="btn" onClick={()=> setTrendDays(7)} disabled={trendDays===7}>7d</button>
						<button className="btn" onClick={()=> setTrendDays(30)} disabled={trendDays===30}>30d</button>
					</div>
				</Card>
			</div>

			{/* Live + Activity */}
			<div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
				<Card title={t('pages.dashboard.live.title')}>
					{loading ? <SkeletonRow lines={4} /> : (
						<table className="table">
							<thead><tr><th>Lead</th><th>Agent</th><th>Status</th><th>Started</th></tr></thead>
							<tbody>
								{live.map((r,i)=>(<tr key={i}><td>{r.lead ?? '—'}</td><td>{r.agent ?? '—'}</td><td>{r.status ?? '—'}</td><td>{r.started_at ?? '—'}</td></tr>))}
								{!live.length && <tr><td colSpan={4}>No live calls</td></tr>}
							</tbody>
						</table>
					)}
				</Card>
				<Card title={t('pages.dashboard.activity')}>
					{loading ? <SkeletonRow lines={6} /> : (
						<div style={{ display:'grid', gap:8 }}>
							{events.map((e,i)=>(<div key={i} className="panel" style={{ padding:12 }}>{e.text ?? '—'}</div>))}
							{!events.length && <div className="kpi-title">No activity yet</div>}
						</div>
					)}
				</Card>
			</div>
		</div>
	)
}
