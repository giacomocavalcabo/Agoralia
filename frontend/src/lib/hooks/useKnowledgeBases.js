import { apiFetch } from '../api.js';

/**
 * Fetch knowledge bases with search, pagination, and workspace filtering
 * 
 * @param {string} query - Search query
 * @param {number} page - Page number (1-based)
 * @param {AbortSignal} signal - AbortController signal for cancellation
 * @param {string} workspaceId - Required workspace ID for filtering
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function fetchKB(query = '', page = 1, signal, workspaceId) {
  // Prevent 422 errors by requiring workspace_id
  if (!workspaceId) {
    return { items: [], total: 0 };
  }
  
  const params = new URLSearchParams({ 
    q: query, 
    page: String(page),
    workspace_id: String(workspaceId)
  });
  
  try {
    const res = await apiFetch(`/kb?${params}`, { 
      method: 'GET',
      signal 
    });
    
    // Handle both array response and paginated response
    if (Array.isArray(res)) {
      return { items: res, total: res.length };
    }
    
    return { 
      items: res.results ?? res.items ?? [], 
      total: res.total ?? res.results?.length ?? res.items?.length ?? 0 
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    
    if (import.meta.env.DEV) {
      console.warn('fetchKB error:', error);
    }
    
    return { items: [], total: 0 };
  }
}

// Add displayName for demo mode detection
fetchKB.displayName = 'fetchKB';
