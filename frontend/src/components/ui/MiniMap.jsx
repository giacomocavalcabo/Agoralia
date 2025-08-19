import React from 'react'

export default function MiniMap({ 
	data = [],
	className = ''
}) {
	// Placeholder data for now - will be replaced with real geo data
	const placeholderData = [
		{ iso2: 'IT', calls: 84, qualified: 19, color: 'bg-success' },
		{ iso2: 'US', calls: 156, qualified: 42, color: 'bg-brand-600' },
		{ iso2: 'DE', calls: 67, qualified: 15, color: 'bg-info' },
		{ iso2: 'FR', calls: 43, qualified: 12, color: 'bg-warn' },
		{ iso2: 'UK', calls: 38, qualified: 8, color: 'bg-ink-600' }
	]
	
	const maxCalls = Math.max(...placeholderData.map(d => d.calls))
	
	return (
		<div className={`panel ${className}`}>
			<div className="text-sm font-semibold text-ink-900 mb-4">Geographic Distribution</div>
			
			{/* Placeholder map visualization */}
			<div className="text-center py-8">
				<div className="text-4xl mb-2">🗺️</div>
				<div className="text-sm text-ink-600 mb-4">Map visualization coming soon</div>
				
				{/* Simple country list with heat indicators */}
				<div className="space-y-2">
					{placeholderData.map(country => {
						const intensity = maxCalls > 0 ? (country.calls / maxCalls) * 100 : 0
						
						return (
							<div key={country.iso2} className="flex items-center justify-between p-2 bg-bg-app rounded-lg">
								<div className="flex items-center gap-2">
									<div className={`w-3 h-3 rounded-full ${country.color}`}></div>
									<span className="text-sm font-medium text-ink-900">{country.iso2}</span>
								</div>
								<div className="flex items-center gap-3">
									<div className="text-xs text-ink-600">
										{country.calls} calls
									</div>
									<div className="text-xs text-ink-600">
										{country.qualified} qualified
									</div>
									<div className="w-16 bg-line rounded-full h-2">
										<div 
											className={`h-2 rounded-full ${country.color} transition-all duration-500`}
											style={{ width: `${intensity}%` }}
										></div>
									</div>
								</div>
							</div>
						)
					})}
				</div>
			</div>
			
			{/* Summary */}
			<div className="mt-4 pt-4 border-t border-line">
				<div className="text-xs text-ink-600">
					Top country: {placeholderData[0]?.iso2} ({placeholderData[0]?.calls} calls)
				</div>
			</div>
		</div>
	)
}
