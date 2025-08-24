import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { Skeleton } from '../components/ui/Skeleton.jsx'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/FormPrimitives.jsx'
import KpiCard from '../components/ui/KpiCard.jsx'
import TimeSeries from '../components/ui/TimeSeries.jsx'
import GaugeBudget from '../components/ui/GaugeBudget.jsx'
import FunnelSteps from '../components/ui/FunnelSteps.jsx'
import TopAgentsBar from '../components/ui/TopAgentsBar.jsx'
import MiniMap from '../components/ui/MiniMap.jsx'
import EventFeed from '../components/ui/EventFeed.jsx'
import DataTable from '../components/DataTable.jsx'
import useLiveWS from '../lib/useLiveWS.js'
import { useDemoData } from '../lib/useDemoData.js'
import CallsHistogram from '../components/ui/CallsHistogram.jsx'
import ConversionFunnel from '../components/ui/ConversionFunnel.jsx'
import SlaSparkline from '../components/ui/SlaSparkline.jsx'
import { 
	generateDemoMetrics, 
	generateDemoFunnelData, 
	generateDemoAgents, 
	generateDemoGeoData, 
	generateDemoCostSeries, 
	generateDemoTrends,
	generateDemoBilling
} from '../lib/demo/fakes.js'

export default function Dashboard() {
	const { t } = useTranslation('pages')
	const navigate = useNavigate()
	
	const abortControllerRef = useRef(null)
	const showDemoData = useDemoData()
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
			// Use demo data for admin users, real API for others
			if (showDemoData) {
				// Generate demo data for admin users
				const s = generateDemoMetrics()
				// Hardening: se per qualche motivo i budget sono 0, forzali dal billing demo
				if (!s.budget_monthly_cents || s.budget_monthly_cents <= 0) {
					const b = generateDemoBilling()
					s.budget_monthly_cents = b.monthly_cap_cents
					s.budget_spent_month_cents = b.spent_month_cents
				}
				const f = generateDemoFunnelData()
				const a = generateDemoAgents()
				const g = generateDemoGeoData()
				const c = generateDemoCostSeries(30)
				
				setSummary(s)
				setFunnelData(f)
				setTopAgents(a)
				setGeoData(g)
				setCostSeries(c)
				setTrends(generateDemoTrends(trendDays))
			} else {
				// Real API calls for normal users - no demo data
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
				
				// Empty trends for new users
				const labels = Array.from({ length: trendDays }).map((_, i) => `${i + 1}`)
				setTrends({
					labels,
					created: labels.map(() => 0),
					finished: labels.map(() => 0),
					qualified: labels.map(() => 0),
					contact_rate: labels.map(() => 0)
				})
			}
		} catch (err) {
			if (err.name !== 'AbortError') {
				setError(err.message)
				if (import.meta.env.DEV) {
					console.error('Dashboard load error:', err)
				}
			}
		} finally { 
			setLoading(false) 
		}
	}, [trendDays, showDemoData])

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
		lead: call.lead_name || t('common.unknown'),
		agent: call.agent_name || t('common.unknown'),
		status: call.status || 'unknown',
		started: call.started_at ? new Date(call.started_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
		duration: call.duration_sec ? fmtMMSS(call.duration_sec) : '00:00'
	}))

	// Error state
	if (error) {
		return (
			<div className="px-6 lg:px-8 py-6">
				<div className="space-y-6 md:space-y-8">
					<PageHeader 
						title={t('dashboard.title')}
						description={t('dashboard.description')}
					/>
					<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 md:p-6 text-center py-12">
						<div className="text-lg font-semibold text-red-600 mb-2">{t('common.error')}</div>
						<div className="text-gray-600 mb-4">{error}</div>
						<button 
							onClick={() => load(abortControllerRef.current?.signal)}
							className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
						>
							{t('common.retry')}
						</button>
					</div>
				</div>
			</div>
		)
	}

	// Loading state
	if (loading && !summary) {
		return (
			<div className="px-6 lg:px-8 py-6">
				<div className="space-y-6 md:space-y-8">
					<PageHeader 
						title={t('dashboard.title')}
						description={t('dashboard.description')}
					/>
					<div className="grid grid-cols-12 gap-4 md:gap-6">
						{/* KPI Cards Skeletons */}
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="col-span-12 md:col-span-3">
								<Skeleton height={120} className="rounded-xl" />
							</div>
						))}
						
						{/* Chart Skeletons */}
						<div className="col-span-12 xl:col-span-8">
							<Skeleton height={280} className="rounded-xl" />
						</div>
						<div className="col-span-12 xl:col-span-4">
							<Skeleton height={280} className="rounded-xl" />
						</div>
						
						{/* Secondary Charts Skeletons */}
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="col-span-12 lg:col-span-4">
								<Skeleton height={280} className="rounded-xl" />
							</div>
						))}
						
						{/* Bottom Tables Skeletons */}
						<div className="col-span-12 xl:col-span-8">
							<Skeleton height={360} className="rounded-xl" />
						</div>
						<div className="col-span-12 xl:col-span-4">
							<Skeleton height={360} className="rounded-xl" />
						</div>
					</div>
				</div>
			</div>
		)
	}

	// Empty state when no data
	if (!loading && !summary && !error) {
		return (
			<div className="px-6 lg:px-8 py-6">
				<div className="space-y-6 md:space-y-8">
					<PageHeader 
						title={t('dashboard.title')}
						description={t('dashboard.description')}
					/>
					<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 md:p-6 text-center py-12">
						<div className="text-lg font-semibold text-gray-900 mb-2">{t('dashboard.empty.title', 'No Dashboard Data')}</div>
						<div className="text-gray-600 mb-4">{t('dashboard.empty.description', 'Start by creating your first campaign or importing leads.')}</div>
						<button 
							onClick={() => navigate('/campaigns')}
							className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
						>
							{t('dashboard.empty.cta', 'Get Started')}
						</button>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="px-6 lg:px-8 py-6" data-testid="dashboard-loaded">
			<div className="space-y-6 md:space-y-8">
				<PageHeader 
					title={t('dashboard.title')}
					description={t('dashboard.description')}
				/>
				
				{/* Demo Data Banner for Admin */}
				{showDemoData && (
					<div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-amber-500"></div>
							<span className="text-sm font-medium text-amber-800">
								{t('admin.demo_data_enabled', 'Demo data enabled - showing sample metrics')}
							</span>
						</div>
					</div>
				)}
				
				{/* 12-Column Grid Layout - righe auto, niente overlap */}
				<div className="grid grid-cols-12 auto-rows-auto items-start gap-4 md:gap-6">
				
					{/* Row 1: KPI Cards (3×4) - tutte size="sm" per riga compatta */}
					<div className="col-span-12 md:col-span-3" data-card="true">
						<KpiCard 
							label={t('dashboard.kpi.calls_today')} 
							value={summary?.calls_today || 0}
							delta={showDemoData ? 12 : undefined}
							state={summary?.calls_today > 50 ? 'warn' : 'normal'}
							trendData={showDemoData ? [12, 15, 18, 22, 19, 24, 28] : undefined}
							className="min-h-[120px]"
						/>
					</div>
					<div className="col-span-12 md:col-span-3" data-card="true">
						<KpiCard 
							label={t('dashboard.kpi.minutes_month')} 
							value={summary?.minutes_month || 0}
							delta={showDemoData ? -5 : undefined}
							trendData={showDemoData ? [120, 135, 142, 138, 156, 148, 162] : undefined}
							className="min-h-[120px]"
						/>
					</div>
					<div className="col-span-12 md:col-span-3" data-card="true">
						<KpiCard 
							label={t('dashboard.kpi.avg_duration')} 
							value={fmtMMSS(summary?.avg_duration_sec || 0)}
							delta={showDemoData ? 8 : undefined}
							trendData={showDemoData ? [120, 125, 118, 132, 128, 135, 142] : undefined}
							className="min-h-[120px]"
						/>
					</div>
					<div className="col-span-12 md:col-span-3" data-card="true">
						<KpiCard 
							label={t('dashboard.kpi.contact_rate')} 
							value={`${Math.round((summary?.contact_rate || 0) * 100)}%`}
							delta={showDemoData ? 12 : undefined}
							state={summary?.contact_rate < 0.2 ? 'danger' : summary?.contact_rate < 0.3 ? 'warn' : 'normal'}
							trendData={showDemoData ? [25, 28, 22, 26, 24, 21, 23] : undefined}
							className="min-h-[120px]"
						/>
					</div>
				
					{/* Row 2: CallsHistogram + GaugeBudget - size="lg" e "md" */}
					<div className="col-span-12 xl:col-span-8" data-card="true">
						<div className="rounded-2xl border bg-white overflow-hidden">
							<div className="flex items-center justify-between p-4">
								<h3 className="text-sm font-medium">{t('dashboard.widgets.calls_histogram')}</h3>
								<div className="flex items-center gap-2">
									<button 
										onClick={() => setTrendDays(7)} 
										className={`px-3 py-1 text-xs rounded-lg ${trendDays === 7 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}
									>
										{t('dashboard.buttons.7d')}
									</button>
									<button 
										onClick={() => setTrendDays(30)} 
										className={`px-3 py-1 text-xs rounded-lg ${trendDays === 30 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}
									>
										{t('dashboard.buttons.30d')}
									</button>
								</div>
							</div>
							<div className="px-4 pb-4">
								<CallsHistogram 
									buckets={trends.created?.map((value, i) => ({ label: `Day ${i+1}`, count: value })) || []}
									label={t('dashboard.metrics.calls_created')}
								/>
							</div>
						</div>
					</div>
					<div className="col-span-12 xl:col-span-4" data-card="true">
						<GaugeBudget 
							spent={summary?.budget_spent_month_cents || 0}
							cap={summary?.budget_monthly_cents || 0}
							warnPercent={80}
							labelPosition="outside"
							className="min-h-[320px]"
						/>
					</div>
				
					{/* Row 3: Event Feed + TopAgents + Geo — tutte alte uguali (320px) e non scrollano */}
					<div className="col-span-12 lg:col-span-4" data-card="true">
						<div className="rounded-2xl border bg-white p-4 min-h-[320px] overflow-hidden">
							<h3 className="text-sm font-medium mb-4">{t('dashboard.widgets.events', 'Event Feed')}</h3>
							<EventFeed events={events} className="min-h-[320px]" />
						</div>
					</div>
					<div className="col-span-12 lg:col-span-4" data-card="true">
						<div className="rounded-2xl border bg-white p-4 min-h-[320px] overflow-hidden">
							<TopAgentsBar 
								agents={showDemoData ? topAgents : []}
								onDrillDown={(agentId) => handleDrillDown('agent', agentId)}
								className="min-h-[320px] overflow-hidden"
							/>
						</div>
					</div>
					<div className="col-span-12 lg:col-span-4" data-card="true">
						<div className="rounded-2xl border bg-white p-4 min-h-[320px] overflow-hidden">
							<MiniMap 
								data={showDemoData ? geoData : []}
								onDrillDown={(country) => handleDrillDown('country', country)}
							/>
						</div>
					</div>
					<div className="col-span-12 lg:col-span-4" data-card="true">
						<div className="rounded-2xl border bg-white p-4 min-h-[360px] overflow-hidden">
							<h3 className="text-sm font-medium mb-4">{t('dashboard.widgets.sla')}</h3>
							<SlaSparkline 
								points={showDemoData ? [120, 95, 180, 150, 200, 160, 140] : [0, 0, 0, 0, 0, 0, 0]} 
								thresholdMs={5000} 
							/>
						</div>
					</div>
				
					{/* Row 4: LiveTable + EventFeed - size="lg" e "md" con scroll interno */}
					<div className="col-span-12 xl:col-span-8" data-card="true">
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 md:p-6 min-h-[360px] overflow-hidden">
							<div className="flex items-center justify-between mb-4">
								<div className="text-sm font-semibold text-gray-900">{t('dashboard.widgets.live_calls')}</div>
								<div className="flex items-center gap-2">
									<div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
									<span className="text-xs text-gray-600 tabular-nums">
										{isConnected
											? t('common.live_status', { count: liveCalls.length })
											: t('common.polling_status', { count: liveCalls.length })}
									</span>
								</div>
							</div>
							
							{liveCalls.length === 0 ? (
								<div className="text-sm text-gray-500 text-center py-8">{t('dashboard.states.no_calls')}</div>
							) : (
								<div className="max-h-[280px] overflow-y-auto pr-2">
									<DataTable
										data={liveCallsData}
										columns={[
											{ key: 'lead', label: t('common.lead') },
											{ key: 'agent', label: t('common.agent') },
											{ key: 'status', label: t('common.status') },
											{ key: 'started', label: t('common.started') },
											{ key: 'duration', label: t('common.duration') }
										]}
									/>
								</div>
							)}
						</div>
					</div>
					<div className="col-span-12 xl:col-span-4" data-card="true">
						<EventFeed events={events} className="min-h-[360px] max-h-56 overflow-y-auto" />
					</div>
				</div>
			</div>
		</div>
	)
}
