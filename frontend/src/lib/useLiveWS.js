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
	const failCount = useRef(0)
	const maxFailures = 3
	
	// WebSocket URL configurabile con fallback
	const wsUrl = import.meta.env.VITE_WS_URL || url
	
	// Queue events (max 200)
	const addEvent = useCallback((event) => {
		eventQueue.current = [...eventQueue.current, event].slice(-200)
		setEvents(eventQueue.current)
	}, [])
	
	// Fallback polling function
	const fallbackPoll = useCallback(async () => {
		try {
			const [liveResponse, eventsResponse] = await Promise.all([
				fetch('/calls/live', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ items: [] })),
				fetch('/events/recent?limit=20', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ items: [] }))
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
	
	// Start fallback polling
	const startPolling = useCallback(() => {
		if (fallbackTimerRef.current) return
		
		console.log('Starting fallback polling')
		fallbackPoll() // Immediate poll
		fallbackTimerRef.current = setInterval(fallbackPoll, fallbackInterval)
	}, [fallbackPoll, fallbackInterval])
	
	// WebSocket connection with exponential backoff
	const connect = useCallback(() => {
		if (wsRef.current?.readyState === WebSocket.OPEN) return
		
		// Se non c'è URL WebSocket configurato, usa fallback
		if (!wsUrl) {
			console.log('WebSocket URL not configured, using fallback polling')
			startPolling()
			return
		}
		
		try {
			wsRef.current = new WebSocket(wsUrl)
			
			wsRef.current.onopen = () => {
				console.log('WebSocket connected')
				setIsConnected(true)
				failCount.current = 0 // Reset failure count
				
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
				
				failCount.current++
				
				// Start fallback polling after 3 failures
				if (failCount.current >= maxFailures) {
					console.log('Max failures reached, starting fallback polling')
					startPolling()
				} else {
					// Exponential backoff: 1s, 2s, 4s, 8s, 15s max
					const backoffDelay = Math.min(15000, 1000 * Math.pow(2, failCount.current - 1))
					console.log(`Reconnecting in ${backoffDelay}ms (attempt ${failCount.current})`)
					
					reconnectTimeoutRef.current = setTimeout(connect, backoffDelay)
				}
			}
			
			wsRef.current.onerror = (error) => {
				console.error('WebSocket error:', error)
				setIsConnected(false)
			}
			
		} catch (error) {
			console.error('Failed to create WebSocket:', error)
			failCount.current++
			
			// Fallback to polling immediately on creation failure
			if (failCount.current >= maxFailures) {
				startPolling()
			} else {
				reconnectTimeoutRef.current = setTimeout(connect, 1000)
			}
		}
	}, [url, startPolling])
	
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
		startPolling()
	}, [disconnect, startPolling])
	
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
		pushFallback: addEvent,
		failCount: failCount.current
	}
}
