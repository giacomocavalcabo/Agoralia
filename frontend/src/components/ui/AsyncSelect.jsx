import { useEffect, useRef, useState } from 'react';
import { useDebounced } from '../../lib/hooks/useDebounced';
import { useDemoData } from '../../lib/useDemoData';
import { demo } from '../../lib/demo/fakes';

/**
 * AsyncSelect component with server-side search, debouncing, and proper loading states
 * Supports demo mode with fallback data
 * 
 * Props:
 * - fetcher: async (query, page, signal) => { items:[{id,label|name}], total }
 * - value: selected value ID
 * - onChange: (value) => void
 * - placeholder: placeholder text
 * - ariaLabel: accessibility label
 * - disabled: whether the select is disabled
 */
export default function AsyncSelect({ 
  fetcher, 
  value, 
  onChange, 
  placeholder = "Search...", 
  ariaLabel, 
  disabled = false 
}) {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 400);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isDemo = useDemoData();
  const abortRef = useRef(null);

  useEffect(() => {
    let active = true;
    
    (async () => {
      setLoading(true); 
      setError('');
      
      // Cancel previous request
      abortRef.current?.abort(); 
      abortRef.current = new AbortController();
      
      try {
        let data;
        
        // Demo mode fallbacks based on fetcher function name
        if (isDemo) {
          switch (fetcher.displayName) {
            case 'fetchKB':
              data = { items: demo.knowledgeBases(), total: 6 };
              break;
            case 'fetchTemplates':
              data = { items: demo.templates(), total: 6 };
              break;
            case 'fetchAgents':
              data = { items: demo.agents(), total: 8 };
              break;
            case 'fetchNumbers':
              data = { items: demo.numbers(), total: 5 };
              break;
            default:
              data = { items: [], total: 0 };
          }
          
          // Filter by query in demo mode
          if (debounced) {
            data.items = data.items.filter(item => 
              (item.name || item.label || '').toLowerCase().includes(debounced.toLowerCase())
            );
            data.total = data.items.length;
          }
        } else {
          // Real API call
          data = await fetcher(debounced, 1, abortRef.current.signal);
        }
        
        if (!active) return;
        setItems(data.items ?? []);
      } catch (e) {
        if (!active || e.name === 'AbortError') return;
        if (import.meta.env.DEV) {
          console.warn('AsyncSelect fetch error:', e);
        }
        setError('error');
      } finally { 
        if (active) setLoading(false); 
      }
    })();
    
    return () => { 
      active = false; 
      abortRef.current?.abort(); 
    };
  }, [debounced, isDemo, fetcher]);

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-describedby={error ? `${ariaLabel}-error` : undefined}
      />
      
      <select
        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value || null)}
        disabled={disabled}
        aria-live="polite"
        aria-label={ariaLabel}
      >
        <option value="">
          {loading ? 'Loading…' : placeholder}
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name || item.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p 
          id={`${ariaLabel}-error`}
          className="mt-1 text-xs text-red-600"
          role="alert"
        >
          Something went wrong
        </p>
      )}
      
      {!loading && !error && items.length === 0 && debounced && (
        <p className="mt-1 text-xs text-gray-500">
          No results
        </p>
      )}
    </div>
  );
}
