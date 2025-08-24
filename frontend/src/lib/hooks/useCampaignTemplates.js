import { apiFetch } from '../api.js';

/**
 * Fetch campaign templates with search and pagination
 * 
 * @param {string} query - Search query
 * @param {number} page - Page number (1-based)
 * @param {AbortSignal} signal - AbortController signal for cancellation
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function fetchTemplates(query = '', page = 1, signal) {
  const params = new URLSearchParams({ 
    q: query, 
    page: String(page) 
  });
  
  try {
    const res = await apiFetch(`/templates?${params}`, { 
      method: 'GET',
      signal 
    });
    
    // Handle both array response and paginated response
    if (Array.isArray(res)) {
      return { items: res, total: res.length };
    }
    
    return { 
      items: res.templates ?? res.items ?? [], 
      total: res.total ?? res.templates?.length ?? res.items?.length ?? 0 
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    
    if (import.meta.env.DEV) {
      console.warn('fetchTemplates error:', error);
    }
    
    return { items: [], total: 0 };
  }
}

// Add displayName for demo mode detection
fetchTemplates.displayName = 'fetchTemplates';
