import { useState, useEffect, useRef } from 'react'

// WebSocket URL configurabile con fallback
const WS_URL = import.meta.env.VITE_WS_URL || '';

export function useWebSocket() {
  const [status, setStatus] = useState('disconnected')
  const [data, setData] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const attemptsRef = useRef(0)
  
  const connect = () => {
    // Se non c'è URL WebSocket configurato, usa fallback
    if (!WS_URL) {
      setStatus('fallback')
      return
    }
    
    try {
      wsRef.current = new WebSocket(WS_URL)
      
      wsRef.current.onopen = () => {
        setStatus('connected')
        attemptsRef.current = 0
        console.log('WebSocket connected')
      }
      
      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          setData(message)
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error)
        }
      }
      
      wsRef.current.onclose = () => {
        setStatus('disconnected')
        console.log('WebSocket disconnected')
        
        // Exponential backoff retry
        if (attemptsRef.current < 5) {
          const delay = Math.min(15000, 1000 * Math.pow(2, attemptsRef.current))
          attemptsRef.current++
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`WebSocket reconnecting (attempt ${attemptsRef.current})...`)
            connect()
          }, delay)
        } else {
          console.log('WebSocket max retry attempts reached, switching to fallback')
          setStatus('fallback')
        }
      }
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setStatus('error')
      }
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      setStatus('fallback')
    }
  }
  
  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }
  
  const send = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }
  
  useEffect(() => {
    connect()
    
    return () => {
      disconnect()
    }
  }, [])
  
  return {
    status,
    data,
    send,
    connect,
    disconnect
  }
}

// Hook per fallback polling quando WebSocket non è disponibile
export function useFallbackPolling(enabled = false, interval = 5000) {
  const [data, setData] = useState(null)
  const intervalRef = useRef(null)
  
  useEffect(() => {
    if (!enabled) return
    
    const poll = async () => {
      try {
        // Fallback API call (es. per aggiornamenti dashboard)
        const response = await fetch('/api/dashboard/updates')
        if (response.ok) {
          const updates = await response.json()
          setData(updates)
        }
      } catch (error) {
        console.warn('Fallback polling failed:', error)
      }
    }
    
    // Poll immediatamente
    poll()
    
    // Poi ogni X secondi
    intervalRef.current = setInterval(poll, interval)
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, interval])
  
  return { data }
}
