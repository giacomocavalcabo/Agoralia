import React from 'react'

export default function FunnelSteps({ 
	data = { reached: 0, connected: 0, qualified: 0, booked: 0 },
	className = ''
}) {
	const steps = [
		{ key: 'reached', label: 'Reached', color: 'bg-info' },
		{ key: 'connected', label: 'Connected', color: 'bg-brand-600' },
		{ key: 'qualified', label: 'Qualified', color: 'bg-success' },
		{ key: 'booked', label: 'Booked', color: 'bg-warn' }
	]
	
	const maxValue = Math.max(...Object.values(data))
	
	const calculatePercentage = (value) => {
		return maxValue > 0 ? (value / maxValue) * 100 : 0
	}
	
	const calculateDropOff = (current, previous) => {
		if (previous === 0) return 0
		return ((previous - current) / previous) * 100
	}
	
	return (
		<div className={`panel ${className}`}>
			<div className="text-sm font-semibold text-ink-900 mb-4">Conversion Funnel</div>
			
			<div className="space-y-4">
				{steps.map((step, index) => {
					const value = data[step.key] || 0
					const percentage = calculatePercentage(value)
					const previousValue = index > 0 ? data[steps[index - 1].key] || 0 : 0
					const dropOff = index > 0 ? calculateDropOff(value, previousValue) : 0
					
					return (
						<div key={step.key} className="relative">
							{/* Step header */}
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<div className={`w-3 h-3 rounded-full ${step.color}`}></div>
									<span className="text-sm font-medium text-ink-900">{step.label}</span>
								</div>
								<div className="text-sm text-ink-600">{value}</div>
							</div>
							
							{/* Progress bar */}
							<div className="w-full bg-line rounded-full h-3">
								<div 
									className={`h-3 rounded-full ${step.color} transition-all duration-500 ease-out`}
									style={{ width: `${percentage}%` }}
								></div>
							</div>
							
							{/* Drop-off indicator */}
							{index > 0 && dropOff > 0 && (
								<div className="absolute -top-1 right-0 text-xs text-ink-500 bg-bg-app px-2 py-1 rounded-full border border-line">
									-{Math.round(dropOff)}%
								</div>
							)}
							
							{/* Percentage */}
							<div className="text-xs text-ink-600 mt-1 text-right">
								{Math.round(percentage)}% of max
							</div>
						</div>
					)
				})}
			</div>
			
			{/* Summary */}
			<div className="mt-4 pt-4 border-t border-line">
				<div className="text-xs text-ink-600">
					Overall conversion: {maxValue > 0 ? Math.round((data.booked / data.reached) * 100) : 0}%
				</div>
			</div>
		</div>
	)
}
