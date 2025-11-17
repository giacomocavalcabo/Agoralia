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
    // Handle both absolute URLs (https://api.agoralia.app) and relative paths (/api)
    let wsUrl: string
    if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
      // Absolute URL - convert to WebSocket
      const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws'
      const wsBaseUrl = API_BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
      wsUrl = `${wsProtocol}://${wsBaseUrl}/ws?tenant_id=${tenantId}`
    } else {
      // Relative URL (e.g., /api) - use current origin
      // On production (app.agoralia.app), /api is proxied to https://api.agoralia.app
      // So we need to use wss://api.agoralia.app/ws directly
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      if (window.location.hostname === 'app.agoralia.app' || window.location.hostname.endsWith('.vercel.app')) {
        // Production: use api.agoralia.app directly
        wsUrl = `wss://api.agoralia.app/ws?tenant_id=${tenantId}`
      } else {
        // Development: use current host
        const host = window.location.host
        const apiPath = API_BASE_URL.startsWith('/') ? API_BASE_URL : `/${API_BASE_URL}`
        wsUrl = `${wsProtocol}://${host}${apiPath}/ws?tenant_id=${tenantId}`
      }
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

