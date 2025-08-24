/**
 * useLiveCalls: hook per gestire chiamate live con gating forte
 * - Si connette solo se autenticato e non in demo
 * - Usa WebSocket se disponibile, fallback a polling
 * - Genera dati demo coerenti se in demo mode
 */

import { useEffect, useMemo, useState } from 'react';
import { useIsDemo } from './useDemoData.js';
import { createRealtimeClient } from './realtime.js';
import { useAuth } from './useAuth.jsx';

export function useLiveCalls() {
  const isDemo = useIsDemo();
  const { user } = useAuth?.() ?? { user: null };

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(isDemo ? 'idle' : 'connecting'); // idle|connecting|ok|error
  const canRealtime = !!user?.id && !isDemo && !!import.meta.env.VITE_WS_URL?.startsWith?.('wss://');

  // Demo data se necessario
  const demoData = useMemo(() => {
    if (!isDemo) return null;
    
    // Genera dati demo coerenti
    const calls = [];
    const directions = ['inbound', 'outbound'];
    const statuses = ['ringing', 'active', 'connecting'];
    const agents = ['Alice Johnson', 'Marco Rossi', 'Sarah Chen', 'David Miller'];
    const queues = ['Sales', 'Support', 'Billing', 'General'];
    
    for (let i = 1; i <= 5; i++) {
      const startTime = new Date(Date.now() - Math.random() * 300000); // 0-5 minuti fa
      const duration = Math.floor(Math.random() * 300); // 0-5 minuti
      
      calls.push({
        id: `demo_call_${i}`,
        from: `+39${String(300000000 + i).slice(0, 9)}`,
        to: `+39${String(300000000 + i + 100).slice(0, 9)}`,
        direction: directions[i % directions.length],
        status: statuses[i % statuses.length],
        agent_name: agents[i % agents.length],
        queue_name: queues[i % queues.length],
        started_at: startTime.toISOString(),
        duration_seconds: duration,
        lead_name: `Demo Lead ${i}`,
        cost_cents: Math.floor(Math.random() * 50) + 10, // €0.10-0.60
        recording_url: i % 3 === 0 ? `https://example.com/recording_${i}.mp3` : null,
        notes: i % 2 === 0 ? `Demo call note ${i}` : null
      });
    }
    
    return calls;
  }, [isDemo]);

  // Carica dati demo
  useEffect(() => {
    if (isDemo && demoData) {
      setItems(demoData);
      setStatus('ok');
    }
  }, [isDemo, demoData]);

  // Primo caricamento via REST (se non demo)
  useEffect(() => {
    let abort = new AbortController();
    if (!user?.id || isDemo) return setStatus('idle');
    
    setStatus('connecting');
    
    fetch('/calls/live', { 
      signal: abort.signal,
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const list = data?.items ?? [];
        setItems(list);
        setStatus('ok');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setStatus('error');
          if (import.meta.env.DEV) {
            console.warn('[useLiveCalls] Fetch failed:', error);
          }
        }
      });
      
    return () => abort.abort();
  }, [user?.id, isDemo]);

  // Realtime enrich
  useEffect(() => {
    if (!canRealtime) return;
    
    const rt = createRealtimeClient({ user, isDemo });
    
    const unsub1 = rt.subscribe('call.live', (msg) => {
      setItems((prev) => {
        const incoming = Array.isArray(msg) ? msg : [msg];
        const merged = [...incoming, ...prev].slice(0, 20);
        return merged;
      });
      setStatus('ok');
    });
    
    const unsub2 = rt.subscribe('call.ended', (msg) => {
      setItems((prev) => prev.filter(c => c.id !== msg?.id));
    });
    
    const unsub3 = rt.subscribe('connection', (status) => {
      if (status.status === 'connected') {
        setStatus('ok');
      } else if (status.status === 'disconnected') {
        setStatus('connecting');
      }
    });
    
    return () => { 
      unsub1(); 
      unsub2(); 
      unsub3(); 
      rt.close(); 
    };
  }, [canRealtime, user?.id, isDemo]);

  // Formatta durate in modo sicuro
  const rows = useMemo(() => items.map((c) => ({
    ...c,
    duration_h: formatDurationSafe(c?.duration_seconds),
  })), [items]);

  return { 
    status, 
    items: rows,
    isDemo,
    canRealtime,
    total: items.length
  };
}

// Utility per formattazione sicura
function formatDurationSafe(seconds) {
  try {
    const s = Number(seconds || 0);
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${String(ss).padStart(2, '0')}`;
  } catch {
    return '0:00';
  }
}

export default useLiveCalls;
