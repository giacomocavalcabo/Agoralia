import { useDemoData } from './useDemoData.js';
import { makeLeads, makeDashboardSummary, makeCampaigns, makeNumbers, makeKnowledgeBase } from './demo/fakes.js';

// Mappa semplice path ⇒ generatore demo
function demoFor(path, params) {
  if (path.startsWith('/leads')) return { total: 150, data: makeLeads({ total: 150 }) };
  if (path.startsWith('/dashboard/summary')) return makeDashboardSummary({});
  if (path.startsWith('/campaigns')) return makeCampaigns({ total: 12 });
  if (path.startsWith('/settings/telephony/numbers')) return makeNumbers({ total: 25 });
  if (path.startsWith('/knowledge')) return makeKnowledgeBase({ total: 8 });
  return null; // default: niente demo
}

export function useApiWithDemo(base = import.meta.env.VITE_API_BASE_URL || '/api') {
  const isDemo = useDemoData();
  
  async function get(path, init) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, { credentials: 'include', ...init });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      // Solo in demo: se endpoint non c'è / errori 401/404/422 ⇒ finti dati
      if (isDemo) {
        const fake = demoFor(path);
        if (fake) {
          if (import.meta.env.DEV) {
            console.log(`[demo] Fallback to fake data for ${path}:`, fake);
          }
          return fake;
        }
      }
      throw err;
    }
  }
  
  async function post(path, data, init) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, { 
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...init?.headers },
        body: JSON.stringify(data),
        ...init 
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      // Solo in demo: simula successo per operazioni POST
      if (isDemo) {
        if (import.meta.env.DEV) {
          console.log(`[demo] Simulating POST success for ${path}`);
        }
        return { success: true, id: `demo-${Date.now()}`, __demo: true };
      }
      throw err;
    }
  }
  
  async function put(path, data, init) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, { 
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...init?.headers },
        body: JSON.stringify(data),
        ...init 
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      // Solo in demo: simula successo per operazioni PUT
      if (isDemo) {
        if (import.meta.env.DEV) {
          console.log(`[demo] Simulating PUT success for ${path}`);
        }
        return { success: true, __demo: true };
      }
      throw err;
    }
  }
  
  async function del(path, init) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, { 
        method: 'DELETE',
        credentials: 'include',
        ...init 
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      // Solo in demo: simula successo per operazioni DELETE
      if (isDemo) {
        if (import.meta.env.DEV) {
          console.log(`[demo] Simulating DELETE success for ${path}`);
        }
        return { success: true, __demo: true };
      }
      throw err;
    }
  }
  
  return { get, post, put, del, isDemo };
}

// Hook semplificato per componenti che vogliono solo sapere se sono in demo
export const useIsDemo = useDemoData;
