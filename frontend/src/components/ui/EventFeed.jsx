import React, { useState } from 'react'

export default function EventFeed({ 
	events = [],
	className = ''
}) {
	const [filter, setFilter] = useState('all')
	
	const eventTypes = [
		{ key: 'all', label: 'All', color: 'bg-ink-600' },
		{ key: 'error', label: 'Errors', color: 'bg-danger' },
		{ key: 'webhook', label: 'Webhooks', color: 'bg-info' },
		{ key: 'budget', label: 'Budget', color: 'bg-warn' }
	]
	
	const filteredEvents = filter === 'all' 
		? events 
		: events.filter(event => event.type === filter)
	
	const getEventIcon = (type) => {
		switch (type) {
			case 'error': return '⚠️'
			case 'webhook': return '🔗'
			case 'budget': return '💰'
			case 'call.created': return '📞'
			case 'call.finished': return '✅'
			default: return 'ℹ️'
		}
	}
	
	const getEventColor = (type) => {
		switch (type) {
			case 'error': return 'border-danger/30 bg-danger/5'
			case 'webhook': return 'border-info/30 bg-info/5'
			case 'budget': return 'border-warn/30 bg-warn/5'
			case 'call.created': return 'border-brand-600/30 bg-brand-600/5'
			case 'call.finished': return 'border-success/30 bg-success/5'
			default: return 'border-line bg-bg-app'
		}
	}
	
	const formatTime = (timestamp) => {
		const date = new Date(timestamp)
		return date.toLocaleTimeString('it-IT', { 
			hour: '2-digit', 
			minute: '2-digit',
			second: '2-digit'
		})
	}
	
	return (
		<div className={`panel ${className}`}>
			<div className="flex items-center justify-between mb-4">
				<div className="text-sm font-semibold text-ink-900">Event Feed</div>
				<div className="text-xs text-ink-500">{filteredEvents.length} events</div>
			</div>
			
			{/* Filter tabs */}
			<div className="flex gap-1 mb-4">
				{eventTypes.map(type => (
					<button
						key={type.key}
						onClick={() => setFilter(type.key)}
						className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
							filter === type.key 
								? `${type.color} text-white border-transparent` 
								: 'border-line bg-bg-app text-ink-600 hover:bg-bg-app/80'
						}`}
					>
						{type.label}
					</button>
				))}
			</div>
			
			{/* Events list */}
			<div className="space-y-2 max-h-64 overflow-y-auto">
				{filteredEvents.length === 0 ? (
					<div className="text-sm text-ink-500 text-center py-8">No events to show</div>
				) : (
					filteredEvents.map((event, index) => (
						<div 
							key={index} 
							className={`p-3 rounded-lg border ${getEventColor(event.type)} transition-all hover:scale-[1.02]`}
						>
							<div className="flex items-start gap-2">
								<span className="text-lg">{getEventIcon(event.type)}</span>
								<div className="flex-1 min-w-0">
									<div className="text-sm font-medium text-ink-900 truncate">
										{event.title || event.type || 'Unknown Event'}
									</div>
									{event.message && (
										<div className="text-xs text-ink-600 mt-1 line-clamp-2">
											{event.message}
										</div>
									)}
									<div className="flex items-center gap-2 mt-2 text-xs text-ink-500">
										<span>{formatTime(event.at || event.timestamp || Date.now())}</span>
										{event.agent && <span>• {event.agent}</span>}
										{event.cost_cents && <span>• €{(event.cost_cents / 100).toFixed(2)}</span>}
									</div>
								</div>
							</div>
						</div>
					))
				)}
			</div>
			
			{/* Summary */}
			{events.length > 0 && (
				<div className="mt-4 pt-4 border-t border-line">
					<div className="text-xs text-ink-600">
						Total events: {events.length} • Last updated: {formatTime(Date.now())}
					</div>
				</div>
			)}
		</div>
	)
}
