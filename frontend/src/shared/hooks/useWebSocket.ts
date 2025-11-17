import { useEffect, useRef, useState } from 'react'
import { getTenantId, getAuthToken } from '@/shared/api/client'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://api.agoralia.app'

export interface WebSocketMessage {
  type: string
  data: any
}

export interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  enabled?: boolean
}

export function useWebSocket({ onMessage, onOpen, onClose, onError, enabled = true }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const tenantId = getTenantId()
    if (!tenantId) {
      return
    }

    // Build WebSocket URL
    // In production (app.agoralia.app), always use wss://api.agoralia.app/ws
    // In development, use API_BASE_URL to determine WebSocket URL
    let wsUrl: string
    
    // Check if we're in production
    const isProduction = window.location.hostname === 'app.agoralia.app' || 
                        window.location.hostname.endsWith('.vercel.app') ||
                        window.location.hostname.includes('agoralia.app')
    
    if (isProduction) {
      // Production: always use api.agoralia.app directly with WSS
      wsUrl = `wss://api.agoralia.app/ws?tenant_id=${tenantId}`
    } else if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
      // Development with absolute URL - convert to WebSocket
      const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws'
      const wsBaseUrl = API_BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
      wsUrl = `${wsProtocol}://${wsBaseUrl}/ws?tenant_id=${tenantId}`
    } else {
      // Development with relative URL (e.g., /api) - use current origin
      // But if we're on HTTPS, we must use WSS
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const host = window.location.host
      const apiPath = API_BASE_URL.startsWith('/') ? API_BASE_URL : `/${API_BASE_URL}`
      wsUrl = `${wsProtocol}://${host}${apiPath}/ws?tenant_id=${tenantId}`
    }
    
    // Safety check: if we're on HTTPS but URL is ws://, force wss://
    if (window.location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
      wsUrl = wsUrl.replace('ws://', 'wss://')
    }

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          setIsConnected(true)
          reconnectAttempts.current = 0
          onOpen?.()
        }

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            onMessage?.(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          onError?.(error)
        }

        ws.onclose = () => {
          setIsConnected(false)
          onClose?.()

          // Reconnect with exponential backoff
          if (enabled && reconnectAttempts.current < 5) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
            reconnectAttempts.current++
            reconnectTimeoutRef.current = setTimeout(() => {
              connect()
            }, delay)
          }
        }
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error)
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled, onMessage, onOpen, onClose, onError])

  return { isConnected }
}

