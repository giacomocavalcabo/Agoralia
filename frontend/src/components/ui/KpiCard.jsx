import React from 'react'
import { Line } from 'react-chartjs-2'
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
				return 'border-danger/40 bg-danger/5'
			case 'warn':
				return 'border-warn/40 bg-warn/5'
			case 'success':
				return 'border-success/40 bg-success/5'
			default:
				return 'border-line bg-bg-card'
		}
	}

	const getDeltaColor = () => {
		if (delta === undefined) return 'text-ink-600'
		return delta >= 0 ? 'text-success' : 'text-danger'
	}

	const getDeltaIcon = () => {
		if (delta === undefined) return null
		return delta >= 0 ? '▲' : '▼'
	}

	return (
		<div className={`panel border-2 ${getStateStyles()} ${className}`}>
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="text-sm text-ink-600 mb-1">{label}</div>
					<div className="text-2xl font-semibold text-ink-900 mb-2">{value}</div>
					{delta !== undefined && (
						<div className={`text-xs font-medium ${getDeltaColor()}`}>
							{getDeltaIcon()} {Math.abs(delta)}%
						</div>
					)}
				</div>
				{trendData && trendData.length > 0 && (
					<div className="w-16 h-12">
						<Line
							data={{
								labels: trendData.map((_, i) => i),
								datasets: [{
									data: trendData,
									borderColor: state === 'danger' ? 'var(--danger)' : 
												state === 'warn' ? 'var(--warn)' : 
												state === 'success' ? 'var(--success)' : 'var(--brand-600)',
									backgroundColor: 'transparent',
									borderWidth: 2,
									fill: false,
									tension: 0.4,
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
								elements: { point: { radius: 0 } }
							}}
						/>
					</div>
				)}
			</div>
		</div>
	)
}
