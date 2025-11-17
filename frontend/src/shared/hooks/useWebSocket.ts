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
    const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws'
    const wsBaseUrl = API_BASE_URL.replace(/^https?:\/\//, '').replace(/\/api$/, '')
    const wsUrl = `${wsProtocol}://${wsBaseUrl}/api/ws?tenant_id=${tenantId}`

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

