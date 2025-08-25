import { useCallback } from 'react';

/**
 * Hook per gestire errori API in modo robusto
 * Gestisce errori 405, 404, 500 e altri errori comuni
 */
export function useApiErrorHandler() {
  const handleApiError = useCallback((error, context = '') => {
    if (!error) return;
    
    console.error(`[API Error] ${context}:`, error);
    
    // Gestione specifica per errori HTTP
    if (error.status === 405) {
      console.error('[API 405] Method Not Allowed - verifica metodo HTTP e endpoint');
      return {
        type: 'method_not_allowed',
        message: 'Metodo HTTP non supportato per questo endpoint',
        suggestion: 'Verifica se stai usando GET/POST corretto'
      };
    }
    
    if (error.status === 404) {
      console.error('[API 404] Endpoint non trovato - verifica URL e proxy');
      return {
        type: 'not_found',
        message: 'Endpoint non trovato',
        suggestion: 'Verifica configurazione proxy Vercel e URL backend'
      };
    }
    
    if (error.status >= 500) {
      console.error('[API 5xx] Errore server - riprova più tardi');
      return {
        type: 'server_error',
        message: 'Errore del server, riprova più tardi',
        suggestion: 'Verifica log Railway e stato backend'
      };
    }
    
    // Errore generico
    return {
      type: 'unknown',
      message: error.message || 'Errore sconosciuto',
      suggestion: 'Controlla console per dettagli'
    };
  }, []);
  
  return { handleApiError };
}

/**
 * Utility per testare endpoint API
 */
export async function testApiEndpoint(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { success: true, data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      status: error.status || 'unknown',
      suggestion: 'Verifica URL, proxy e stato backend'
    };
  }
}
