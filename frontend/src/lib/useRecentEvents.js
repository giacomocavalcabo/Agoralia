/**
 * useRecentEvents: hook per gestire eventi recenti con polling fallback
 * - Usa WebSocket se disponibile, altrimenti polling ogni 8-12s
 * - Gating forte: non fa nulla se non autenticato o in demo
 * - Genera dati demo coerenti se in demo mode
 */

import { useEffect, useState, useMemo } from 'react';
import { useIsDemo } from './useDemoData.js';
import { createRealtimeClient } from './realtime.js';
import { useAuth } from './useAuth.jsx';

export function useRecentEvents() {
  const isDemo = useIsDemo();
  const { user } = useAuth?.() ?? { user: null };

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(isDemo ? 'idle' : 'connecting'); // idle|connecting|ok|error
  const canRealtime = !!user?.id && !isDemo && !!import.meta.env.VITE_WS_URL?.startsWith?.('wss://');

  // Demo data se necessario
  const demoData = useMemo(() => {
    if (!isDemo) return null;
    
    // Genera eventi demo coerenti
    const events = [];
    const eventTypes = [
      'call.started', 'call.ended', 'call.answered', 'call.missed',
      'agent.joined', 'agent.left', 'queue.overflow', 'cost.update',
      'campaign.started', 'campaign.paused', 'lead.qualified', 'lead.lost'
    ];
    const agents = ['Alice Johnson', 'Marco Rossi', 'Sarah Chen', 'David Miller'];
    const campaigns = ['Summer Campaign', 'Launch Campaign', 'Retarget Campaign'];
    
    for (let i = 1; i <= 20; i++) {
      const eventTime = new Date(Date.now() - Math.random() * 86400000); // 0-24 ore fa
      const eventType = eventTypes[i % eventTypes.length];
      
      let title, message, cost_cents = 0;
      
      switch (eventType) {
        case 'call.started':
          title = 'Call Started';
          message = `Outbound call to +39${String(300000000 + i).slice(0, 9)}`;
          cost_cents = Math.floor(Math.random() * 30) + 5;
          break;
        case 'call.ended':
          title = 'Call Ended';
          message = `Call completed with duration ${Math.floor(Math.random() * 300)}s`;
          cost_cents = Math.floor(Math.random() * 20) + 3;
          break;
        case 'call.answered':
          title = 'Call Answered';
          message = `Call answered by ${agents[i % agents.length]}`;
          break;
        case 'call.missed':
          title = 'Call Missed';
          message = `Missed call from +39${String(300000000 + i).slice(0, 9)}`;
          break;
        case 'agent.joined':
          title = 'Agent Joined';
          message = `${agents[i % agents.length]} joined the queue`;
          break;
        case 'agent.left':
          title = 'Agent Left';
          message = `${agents[i % agents.length]} left the queue`;
          break;
        case 'queue.overflow':
          title = 'Queue Overflow';
          message = 'Queue capacity exceeded, calls routed to overflow';
          break;
        case 'cost.update':
          title = 'Cost Update';
          message = `Daily cost updated to €${(Math.random() * 50 + 20).toFixed(2)}`;
          cost_cents = Math.floor(Math.random() * 1000) + 500;
          break;
        case 'campaign.started':
          title = 'Campaign Started';
          message = `${campaigns[i % campaigns.length]} campaign activated`;
          break;
        case 'campaign.paused':
          title = 'Campaign Paused';
          message = `${campaigns[i % campaigns.length]} campaign paused`;
          break;
        case 'lead.qualified':
          title = 'Lead Qualified';
          message = `Lead ${i} marked as qualified`;
          break;
        case 'lead.lost':
          title = 'Lead Lost';
          message = `Lead ${i} marked as lost`;
          break;
        default:
          title = 'Event';
          message = `Demo event ${i}`;
      }
      
      events.push({
        id: `demo_event_${i}`,
        type: eventType,
        title,
        message,
        at: eventTime.toISOString(),
        agent: eventType.includes('agent') ? agents[i % agents.length] : null,
        cost_cents,
        metadata: {
          campaign: eventType.includes('campaign') ? campaigns[i % campaigns.length] : null,
          duration: eventType.includes('call') ? Math.floor(Math.random() * 300) : null,
          phone: eventType.includes('call') ? `+39${String(300000000 + i).slice(0, 9)}` : null
        }
      });
    }
    
    // Ordina per timestamp (più recenti prima)
    return events.sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [isDemo]);

  // Carica dati demo
  useEffect(() => {
    if (isDemo && demoData) {
      setItems(demoData);
      setStatus('ok');
    }
  }, [isDemo, demoData]);

  // Polling fallback (WS off o preview)
  useEffect(() => {
    if (!user?.id || isDemo) return setStatus('idle');
    
    let stop = false;
    let timer = null;

    const tick = async () => {
      if (stop) return;
      
      try {
        const response = await fetch('/api/events/recent?limit=20', {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
          headers: {
            // Authorization header rimosso - ora usa session cookies
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setItems(data?.items ?? []);
          setStatus('ok');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setStatus('error');
          if (import.meta.env.DEV) {
            console.warn('[useRecentEvents] Polling failed:', error);
          }
        }
      }
      
      if (!stop) {
        timer = setTimeout(tick, 10000); // 10s
      }
    };

    if (!canRealtime) {
      tick(); // immediate poll
    }
    
    return () => { 
      stop = true; 
      if (timer) clearTimeout(timer); 
    };
  }, [user?.id, isDemo, canRealtime]);

  // Realtime se disponibile
  useEffect(() => {
    if (!canRealtime) return;
    
    const rt = createRealtimeClient({ user, isDemo });
    
    const unsub1 = rt.subscribe('event', (msg) => {
      setItems((prev) => [msg, ...prev].slice(0, 25));
      setStatus('ok');
    });
    
    const unsub2 = rt.subscribe('events.recent', (newEvents) => {
      if (Array.isArray(newEvents)) {
        setItems(newEvents);
        setStatus('ok');
      }
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

  return { 
    status, 
    items,
    isDemo,
    canRealtime,
    total: items.length
  };
}

export default useRecentEvents;
