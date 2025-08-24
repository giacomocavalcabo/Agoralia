import React, { useState, useRef, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import ChartCard, { EmptyChart, chartDefaults } from './ChartCard.jsx'
import { useTranslation } from 'react-i18next'

export default function TimeSeries({ 
	data = { created: [], finished: [], qualified: [], contact_rate: [] },
	labels = [],
	days = 7,
	onDaysChange,
	className = ''
}) {
	const { t } = useTranslation('pages')
	const [selectedDays, setSelectedDays] = useState(days)
	const chartRef = useRef(null)
	
	const handleDaysChange = (newDays) => {
		setSelectedDays(newDays)
		if (onDaysChange) onDaysChange(newDays)
	}
	
	// Cleanup chart on unmount (CRITICAL for memory management)
	useEffect(() => {
		return () => {
			if (chartRef.current) {
				chartRef.current.destroy()
			}
		}
	}, [])
	
	const chartData = {
		labels: labels.slice(-selectedDays),
		datasets: [
			{
				label: t('dashboard.metrics.calls_created'),
				data: data.created?.slice(-selectedDays) || [],
				borderColor: chartDefaults.colors.primary,
				backgroundColor: 'rgba(20, 184, 166, 0.1)',
				borderWidth: 2,
				fill: true,
				tension: 0.35,
				yAxisID: 'y'
			},
			{
				label: t('dashboard.metrics.calls_finished'),
				data: data.finished?.slice(-selectedDays) || [],
				borderColor: chartDefaults.colors.success,
				backgroundColor: 'rgba(22, 163, 74, 0.1)',
				borderWidth: 2,
				fill: true,
				tension: 0.35,
				yAxisID: 'y'
			},
			{
				label: t('dashboard.metrics.calls_qualified'),
				data: data.qualified?.slice(-selectedDays) || [],
				borderColor: chartDefaults.colors.warning,
				backgroundColor: 'rgba(217, 119, 6, 0.1)',
				borderWidth: 2,
				fill: true,
				tension: 0.35,
				yAxisID: 'y'
			},
			{
				label: t('dashboard.metrics.contact_rate'),
				data: data.contact_rate?.slice(-selectedDays) || [],
				borderColor: chartDefaults.colors.info,
				backgroundColor: 'transparent',
				borderWidth: 2,
				fill: false,
				tension: 0.35,
				yAxisID: 'y2',
				borderDash: [5, 5]
			}
		]
	}
	
	const options = {
		responsive: true,
		maintainAspectRatio: false,
		parsing: false,
		interaction: {
			mode: 'index',
			intersect: false,
		},
		plugins: {
			legend: {
				display: true,
				position: 'bottom',
				labels: {
					usePointStyle: true,
					padding: 20,
					font: { size: 12 }
				}
			},
			tooltip: {
				backgroundColor: 'var(--bg-card)',
				titleColor: 'var(--ink-900)',
				bodyColor: 'var(--ink-700)',
				borderColor: 'var(--line)',
				borderWidth: 1,
				cornerRadius: 8,
				displayColors: true,
				intersect: false,
				mode: 'index',
				callbacks: {
					label: function(context) {
						const label = context.dataset.label || ''
						const value = context.parsed.y
						if (context.dataset.yAxisID === 'y2') { // Contact Rate
							return `${label}: ${Math.round(value)}%`
						}
						return `${label}: ${value}`
					}
				}
			},
			zoom: {
				pan: {
					enabled: true,
					mode: 'x'
				},
				zoom: {
					wheel: {
						enabled: true,
					},
					pinch: {
						enabled: true
					},
					mode: 'x',
				}
			},
			annotation: {
				annotations: {
					warn: {
						type: 'line',
						yMin: 80,
						yMax: 80,
						borderDash: [6, 6],
						borderColor: 'var(--warn)',
						borderWidth: 2,
						label: {
							content: '80% Target',
							enabled: true,
							position: 'end'
						}
					}
				}
			}
		},
		scales: {
			x: {
				type: 'category',
				grid: {
					color: 'var(--line)',
					drawBorder: false,
					display: false
				},
				ticks: {
					color: 'var(--ink-600)',
					font: { size: 11 }
				}
			},
			y: {
				type: 'linear',
				display: true,
				position: 'left',
				beginAtZero: true,
				grid: {
					color: 'var(--line)',
					drawBorder: false
				},
				ticks: {
					color: 'var(--ink-600)',
					font: { size: 11 },
					precision: 0
				}
			},
			y2: {
				type: 'linear',
				display: true,
				position: 'right',
				min: 0,
				max: 100,
				grid: {
					drawOnChartArea: false,
				},
				ticks: {
					color: 'var(--ink-600)',
					font: { size: 11 },
					callback: function(value) {
						return value + '%'
					}
				}
			}
		}
	}
	
	// Check if chart has data
	const hasData = labels.length > 0 && (
		(data.created?.length > 0) || 
		(data.finished?.length > 0) || 
		(data.qualified?.length > 0) || 
		(data.contact_rate?.length > 0)
	)

	// Days selector component
	const daysSelector = (
		<div className="flex gap-1">
			{[7, 30].map(d => (
				<button
					key={d}
					onClick={() => handleDaysChange(d)}
					className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
						selectedDays === d 
							? 'bg-green-600 text-white border-transparent' 
							: 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
					}`}
				>
					{t(`dashboard.buttons.${d}d`, `${d}d`)}
				</button>
			))}
		</div>
	)

	return (
		<ChartCard
			title={t('dashboard.trends.title', 'Call Trends')}
			action={daysSelector}
			isEmpty={!hasData}
			emptyMessage={t('dashboard.trends.empty', 'No trend data available')}
			className={className}
		>
			{hasData && (
				<>
					{/* Chart */}
					<div className="h-64 mb-4">
						<Line 
							ref={chartRef}
							data={chartData} 
							options={options} 
						/>
					</div>
					
					{/* Summary stats */}
					<div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
						{[
							{ label: t('dashboard.stats.total_created', 'Total Created'), value: data.created?.reduce((a, b) => a + b, 0) || 0, color: 'text-teal-600' },
							{ label: t('dashboard.stats.total_finished', 'Total Finished'), value: data.finished?.reduce((a, b) => a + b, 0) || 0, color: 'text-green-600' },
							{ label: t('dashboard.stats.total_qualified', 'Total Qualified'), value: data.qualified?.reduce((a, b) => a + b, 0) || 0, color: 'text-amber-600' },
							{ label: t('dashboard.stats.avg_contact_rate', 'Avg Contact Rate'), value: data.contact_rate?.length > 0 ? (data.contact_rate.reduce((a, b) => a + b, 0) / data.contact_rate.length).toFixed(1) : 0, color: 'text-blue-600', suffix: '%' }
						].map((stat, index) => (
							<div key={index} className="text-center">
								<div className={`text-lg font-semibold ${stat.color}`}>
									{stat.value}{stat.suffix || ''}
								</div>
								<div className="text-xs text-gray-600">{stat.label}</div>
							</div>
						))}
					</div>
				</>
			)}
		</ChartCard>
	)
}
