import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import KPI from '../components/ui/KPI.jsx'
import Card from '../components/ui/Card.jsx'
import { Skeleton, SkeletonRow } from '../components/ui/Skeleton.jsx'
import { useI18n } from '../lib/i18n.jsx'
import Banner from '../components/Banner.jsx'
import { Line } from 'react-chartjs-2'
import DataTable from '../components/DataTable.jsx'
import KpiTile from '../components/ui/KpiTile.jsx'
import DashboardHeader from '../components/DashboardHeader.jsx'
import {
	Chart as ChartJS,
	LineElement,
	CategoryScale,
	LinearScale,
	PointElement,
	Tooltip,
	Legend
} from 'chart.js'
import SpendCard from '../components/dashboard/SpendCard.jsx'
import TodayUpcoming from '../components/dashboard/TodayUpcoming.jsx'
import CampaignHealth from '../components/dashboard/CampaignHealth.jsx'
import People from '../components/dashboard/People.jsx'
import Tasks from '../components/dashboard/Tasks.jsx'
import Guides from '../components/dashboard/Guides.jsx'
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
	const [upcoming, setUpcoming] = useState([])
	const [campaigns, setCampaigns] = useState([])
	const [members, setMembers] = useState([])
	const [tasks, setTasks] = useState([])

	async function load() {
		setLoading(true)
		try {
			const [s, l, e, up, ch, mem, tk] = await Promise.all([
				apiFetch(`/dashboard/summary?days=${trendDays}`).catch(()=> null),
				apiFetch('/calls/live').catch(()=> ({ items: [] })),
				apiFetch('/events/recent?limit=10').catch(()=> ({ items: [] })),
				apiFetch('/dashboard/upcoming?limit=20').catch(()=> ({ items: [] })),
				apiFetch('/dashboard/campaigns?limit=10').catch(()=> ({ items: [] })),
				apiFetch('/workspace/members').catch(()=> ({ items: [] })),
				apiFetch('/tasks?status=open&limit=20').catch(()=> ({ items: [] })),
			])
			setSummary(s || { minutes_mtd:0, minutes_cap:1000, calls_today:0, success_rate:0, avg_duration_sec:0, p95_turn_taking_ms:0, errors_24h:0 })
			setLive(Array.isArray(l?.items) ? l.items : [])
			setEvents(Array.isArray(e?.items) ? e.items : [])
			setUpcoming(Array.isArray(up?.items) ? up.items : [])
			setCampaigns(Array.isArray(ch?.items) ? ch.items : [])
			setMembers(Array.isArray(mem?.items) ? mem.items : [])
			setTasks(Array.isArray(tk?.items) ? tk.items : [])
			const labels = Array.from({ length: trendDays }).map((_,i)=> `${i+1}`)
			setTrends({ labels, calls: labels.map(()=> Math.floor(Math.random()*10)) })
		} finally { setLoading(false) }
	}

	useEffect(() => {
		load()
		const id = setInterval(load, 15000)
		return () => clearInterval(id)
	}, [trendDays])

	function fmtMMSS(sec){ const m = Math.floor((sec||0)/60); const s = (sec||0)%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` }

	return (
		<div className="space-y-6">
			<DashboardHeader title={t('pages.dashboard.title')||'Dashboard'} range={{}} onRangeChange={()=>{}} onQuick={(act)=>{ if (act==='new_campaign') document.dispatchEvent(new CustomEvent('open-create-drawer')) }} />
			{/* KPI strip */}
			{loading && !summary ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
					{Array.from({ length: 8 }).map((_,i)=>(<Skeleton key={i} height={84}/>))}
				</div>
			) : (
				<div className="grid grid-cols-12 gap-4">
					<div className="col-span-12 sm:col-span-6 xl:col-span-3"><KpiTile label="Chiamate oggi" value={summary?.calls_today ?? 0} /></div>
					<div className="col-span-12 sm:col-span-6 xl:col-span-3"><KpiTile label="Minuti mese" value={summary?.minutes_mtd ?? 0} /></div>
					<div className="col-span-12 sm:col-span-6 xl:col-span-3"><KpiTile label="Durata media" value={fmtMMSS(summary?.avg_duration_sec || 0)} /></div>
					<div className="col-span-12 sm:col-span-6 xl:col-span-3"><KpiTile label="Tasso di contatto" value={`${Math.round((summary?.success_rate ?? 0)*100)}%`} status={(summary?.success_rate??0)<0.15?'danger':(summary?.success_rate??0)<0.25?'warn':'success'} /></div>
				</div>
			)}

			{/* Charts + Spend + Live */}
			<div className="grid grid-cols-12 gap-4">
				<div className="col-span-12 xl:col-span-8">
					<Card title="Trends">
						<div className="h-32 overflow-hidden">
							{loading ? <SkeletonRow lines={6} /> : (
								<Line height={120} options={{ plugins:{ legend:{ display:false }}, responsive:true, scales:{ y:{ grid:{ color:'rgba(0,0,0,.06)' }}, x:{ grid:{ display:false }}} }} data={{
									labels: trends.labels,
									datasets:[{ data: trends.calls, borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.15)', fill:true, tension:.3 }]
								}}/>
							)}
						</div>
						<div className="flex gap-2 mt-2">
							<button className="btn" onClick={()=> setTrendDays(7)} disabled={trendDays===7}>7d</button>
							<button className="btn" onClick={()=> setTrendDays(30)} disabled={trendDays===30}>30d</button>
						</div>
					</Card>
				</div>
				<div className="col-span-12 md:col-span-6 xl:col-span-4">
					<SpendCard title="Spend vs Budget" spendCents={summary?.spend_mtd_cents||0} budgetCents={summary?.budget_cap_cents||0} costPerMin={`${(summary?.spend_mtd_cents||0) && (summary?.minutes_mtd||0) ? `€${((summary.spend_mtd_cents/100)/Math.max(1,summary.minutes_mtd)).toFixed(2)}`:'—'}`} />
				</div>
				<div className="col-span-12 md:col-span-6 xl:col-span-4">
					<Card title="Live Calls">
						<div className="h-48 overflow-y-auto">
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
						</div>
					</Card>
				</div>
			</div>

			<div className="grid grid-cols-12 gap-4">
				<div className="col-span-12 xl:col-span-6">
					<div className="h-64 overflow-y-auto">
						<TodayUpcoming loading={loading} items={upcoming.map(u=> ({ type:u.kind, lang:u.lang, lead:u.lead, localTime:u.local_time }))} />
					</div>
				</div>
				<div className="col-span-12 xl:col-span-6">
					<div className="h-64 overflow-y-auto">
						<CampaignHealth loading={loading} rows={campaigns.map(c=> ({ name:c.name, status:c.status, progress:c.progress_pct, qualified_pct:c.qualified_rate_pct, spend: typeof c.spend_cents==='number'? `€${(c.spend_cents/100).toFixed(2)}` : '—' }))} />
					</div>
				</div>
			</div>

			{/* Recent activity */}
			<Card title="Recent Activity">
				<div className="h-48 overflow-y-auto">
					{loading ? <SkeletonRow lines={6} /> : (
						<div className="grid gap-2">
							{events.map((e,i)=>(<div key={i} className="panel p-3">{e.text ?? '—'}</div>))}
							{!events.length && <div className="kpi-title">No activity yet</div>}
						</div>
					)}
				</div>
			</Card>

			<div className="grid grid-cols-12 gap-4">
				<div className="col-span-12 xl:col-span-7">
					<div className="h-64 overflow-y-auto">
						<Tasks loading={loading} items={tasks.map(t=> ({ text: t.text, id:t.id }))} onAction={()=>{}} />
					</div>
				</div>
				<div className="col-span-12 xl:col-span-5">
					<div className="h-48 overflow-y-auto">
						<People loading={loading} members={members.map(m=> ({ name:m.name, email:m.email, role:m.role, last_activity:m.last_activity }))} />
					</div>
					<div className="mt-4 h-32 overflow-y-auto">
						<Guides />
					</div>
				</div>
			</div>
		</div>
	)
}
