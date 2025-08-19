import React, { useState, useRef, useEffect } from 'react'
import { Line } from 'react-chartjs-2'

export default function TimeSeries({ 
	data = { created: [], finished: [], qualified: [], contact_rate: [] },
	labels = [],
	days = 7,
	onDaysChange,
	className = ''
}) {
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
				label: 'Created',
				data: data.created?.slice(-selectedDays) || [],
				borderColor: 'var(--brand-600)',
				backgroundColor: 'rgba(15, 169, 88, 0.1)',
				borderWidth: 2,
				fill: true,
				tension: 0.4,
				yAxisID: 'y'
			},
			{
				label: 'Finished',
				data: data.finished?.slice(-selectedDays) || [],
				borderColor: 'var(--success)',
				backgroundColor: 'rgba(16, 185, 129, 0.1)',
				borderWidth: 2,
				fill: true,
				tension: 0.4,
				yAxisID: 'y'
			},
			{
				label: 'Qualified',
				data: data.qualified?.slice(-selectedDays) || [],
				borderColor: 'var(--warn)',
				backgroundColor: 'rgba(245, 158, 11, 0.1)',
				borderWidth: 2,
				fill: true,
				tension: 0.4,
				yAxisID: 'y'
			},
			{
				label: 'Contact Rate',
				data: data.contact_rate?.slice(-selectedDays) || [],
				borderColor: 'var(--info)',
				backgroundColor: 'transparent',
				borderWidth: 2,
				fill: false,
				tension: 0.4,
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
					font: { size: 11 }
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
	
	return (
		<div className={`panel ${className}`}>
			<div className="flex items-center justify-between mb-4">
				<div className="text-sm font-semibold text-ink-900">Call Trends</div>
				
				{/* Days selector */}
				<div className="flex gap-1">
					{[7, 30].map(d => (
						<button
							key={d}
							onClick={() => handleDaysChange(d)}
							className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
								selectedDays === d 
									? 'bg-brand-600 text-white border-transparent' 
									: 'border-line bg-bg-app text-ink-600 hover:bg-bg-app/80'
							}`}
						>
							{d}d
						</button>
					))}
				</div>
			</div>
			
			{/* Chart */}
			<div className="h-64">
				<Line 
					ref={chartRef}
					data={chartData} 
					options={options} 
				/>
			</div>
			
			{/* Summary stats */}
			<div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-line">
				{[
					{ label: 'Total Created', value: data.created?.reduce((a, b) => a + b, 0) || 0, color: 'text-brand-600' },
					{ label: 'Total Finished', value: data.finished?.reduce((a, b) => a + b, 0) || 0, color: 'text-success' },
					{ label: 'Total Qualified', value: data.qualified?.reduce((a, b) => a + b, 0) || 0, color: 'text-warn' },
					{ label: 'Avg Contact Rate', value: data.contact_rate?.length > 0 ? (data.contact_rate.reduce((a, b) => a + b, 0) / data.contact_rate.length).toFixed(1) : 0, color: 'text-info', suffix: '%' }
				].map((stat, index) => (
					<div key={index} className="text-center">
						<div className={`text-lg font-semibold ${stat.color}`}>
							{stat.value}{stat.suffix || ''}
						</div>
						<div className="text-xs text-ink-600">{stat.label}</div>
					</div>
				))}
			</div>
		</div>
	)
}
