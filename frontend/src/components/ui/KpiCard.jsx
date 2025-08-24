import React from 'react'
import { Line } from 'react-chartjs-2'
// Chart.js plugins are registered globally in ChartCard.jsx

export default function KpiCard({ 
	label, 
	value, 
	delta, 
	trendData, 
	state = 'normal',
	className = ''
}) {
	const getStateStyles = () => {
		switch (state) {
			case 'danger':
				return 'border-red-200 bg-red-50'
			case 'warn':
				return 'border-amber-200 bg-amber-50'
			case 'success':
				return 'border-primary-200 bg-primary-50'
			default:
				return 'border-gray-200 bg-white'
		}
	}

	const getDeltaColor = () => {
		if (delta === undefined) return 'text-gray-600'
		return delta >= 0 ? 'text-green-600' : 'text-red-600'
	}

	const getDeltaIcon = () => {
		if (delta === undefined) return null
		return delta >= 0 ? '▲' : '▼'
	}

	return (
		<div className={`rounded-xl border shadow-sm p-4 md:p-6 ${getStateStyles()} ${className}`} data-testid="kpi-card">
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="text-sm text-gray-600 mb-1">{label}</div>
					<div className="text-2xl font-semibold text-gray-900 mb-2" data-testid="kpi-value">{value}</div>
					{delta !== undefined && (
						<div className={`text-xs font-medium ${getDeltaColor()}`}>
							{getDeltaIcon()} {Math.abs(delta)}%
						</div>
					)}
				</div>
				{trendData && trendData.length > 0 && (
					<div className="w-16 h-12 overflow-hidden rounded-lg">
						<Line
							data={{
								labels: trendData.map((_, i) => i),
								datasets: [{
									data: trendData,
									borderColor: state === 'danger' ? '#dc2626' : 
												state === 'warn' ? '#d97706' : 
												state === 'success' ? '#16a34a' : '#14b8a6',
									backgroundColor: 'transparent',
									borderWidth: 1,
									fill: false,
									tension: 0.2,
									pointRadius: 0
								}]
							}}
							options={{
								responsive: true,
								maintainAspectRatio: false,
								plugins: { legend: { display: false } },
								scales: { 
									x: { display: false },
									y: { display: false }
								},
								elements: { point: { radius: 0 } },
								layout: {
									padding: { top: 4, bottom: 4, left: 4, right: 4 }
								},
								interaction: { intersect: false }
							}}
						/>
					</div>
				)}
			</div>
		</div>
	)
}
