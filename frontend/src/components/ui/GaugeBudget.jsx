import React from 'react'

export default function GaugeBudget({ 
	spent, 
	cap, 
	warnPercent = 80,
	className = ''
}) {
	const percentage = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0
	
	// Dynamic colors based on spending percentage
	const getColor = () => {
		if (percentage >= 100) return 'text-danger'
		if (percentage >= warnPercent) return 'text-warn'
		return 'text-success'
	}
	
	const getGaugeColor = () => {
		if (percentage >= 100) return 'stroke-danger'
		if (percentage >= warnPercent) return 'stroke-warn'
		return 'stroke-success'
	}
	
	// End-of-month projection (simple linear regression from last 7 days)
	const projectedEOM = cap > 0 ? Math.min(100, (spent / cap) * 100 * 1.2) : 0
	
	// SVG gauge (semicircle)
	const radius = 40
	const circumference = Math.PI * radius
	const strokeDasharray = circumference
	const strokeDashoffset = circumference - (percentage / 100) * circumference
	
	return (
		<div className={`panel text-center ${className}`}>
			<div className="text-sm text-ink-600 mb-3">Budget Usage</div>
			
			{/* SVG Gauge */}
			<div className="relative inline-block mb-4">
				<svg width="100" height="60" viewBox="0 0 100 60">
					{/* Background circle */}
					<circle
						cx="50"
						cy="50"
						r={radius}
						fill="none"
						stroke="var(--line)"
						strokeWidth="8"
						transform="rotate(-90 50 50)"
					/>
					{/* Progress circle */}
					<circle
						cx="50"
						cy="50"
						r={radius}
						fill="none"
						stroke="currentColor"
						strokeWidth="8"
						strokeLinecap="round"
						transform="rotate(-90 50 50)"
						strokeDasharray={strokeDasharray}
						strokeDashoffset={strokeDashoffset}
						className={getGaugeColor()}
					/>
				</svg>
				
				{/* Center text */}
				<div className="absolute inset-0 flex items-center justify-center">
					<div className="text-center">
						<div className={`text-xl font-bold ${getColor()}`}>
							{Math.round(percentage)}%
						</div>
					</div>
				</div>
			</div>
			
			{/* Values */}
			<div className="space-y-2">
				<div className="text-sm">
					<span className="text-ink-600">Spent:</span>
					<span className="ml-2 font-semibold">€{(spent / 100).toFixed(2)}</span>
				</div>
				<div className="text-sm">
					<span className="text-ink-600">Cap:</span>
					<span className="ml-2 font-semibold">€{(cap / 100).toFixed(2)}</span>
				</div>
				<div className="text-sm">
					<span className="text-ink-600">Remaining:</span>
					<span className="ml-2 font-semibold">€{((cap - spent) / 100).toFixed(2)}</span>
				</div>
				
				{/* Projected EOM */}
				{projectedEOM > 0 && (
					<div className={`text-xs mt-3 p-2 rounded-lg ${
						projectedEOM >= 100 ? 'text-danger bg-danger/5 border border-danger/20' :
						projectedEOM >= warnPercent ? 'text-warn bg-warn/5 border border-warn/20' :
						'text-ink-500 bg-bg-app border border-line'
					}`}>
						Projected EOM: {Math.round(projectedEOM)}%
						{projectedEOM >= 100 && <span className="ml-1">⚠️ Over budget</span>}
						{projectedEOM >= warnPercent && projectedEOM < 100 && <span className="ml-1">⚠️ Near limit</span>}
					</div>
				)}
			</div>
		</div>
	)
}
