import { apiFetch } from '../api.js';

/**
 * Fetch phone numbers for caller ID selection
 * 
 * @param {string} query - Search query
 * @param {number} page - Page number (1-based)
 * @param {AbortSignal} signal - AbortController signal for cancellation
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function fetchNumbers(query = '', page = 1, signal) {
  const params = new URLSearchParams({ 
    q: query, 
    page: String(page) 
  });
  
  try {
    const res = await apiFetch(`/numbers?${params}`, { 
      method: 'GET',
      signal 
    });
    
    // Handle both array response and paginated response
    let items = [];
    if (Array.isArray(res)) {
      items = res;
    } else {
      items = res.numbers ?? res.items ?? [];
    }
    
    // Transform numbers to have consistent name/label for AsyncSelect
    const transformedItems = items.map(number => ({
      id: number.id ?? number.e164,
      name: number.e164,
      label: number.e164,
      ...number
    }));
    
    return { 
      items: transformedItems, 
      total: res.total ?? transformedItems.length 
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    
    // Gracefully handle non-existent endpoint
    if (import.meta.env.DEV) {
      console.warn('fetchNumbers error (endpoint may not exist):', error);
    }
    
    return { items: [], total: 0 };
  }
}

// Add displayName for demo mode detection
fetchNumbers.displayName = 'fetchNumbers';
