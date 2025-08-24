export const API_BASE_URL = import.meta.env.DEV 
  ? '/api'  // Usa proxy in dev
  : (import.meta.env.VITE_API_BASE_URL || 'https://service-1-production.up.railway.app');

export async function apiFetch(path, options = {}) {
	const url = `${API_BASE_URL}${path}`;
	const resp = await fetch(url, {
		method: options.method || 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(options.headers || {}),
			...(localStorage.getItem('impersonate_token') ? { 'X-Impersonate-Token': localStorage.getItem('impersonate_token') } : {}),
			...(localStorage.getItem('csrf_token') ? { 'X-CSRF-Token': localStorage.getItem('csrf_token') } : {}),
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
		credentials: 'include',
	});
	
	// Gestione specifica per 401 (non autenticato)
	if (resp.status === 401) {
		if (import.meta.env.DEV) {
			console.info('[API] 401 Not authenticated');
		}
		// Redirect automatico a /login se non siamo già lì
		if (window.location.pathname !== '/login') {
			window.location.replace('/login');
		}
		throw new Error('unauthenticated');
	}
	
	if (!resp.ok) {
		const text = await resp.text().catch(() => '');
		throw new Error(`http_${resp.status}: ${text || resp.statusText}`);
	}
	
	const contentType = resp.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		return resp.json();
	}
	return resp.text();
}

// Compatible API object for components
export const api = {
	get: (path) => apiFetch(path, { method: 'GET' }),
	post: (path, data) => apiFetch(path, { method: 'POST', body: data }),
	put: (path, data) => apiFetch(path, { method: 'PUT', body: data }),
	patch: (path, data) => apiFetch(path, { method: 'PATCH', body: data }),
	delete: (path) => apiFetch(path, { method: 'DELETE' }),
};

export function wsUrl(path) {
  const tenantId = localStorage.getItem('tenant_id')
  const qp = tenantId ? (path.includes('?') ? `&tenant_id=${tenantId}` : `?tenant_id=${tenantId}`) : ''
  return `ws://127.0.0.1:8000${path}${qp}`
}


