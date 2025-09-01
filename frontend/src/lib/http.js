// frontend/src/lib/http.js
import axios from 'axios';

// Client HTTP con credenziali incluse per session cookies
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
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
      // Redirect al login se sessione scaduta
      window.location.href = '/login';
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
