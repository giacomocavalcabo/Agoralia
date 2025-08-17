import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import KPI from '../components/ui/KPI.jsx'
import Card from '../components/ui/Card.jsx'
import { Skeleton, SkeletonRow } from '../components/ui/Skeleton.jsx'
import { useI18n } from '../lib/i18n.jsx'

export default function Dashboard() {
	const { t } = useI18n()
	const [summary, setSummary] = useState(null)
	const [live, setLive] = useState([])
	const [events, setEvents] = useState([])
	const [loading, setLoading] = useState(true)

	async function load() {
		setLoading(true)
		try {
			const [s, l, e] = await Promise.all([
				apiFetch('/dashboard/summary'),
				apiFetch('/calls/live'),
				apiFetch('/events/recent?limit=10')
			])
			setSummary(s)
			setLive(Array.isArray(l.items) ? l.items : [])
			setEvents(Array.isArray(e.items) ? e.items : [])
		} finally { setLoading(false) }
	}

	useEffect(() => {
		load()
		const id = setInterval(load, 15000)
		return () => clearInterval(id)
	}, [])

	return (
		<div style={{ display:'grid', gap:16 }}>
			<h1>{t('pages.dashboard.title')}</h1>
			{/* KPI strip */}
			{loading && !summary ? (
				<div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12 }}>
					<Skeleton height={84} />
					<Skeleton height={84} />
					<Skeleton height={84} />
				</div>
			) : (
				<div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12 }}>
					<KPI label={t('pages.dashboard.kpi.minutes')} value={summary.minutes_mtd} progressPct={(summary.minutes_mtd/summary.minutes_cap)*100} />
					<KPI label={t('pages.dashboard.kpi.calls_today')} value={summary.calls_today} />
					<KPI label={t('pages.dashboard.kpi.success')} value={`${Math.round(summary.success_rate*100)}%`} />
				</div>
			)}

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
