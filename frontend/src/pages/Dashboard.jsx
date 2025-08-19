import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
	const navigate = useNavigate()
	const abortControllerRef = useRef(null)
	
	const [summary, setSummary] = useState(null)
	const [funnelData, setFunnelData] = useState({})
	const [topAgents, setTopAgents] = useState([])
	const [geoData, setGeoData] = useState([])
	const [costSeries, setCostSeries] = useState([])
	const [trendDays, setTrendDays] = useState(7)
	const [trends, setTrends] = useState({ created: [], finished: [], qualified: [], contact_rate: [] })
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	
	// Live WebSocket hook
	const { 
		isConnected, 
		events, 
		liveCalls, 
		costToday, 
		errors24h, 
		lastUpdate 
	} = useLiveWS('/ws')

	// Load data with AbortController for cleanup
	const load = useCallback(async (abortSignal) => {
		setLoading(true)
		setError(null)
		
		try {
			const [s, f, a, g, c] = await Promise.all([
				apiFetch(`/dashboard/summary?days=${trendDays}`, { signal: abortSignal }).catch(() => ({
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
				apiFetch('/metrics/funnel?days=30', { signal: abortSignal }).catch(() => ({ reached: 0, connected: 0, qualified: 0, booked: 0 })),
				apiFetch('/metrics/agents/top?days=30&limit=10', { signal: abortSignal }).catch(() => []),
				apiFetch('/metrics/geo?days=30', { signal: abortSignal }).catch(() => []),
				apiFetch('/metrics/cost/series?days=30', { signal: abortSignal }).catch(() => [])
			])
			
			setSummary(s)
			setFunnelData(f)
			setTopAgents(a)
			setGeoData(g)
			setCostSeries(c)
			
			// Generate trend data (placeholder for now)
			const labels = Array.from({ length: trendDays }).map((_, i) => `${i + 1}`)
			setTrends({
				labels,
				created: labels.map(() => Math.floor(Math.random() * 20 + 10)),
				finished: labels.map(() => Math.floor(Math.random() * 15 + 8)),
				qualified: labels.map(() => Math.floor(Math.random() * 10 + 5)),
				contact_rate: labels.map(() => Math.floor(Math.random() * 30 + 20))
			})
		} catch (err) {
			if (err.name !== 'AbortError') {
				setError(err.message)
				console.error('Dashboard load error:', err)
			}
		} finally { 
			setLoading(false) 
		}
	}, [trendDays])

	// Load data on mount and trendDays change
	useEffect(() => {
		// Create new AbortController for this load
		abortControllerRef.current = new AbortController()
		
		load(abortControllerRef.current.signal)
		
		// Cleanup function
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort()
			}
		}
	}, [load])

	// Drill-down navigation functions
	const handleDrillDown = useCallback((type, value) => {
		const range = trendDays === 7 ? '7d' : '30d'
		
		switch (type) {
			case 'funnel-qualified':
				navigate(`/history?outcome=qualified&range=${range}`)
				break
			case 'agent':
				navigate(`/analytics?agent=${value}&range=${range}`)
				break
			case 'country':
				navigate(`/analytics?country=${value}&range=${range}`)
				break
			case 'cost':
				navigate(`/analytics?metric=cost&range=${range}`)
				break
		}
	}, [navigate, trendDays])

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

	// Error state
	if (error) {
		return (
			<div className="space-y-6">
				<DashboardHeader title="Dashboard" range={{}} onRangeChange={() => {}} onQuick={() => {}} />
				<div className="panel text-center py-12">
					<div className="text-lg font-semibold text-danger mb-2">Errore nel caricamento</div>
					<div className="text-ink-600 mb-4">{error}</div>
					<button 
						onClick={() => load(abortControllerRef.current?.signal)}
						className="btn"
					>
						Riprova
					</button>
				</div>
			</div>
		)
	}

	// Loading state
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
						costSeries={costSeries}
					/>
				</div>
				
				{/* Row 3: Funnel + TopAgents + MiniMap */}
				<div className="col-span-4">
					<FunnelSteps 
						data={funnelData} 
						onDrillDown={(step) => handleDrillDown('funnel-qualified', step)}
					/>
				</div>
				<div className="col-span-4">
					<TopAgentsBar 
						agents={topAgents}
						onDrillDown={(agentId) => handleDrillDown('agent', agentId)}
					/>
				</div>
				<div className="col-span-4">
					<MiniMap 
						data={geoData}
						onDrillDown={(country) => handleDrillDown('country', country)}
					/>
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
