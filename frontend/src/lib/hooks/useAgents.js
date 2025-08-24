import { apiFetch } from '../api.js';

/**
 * Fetch agents with search and pagination
 * This is a stub implementation as the agents endpoint may not exist yet
 * 
 * @param {string} query - Search query
 * @param {number} page - Page number (1-based)
 * @param {AbortSignal} signal - AbortController signal for cancellation
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function fetchAgents(query = '', page = 1, signal) {
  const params = new URLSearchParams({ 
    q: query, 
    page: String(page) 
  });
  
  try {
    const res = await apiFetch(`/agents?${params}`, { 
      method: 'GET',
      signal 
    });
    
    // Handle both array response and paginated response
    if (Array.isArray(res)) {
      return { items: res, total: res.length };
    }
    
    return { 
      items: res.agents ?? res.items ?? [], 
      total: res.total ?? res.agents?.length ?? res.items?.length ?? 0 
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    
    // Gracefully handle non-existent endpoint
    if (import.meta.env.DEV) {
      console.warn('fetchAgents error (endpoint may not exist):', error);
    }
    
    return { items: [], total: 0 };
  }
}

// Add displayName for demo mode detection
fetchAgents.displayName = 'fetchAgents';
