/**
 * RealtimeClient: lightweight event-bus + ws client con backoff e gating
 * - Si connette solo se autenticato, non in demo, e ha VITE_WS_URL valido
 * - Fallback automatico a polling se WS fallisce
 * - Gestione errori robusta e reconnection con backoff
 */

export function createRealtimeClient({ user, isDemo }) {
  const wsUrl = import.meta.env.VITE_WS_URL; // deve essere wss://...
  const canOpen = !!user?.id && !isDemo && !!wsUrl && wsUrl.startsWith('wss://');

  let ws = null;
  let listeners = new Map(); // type -> Set<fn>
  let closed = false;
  let retries = 0;
  let pollingTimer = null;
  let isPolling = false;

  const notify = (type, payload) => {
    const fns = listeners.get(type);
    if (fns) for (const fn of fns) try { fn(payload); } catch {}
  };

  // Polling fallback per events
  const startPolling = () => {
    if (isPolling || !user?.id || isDemo) return;
    
    isPolling = true;
    if (import.meta.env.DEV) {
      console.log('[Realtime] Starting fallback polling for events');
    }
    
    const poll = async () => {
      if (closed) return;
      
      try {
        const response = await fetch('/events/recent?limit=20', { 
          cache: 'no-store',
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data?.items?.length > 0) {
            notify('events.recent', data.items);
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[Realtime] Polling failed:', error);
        }
      }
      
      if (!closed) {
        pollingTimer = setTimeout(poll, 8000 + Math.random() * 4000); // 8-12s
      }
    };
    
    poll(); // immediate poll
  };

  const stopPolling = () => {
    if (pollingTimer) {
      clearTimeout(pollingTimer);
      pollingTimer = null;
    }
    isPolling = false;
  };

  const connect = () => {
    if (!canOpen || closed) return;
    
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => { 
        retries = 0; 
        stopPolling();
        notify('connection', { status: 'connected' });
        if (import.meta.env.DEV) {
          console.log('[Realtime] WebSocket connected');
        }
      };
      
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          // atteso: { type, ts, payload }
          if (msg?.type) {
            notify(msg.type, msg.payload || msg);
            notify('update', { timestamp: msg.ts || new Date().toISOString(), data: msg });
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('[Realtime] Failed to parse message:', error);
          }
        }
      };
      
      ws.onclose = () => {
        if (closed) return;
        
        notify('connection', { status: 'disconnected' });
        if (import.meta.env.DEV) {
          console.log('[Realtime] WebSocket disconnected');
        }
        
        retries = Math.min(retries + 1, 5);
        const backoff = [1000, 2000, 4000, 8000, 15000][retries - 1] || 15000;
        
        if (retries >= 3) {
          // Dopo 3 tentativi, passa a polling
          if (import.meta.env.DEV) {
            console.log('[Realtime] Max retries reached, switching to polling');
          }
          startPolling();
        } else {
          setTimeout(connect, backoff);
        }
      };
      
      ws.onerror = () => {
        if (import.meta.env.DEV) {
          console.warn('[Realtime] WebSocket error');
        }
        ws?.close();
      };
      
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[Realtime] Failed to create WebSocket:', error);
      }
      // Fallback immediato a polling
      startPolling();
    }
  };

  // Avvia connessione se possibile
  if (canOpen) {
    connect();
  } else if (import.meta.env.DEV) {
    console.info('[Realtime] Disabled (auth/demo/url)');
  }

  return {
    canOpen,
    isPolling: () => isPolling,
    subscribe(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type)?.delete(fn);
    },
    close() { 
      closed = true; 
      stopPolling();
      try { ws?.close(); } catch {} 
    },
    // Trigger manuale polling (per testing)
    triggerPolling() {
      if (ws?.readyState === WebSocket.OPEN) return;
      startPolling();
    }
  };
}
