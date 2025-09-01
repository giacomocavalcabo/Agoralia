// frontend/src/lib/http.js
import axios from 'axios';

// Client HTTP con credenziali incluse per session cookies
function normalizeBaseURL(url) {
  if (!url) return '/api';
  // Se è assoluta (http/https), togli solo lo slash finale
  if (/^https?:\/\//i.test(url)) return url.replace(/\/+$/, '');
  // Altrimenti forza uno slash iniziale e rimuovi doppi slash finali
  return '/' + url.replace(/^\/+/, '').replace(/\/+$/, '');
}

const baseURL = normalizeBaseURL(import.meta.env.VITE_API_BASE_URL);

// Log in sviluppo per debug
if (import.meta.env.DEV) {
  console.log('[http] Base URL:', baseURL);
  console.log('[http] VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
}

export const http = axios.create({
  baseURL,
  withCredentials: true, // IMPORTANTISSIMO per session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor per gestire errori di autenticazione
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Evita loop di redirect
      if (window.location.pathname !== '/login') {
        // Svuota cache utente e sessione
        try {
          localStorage.removeItem('user');
          sessionStorage.clear();
        } catch (e) {
          console.warn('Failed to clear user cache:', e);
        }
        
        // Redirect al login (una sola volta)
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper per chiamate API con gestione errori
export const apiCall = async (method, url, data = null, config = {}) => {
  try {
    const response = await http({
      method,
      url,
      data,
      ...config,
    });
    return response.data;
  } catch (error) {
    console.error(`API call failed: ${method} ${url}`, error);
    throw error;
  }
};

// Esporta metodi convenienza
export const api = {
  get: (url, config) => apiCall('GET', url, null, config),
  post: (url, data, config) => apiCall('POST', url, data, config),
  put: (url, data, config) => apiCall('PUT', url, data, config),
  patch: (url, data, config) => apiCall('PATCH', url, data, config),
  delete: (url, config) => apiCall('DELETE', url, null, config),
};
