import { useEffect, useState } from 'react';

/**
 * Debounce hook that delays updating the returned value until after delay has passed
 * since the last time the value changed.
 * 
 * @param {any} value - The value to debounce
 * @param {number} delay - The delay in milliseconds (default: 400)
 * @returns {any} The debounced value
 */
export function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  
  useEffect(() => { 
    const id = setTimeout(() => setDebounced(value), delay); 
    return () => clearTimeout(id); 
  }, [value, delay]);
  
  return debounced;
}
