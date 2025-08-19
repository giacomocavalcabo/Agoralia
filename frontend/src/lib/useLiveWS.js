import { useEffect, useRef, useState, useCallback } from 'react'

export default function useLiveWS(url = '/ws', fallbackInterval = 15000) {
	const [isConnected, setIsConnected] = useState(false)
	const [events, setEvents] = useState([])
	const [liveCalls, setLiveCalls] = useState([])
	const [costToday, setCostToday] = useState(0)
	const [errors24h, setErrors24h] = useState(0)
	const [lastUpdate, setLastUpdate] = useState(null)
	
	const wsRef = useRef(null)
	const fallbackTimerRef = useRef(null)
	const reconnectTimeoutRef = useRef(null)
	const eventQueue = useRef([])
	
	// Queue events (max 200)
	const addEvent = useCallback((event) => {
		eventQueue.current = [...eventQueue.current, event].slice(-200)
		setEvents(eventQueue.current)
	}, [])
	
	// Fallback polling function
	const fallbackPoll = useCallback(async () => {
		try {
			const [liveResponse, eventsResponse] = await Promise.all([
				fetch('/calls/live').then(r => r.json()).catch(() => ({ items: [] })),
				fetch('/events/recent?limit=20').then(r => r.json()).catch(() => ({ items: [] }))
			])
			
			setLiveCalls(liveResponse.items || [])
			setEvents(eventsResponse.items || [])
			setLastUpdate(new Date())
			
			// Extract cost and errors from events
			const today = new Date().toDateString()
			const todayEvents = eventsResponse.items?.filter(e => 
				new Date(e.at || e.timestamp).toDateString() === today
			) || []
			
			const totalCost = todayEvents.reduce((sum, e) => sum + (e.cost_cents || 0), 0)
			const totalErrors = todayEvents.filter(e => e.type === 'error').length
			
			setCostToday(totalCost)
			setErrors24h(totalErrors)
			
		} catch (error) {
			console.warn('Fallback polling failed:', error)
		}
	}, [])
	
	// WebSocket connection
	const connect = useCallback(() => {
		if (wsRef.current?.readyState === WebSocket.OPEN) return
		
		try {
			wsRef.current = new WebSocket(url)
			
			wsRef.current.onopen = () => {
				console.log('WebSocket connected')
				setIsConnected(true)
				// Clear fallback timer when WS connects
				if (fallbackTimerRef.current) {
					clearInterval(fallbackTimerRef.current)
					fallbackTimerRef.current = null
				}
			}
			
			wsRef.current.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data)
					
					switch (data.type) {
						case 'call.live':
							setLiveCalls(prev => {
								const existing = prev.find(c => c.id === data.call.id)
								if (existing) {
									return prev.map(c => c.id === data.call.id ? data.call : c)
								}
								return [...prev, data.call]
							})
							break
							
						case 'call.finished':
							setLiveCalls(prev => prev.filter(c => c.id !== data.call.id))
							addEvent({
								type: 'call.finished',
								title: 'Call Finished',
								message: `Call to ${data.call.lead_name || 'Lead'} completed`,
								at: data.call.finished_at,
								agent: data.call.agent_name,
								cost_cents: data.call.cost_cents
							})
							break
							
						case 'cost.update':
							setCostToday(data.cost_cents || 0)
							addEvent({
								type: 'budget',
								title: 'Cost Update',
								message: `Daily cost updated to €${(data.cost_cents / 100).toFixed(2)}`,
								at: new Date().toISOString()
							})
							break
							
						case 'error':
							setErrors24h(prev => prev + 1)
							addEvent({
								type: 'error',
								title: 'Error Occurred',
								message: data.message || 'An error occurred',
								at: new Date().toISOString()
							})
							break
							
						default:
							addEvent({
								type: data.type || 'info',
								title: data.title || 'Event',
								message: data.message || JSON.stringify(data),
								at: data.at || new Date().toISOString()
							})
					}
					
					setLastUpdate(new Date())
				} catch (error) {
					console.warn('Failed to parse WebSocket message:', error)
				}
			}
			
			wsRef.current.onclose = () => {
				console.log('WebSocket disconnected')
				setIsConnected(false)
				
				// Start fallback polling
				if (!fallbackTimerRef.current) {
					fallbackTimerRef.current = setInterval(fallbackPoll, fallbackInterval)
				}
				
				// Attempt reconnection
				reconnectTimeoutRef.current = setTimeout(connect, 5000)
			}
			
			wsRef.current.onerror = (error) => {
				console.error('WebSocket error:', error)
				setIsConnected(false)
			}
			
		} catch (error) {
			console.error('Failed to create WebSocket:', error)
			// Fallback to polling immediately
			if (!fallbackTimerRef.current) {
				fallbackTimerRef.current = setInterval(fallbackPoll, fallbackInterval)
			}
		}
	}, [url, fallbackInterval, fallbackPoll, addEvent])
	
	// Disconnect function
	const disconnect = useCallback(() => {
		if (wsRef.current) {
			wsRef.current.close()
			wsRef.current = null
		}
		if (fallbackTimerRef.current) {
			clearInterval(fallbackTimerRef.current)
			fallbackTimerRef.current = null
		}
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current)
			reconnectTimeoutRef.current = null
		}
	}, [])
	
	// Manual fallback trigger
	const triggerFallback = useCallback(() => {
		disconnect()
		fallbackPoll()
		if (!fallbackTimerRef.current) {
			fallbackTimerRef.current = setInterval(fallbackPoll, fallbackInterval)
		}
	}, [disconnect, fallbackPoll, fallbackInterval])
	
	// Initial connection
	useEffect(() => {
		connect()
		
		return () => {
			disconnect()
		}
	}, [connect, disconnect])
	
	// Initial fallback poll
	useEffect(() => {
		fallbackPoll()
	}, [fallbackPoll])
	
	return {
		isConnected,
		events,
		liveCalls,
		costToday,
		errors24h,
		lastUpdate,
		connect,
		disconnect,
		triggerFallback,
		pushFallback: addEvent
	}
}
