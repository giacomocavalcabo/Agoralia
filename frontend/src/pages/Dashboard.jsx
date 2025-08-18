import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import KPI from '../components/ui/KPI.jsx'
import Card from '../components/ui/Card.jsx'
import { Skeleton, SkeletonRow } from '../components/ui/Skeleton.jsx'
import { useI18n } from '../lib/i18n.jsx'
import Banner from '../components/Banner.jsx'
import { Line } from 'react-chartjs-2'
import DataTable from '../components/DataTable.jsx'
import {
	Chart as ChartJS,
	LineElement,
	CategoryScale,
	LinearScale,
	PointElement,
	Tooltip,
	Legend
} from 'chart.js'
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend)

export default function Dashboard() {
	const { t } = useI18n()
	const [summary, setSummary] = useState(null)
	const [live, setLive] = useState([])
	const [events, setEvents] = useState([])
	const [trendDays, setTrendDays] = useState(7)
	const [trends, setTrends] = useState({ calls: [], labels: [] })
	const [loading, setLoading] = useState(true)
	const [statusFilters, setStatusFilters] = useState(['running','queued'])

	async function load() {
		setLoading(true)
		try {
			const [s, l, e] = await Promise.all([
				apiFetch(`/dashboard/summary?days=${trendDays}`).catch(()=> null),
				apiFetch('/calls/live').catch(()=> ({ items: [] })),
				apiFetch('/events/recent?limit=10').catch(()=> ({ items: [] }))
			])
			setSummary(s || { minutes_mtd:0, minutes_cap:1000, calls_today:0, success_rate:0, avg_duration_sec:0, p95_turn_taking_ms:0, errors_24h:0 })
			setLive(Array.isArray(l?.items) ? l.items : [])
			setEvents(Array.isArray(e?.items) ? e.items : [])
			const labels = Array.from({ length: trendDays }).map((_,i)=> `${i+1}`)
			setTrends({ labels, calls: labels.map(()=> Math.floor(Math.random()*10)) })
		} finally { setLoading(false) }
	}

	useEffect(() => {
		load()
		const id = setInterval(load, 15000)
		return () => clearInterval(id)
	}, [trendDays])

	return (
		<div className="space-y-6">
			<Banner tone={summary && (summary.minutes_mtd/Math.max(1, summary.minutes_cap))>0.8 ? 'warn' : 'info'} title={t('pages.dashboard.health.title')}>
				{t('pages.admin?.notices?.impersonating')}
			</Banner>
			<h1 className="text-2xl font-semibold text-ink-900">{t('pages.dashboard.title')}</h1>
			{/* KPI strip */}
			{loading && !summary ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{Array.from({ length: 4 }).map((_,i)=>(<Skeleton key={i} height={84}/>))}
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<KPI label={t('pages.dashboard.kpi.minutes')} value={summary?.minutes_mtd ?? 0} progressPct={Math.min(100, Math.round(((summary?.minutes_mtd ?? 0) / Math.max(1, summary?.minutes_cap ?? 1)) * 100))} />
					<KPI label={t('pages.dashboard.kpi.calls_today')} value={summary?.calls_today ?? 0} />
					<KPI label={t('pages.dashboard.kpi.success')} value={`${Math.round((summary?.success_rate ?? 0)*100)}%`} />
					<KPI label="Avg duration" value={`${summary?.avg_duration_sec ?? 0}s`} />
				</div>
			)}

			{/* Charts + Live */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<div className="lg:col-span-2">
					<Card title={t('pages.dashboard.trends.calls') || 'Trends'}>
						{loading ? <SkeletonRow lines={6} /> : (
							<Line height={120} options={{ plugins:{ legend:{ display:false }}, responsive:true, scales:{ y:{ grid:{ color:'rgba(0,0,0,.06)' }}, x:{ grid:{ display:false }}} }} data={{
								labels: trends.labels,
								datasets:[{ data: trends.calls, borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.15)', fill:true, tension:.3 }]
							}}/>
						)}
						<div className="flex gap-2 mt-2">
							<button className="btn" onClick={()=> setTrendDays(7)} disabled={trendDays===7}>7d</button>
							<button className="btn" onClick={()=> setTrendDays(30)} disabled={trendDays===30}>30d</button>
						</div>
					</Card>
				</div>
				<div>
					<Card title={t('pages.dashboard.live.title')}>
						{loading ? <SkeletonRow lines={4} /> : (
							<DataTable
								columns={[
									{ key:'lead', label:'Lead' },
									{ key:'agent', label:'Agent' },
									{ key:'status', label:'Status' },
									{ key:'started_at', label:'Started' }
								]}
								chips={statusFilters.map(s=> ({ key:s, label:s }))}
								onRemoveChip={(key)=> setStatusFilters((arr)=> arr.filter(s=> s!==key))}
								onClearChips={()=> setStatusFilters([])}
								rows={live
									.filter(r=> statusFilters.length ? statusFilters.includes(String(r.status||'').toLowerCase()) : true)
									.map(r=> ({
										lead: r.lead ?? '—',
										agent: r.agent ?? '—',
										status: r.status ?? '—',
										started_at: r.started_at ?? '—'
									}))}
							/>
						)}
					</Card>
				</div>
			</div>

			{/* Recent activity */}
			<Card title={t('pages.dashboard.activity')}>
				{loading ? <SkeletonRow lines={6} /> : (
					<div className="grid gap-2">
						{events.map((e,i)=>(<div key={i} className="panel p-3">{e.text ?? '—'}</div>))}
						{!events.length && <div className="kpi-title">No activity yet</div>}
					</div>
				)}
			</Card>
		</div>
	)
}
