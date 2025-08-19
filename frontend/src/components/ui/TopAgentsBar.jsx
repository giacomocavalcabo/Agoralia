import React from 'react'

export default function TopAgentsBar({ 
	agents = [],
	className = ''
}) {
	// Sort agents by qualified rate
	const sortedAgents = [...agents].sort((a, b) => (b.qualified_rate || 0) - (a.qualified_rate || 0))
	
	const maxQualifiedRate = Math.max(...sortedAgents.map(a => a.qualified_rate || 0))
	
	return (
		<div className={`panel ${className}`}>
			<div className="text-sm font-semibold text-ink-900 mb-4">Top Agents</div>
			
			{agents.length === 0 ? (
				<div className="text-sm text-ink-500 text-center py-8">No agent data available</div>
			) : (
				<div className="space-y-3">
					{sortedAgents.slice(0, 10).map((agent, index) => {
						const qualifiedRate = agent.qualified_rate || 0
						const barWidth = maxQualifiedRate > 0 ? (qualifiedRate / maxQualifiedRate) * 100 : 0
						
						return (
							<div key={agent.id} className="relative">
								{/* Agent info */}
								<div className="flex items-center justify-between mb-1">
									<div className="flex items-center gap-2">
										{index < 3 && (
											<span className={`text-xs font-bold ${
												index === 0 ? 'text-warn' : 
												index === 1 ? 'text-ink-600' : 
												'text-brand-600'
											}`}>
												#{index + 1}
											</span>
										)}
										<span className="text-sm font-medium text-ink-900 truncate max-w-24">
											{agent.name || `Agent ${agent.id}`}
										</span>
									</div>
									<div className="text-sm text-ink-600">
										{Math.round(qualifiedRate * 100)}%
									</div>
								</div>
								
								{/* Progress bar */}
								<div className="w-full bg-line rounded-full h-2">
									<div 
										className={`h-2 rounded-full bg-success transition-all duration-500 ease-out`}
										style={{ width: `${barWidth}%` }}
									></div>
								</div>
								
								{/* Additional metrics */}
								<div className="flex items-center gap-4 mt-1 text-xs text-ink-500">
									<span>{agent.calls || 0} calls</span>
									<span>{Math.round((agent.avg_duration_sec || 0) / 60)}m avg</span>
								</div>
							</div>
						)
					})}
				</div>
			)}
			
			{/* Summary */}
			{agents.length > 0 && (
				<div className="mt-4 pt-4 border-t border-line">
					<div className="text-xs text-ink-600">
						Top performer: {sortedAgents[0]?.name || 'N/A'} ({Math.round((sortedAgents[0]?.qualified_rate || 0) * 100)}%)
					</div>
				</div>
			)}
		</div>
	)
}
