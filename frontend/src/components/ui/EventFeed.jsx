import React, { useState } from 'react'

export default function EventFeed({ 
	events = [],
	className = ''
}) {
	const [filter, setFilter] = useState('all')
	
	const eventTypes = [
		{ key: 'all', label: 'All', color: 'bg-gray-600' },
		{ key: 'error', label: 'Errors', color: 'bg-red-600' },
		{ key: 'webhook', label: 'Webhooks', color: 'bg-blue-600' },
		{ key: 'budget', label: 'Budget', color: 'bg-amber-600' }
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
			case 'error': return 'border-red-200 bg-red-50'
			case 'webhook': return 'border-blue-200 bg-blue-50'
			case 'budget': return 'border-amber-200 bg-amber-50'
			case 'call.created': return 'border-teal-200 bg-teal-50'
			case 'call.finished': return 'border-green-200 bg-green-50'
			default: return 'border-gray-200 bg-gray-50'
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
		<div className={`rounded-xl border border-gray-200 bg-white shadow-sm p-4 md:p-6 ${className}`}>
			<div className="flex items-center justify-between mb-4">
				<div className="text-sm font-semibold text-gray-900">Event Feed</div>
				<div className="text-xs text-gray-500">{filteredEvents.length} events</div>
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
						: 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
						}`}
					>
						{type.label}
					</button>
				))}
			</div>
			
			{/* Events list */}
			<div className="space-y-2 max-h-[280px] overflow-y-auto pr-2">
				{filteredEvents.length === 0 ? (
					<div className="text-sm text-gray-500 text-center py-8">No events to show</div>
				) : (
					filteredEvents.map((event, index) => (
						<div 
							key={index} 
							className={`p-3 rounded-lg border ${getEventColor(event.type)} transition-all hover:scale-[1.02]`}
						>
							<div className="flex items-start gap-2">
								<span className="text-lg">{getEventIcon(event.type)}</span>
								<div className="flex-1 min-w-0">
									<div className="text-sm font-medium text-gray-900 truncate">
										{event.title || event.type || 'Unknown Event'}
									</div>
									{event.message && (
										<div className="text-xs text-gray-600 mt-1 line-clamp-2">
											{event.message}
										</div>
									)}
									<div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
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
				<div className="mt-4 pt-4 border-t border-gray-200">
					<div className="text-xs text-gray-600">
						Total events: {events.length} • Last updated: {formatTime(Date.now())}
					</div>
				</div>
			)}
		</div>
	)
}
