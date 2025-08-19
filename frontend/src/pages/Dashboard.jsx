import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { Skeleton } from '../components/ui/Skeleton.jsx'
import { useI18n } from '../lib/i18n.jsx'
import DashboardHeader from '../components/DashboardHeader.jsx'
import KpiCard from '../components/ui/KpiCard.jsx'
import TimeSeries from '../components/ui/TimeSeries.jsx'
import GaugeBudget from '../components/ui/GaugeBudget.jsx'
import FunnelSteps from '../components/ui/FunnelSteps.jsx'
import TopAgentsBar from '../components/ui/TopAgentsBar.jsx'
import MiniMap from '../components/ui/MiniMap.jsx'
import EventFeed from '../components/ui/EventFeed.jsx'
import DataTable from '../components/DataTable.jsx'
import useLiveWS from '../lib/useLiveWS.js'

export default function Dashboard() {
	const { t } = useI18n()
	const [summary, setSummary] = useState(null)
	const [funnelData, setFunnelData] = useState({})
	const [topAgents, setTopAgents] = useState([])
	const [geoData, setGeoData] = useState([])
	const [trendDays, setTrendDays] = useState(7)
	const [trends, setTrends] = useState({ created: [], finished: [], qualified: [], contact_rate: [] })
	const [loading, setLoading] = useState(true)
	
	// Live WebSocket hook
	const { 
		isConnected, 
		events, 
		liveCalls, 
		costToday, 
		errors24h, 
		lastUpdate 
	} = useLiveWS('/ws')

	async function load() {
		setLoading(true)
		try {
			const [s, f, a, g] = await Promise.all([
				apiFetch(`/dashboard/summary?days=${trendDays}`).catch(() => ({
					calls_today: 0,
					minutes_month: 0,
					avg_duration_sec: 0,
					contact_rate: 0.0,
					qualified_rate: 0.0,
					spend_today_cents: 0,
					budget_monthly_cents: 100000, // €1000 default
					budget_spent_month_cents: 0,
					concurrency_used: 0,
					concurrency_limit: 10
				})),
				apiFetch('/metrics/funnel?days=30').catch(() => ({ reached: 0, connected: 0, qualified: 0, booked: 0 })),
				apiFetch('/metrics/agents/top?days=30&limit=10').catch(() => []),
				apiFetch('/metrics/geo?days=30').catch(() => [])
			])
			
			setSummary(s)
			setFunnelData(f)
			setTopAgents(a)
			setGeoData(g)
			
			// Generate trend data (placeholder for now)
			const labels = Array.from({ length: trendDays }).map((_, i) => `${i + 1}`)
			setTrends({
				labels,
				created: labels.map(() => Math.floor(Math.random() * 20 + 10)),
				finished: labels.map(() => Math.floor(Math.random() * 15 + 8)),
				qualified: labels.map(() => Math.floor(Math.random() * 10 + 5)),
				contact_rate: labels.map(() => Math.floor(Math.random() * 30 + 20))
			})
		} finally { 
			setLoading(false) 
		}
	}

	useEffect(() => {
		load()
	}, [trendDays])

	function fmtMMSS(sec) { 
		const m = Math.floor((sec || 0) / 60)
		const s = (sec || 0) % 60
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
	}

	// Live calls table data
	const liveCallsData = liveCalls.map(call => ({
		id: call.id,
		lead: call.lead_name || 'Unknown',
		agent: call.agent_name || 'Unknown',
		status: call.status || 'unknown',
		started: call.started_at ? new Date(call.started_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
		duration: call.duration_sec ? fmtMMSS(call.duration_sec) : '00:00'
	}))

	if (loading && !summary) {
		return (
			<div className="space-y-6">
				<DashboardHeader title="Dashboard" range={{}} onRangeChange={() => {}} onQuick={() => {}} />
				<div className="grid grid-cols-12 gap-4">
					{Array.from({ length: 12 }).map((_, i) => (
						<div key={i} className={`${i < 4 ? 'col-span-3' : i === 4 ? 'col-span-8' : i === 5 ? 'col-span-4' : i === 6 ? 'col-span-4' : i === 7 ? 'col-span-4' : i === 8 ? 'col-span-4' : i === 9 ? 'col-span-8' : 'col-span-4'}`}>
							<Skeleton height={i < 4 ? 84 : i === 4 ? 256 : i === 5 ? 256 : i === 6 ? 256 : i === 7 ? 256 : i === 8 ? 256 : i === 9 ? 256 : 256} />
						</div>
					))}
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<DashboardHeader 
				title="Dashboard" 
				range={{}} 
				onRangeChange={() => {}} 
				onQuick={() => {}} 
			/>
			
			{/* 12-Column Grid Layout */}
			<div className="grid grid-cols-12 gap-4">
				
				{/* Row 1: KPI Cards (3×4) */}
				<div className="col-span-3">
					<KpiCard 
						label="Calls Today" 
						value={summary?.calls_today || 0}
						delta={12}
						state={summary?.calls_today > 50 ? 'warn' : 'normal'}
						trendData={[12, 15, 18, 22, 19, 24, 28]}
					/>
				</div>
				<div className="col-span-3">
					<KpiCard 
						label="Minutes Month" 
						value={summary?.minutes_month || 0}
						delta={-5}
						trendData={[120, 135, 142, 138, 156, 148, 162]}
					/>
				</div>
				<div className="col-span-3">
					<KpiCard 
						label="Avg Duration" 
						value={fmtMMSS(summary?.avg_duration_sec || 0)}
						delta={8}
						trendData={[120, 125, 118, 132, 128, 135, 142]}
					/>
				</div>
				<div className="col-span-3">
					<KpiCard 
						label="Contact Rate" 
						value={`${Math.round((summary?.contact_rate || 0) * 100)}%`}
						delta={-3}
						state={summary?.contact_rate < 0.2 ? 'danger' : summary?.contact_rate < 0.3 ? 'warn' : 'normal'}
						trendData={[25, 28, 22, 26, 24, 21, 23]}
					/>
				</div>
				
				{/* Row 2: TimeSeries + GaugeBudget */}
				<div className="col-span-8">
					<TimeSeries 
						data={trends}
						labels={trends.labels}
						days={trendDays}
						onDaysChange={setTrendDays}
					/>
				</div>
				<div className="col-span-4">
					<GaugeBudget 
						spent={summary?.budget_spent_month_cents || 0}
						cap={summary?.budget_monthly_cents || 100000}
						warnPercent={80}
					/>
				</div>
				
				{/* Row 3: Funnel + TopAgents + MiniMap */}
				<div className="col-span-4">
					<FunnelSteps data={funnelData} />
				</div>
				<div className="col-span-4">
					<TopAgentsBar agents={topAgents} />
				</div>
				<div className="col-span-4">
					<MiniMap data={geoData} />
				</div>
				
				{/* Row 4: LiveTable + EventFeed */}
				<div className="col-span-8">
					<div className="panel">
						<div className="flex items-center justify-between mb-4">
							<div className="text-sm font-semibold text-ink-900">Live Calls</div>
							<div className="flex items-center gap-2">
								<div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`}></div>
								<span className="text-xs text-ink-600">
									{isConnected ? 'Live' : 'Polling'} • {liveCalls.length} active
								</span>
							</div>
						</div>
						
						{liveCalls.length === 0 ? (
							<div className="text-sm text-ink-500 text-center py-8">No active calls</div>
						) : (
							<DataTable
								data={liveCallsData}
								columns={[
									{ key: 'lead', label: 'Lead' },
									{ key: 'agent', label: 'Agent' },
									{ key: 'status', label: 'Status' },
									{ key: 'started', label: 'Started' },
									{ key: 'duration', label: 'Duration' }
								]}
								className="h-64 overflow-y-auto"
							/>
						)}
					</div>
				</div>
				<div className="col-span-4">
					<EventFeed events={events} />
				</div>
			</div>
		</div>
	)
}
