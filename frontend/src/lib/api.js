export const API_BASE_URL = import.meta.env.DEV 
  ? '/api'  // Usa proxy in dev
  : '/api';  // Usa proxy anche in produzione (vercel.json)

function normalizeUrl(url) {
  // Forza tutto a passare dal proxy /api
  if (/^https?:\/\/api\.agoralia\.app\//.test(url)) {
    return url.replace(/^https?:\/\/api\.agoralia\.app/, '');
  }
  return url;
}

function assertApiPrefix(url) {
  try {
    // absolute => ignore (CSP will handle)
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return;
    const p = u.pathname;

    const allow = [
      /^\/$/, /^\/(login|logout|settings)(\/|$)/,
      /^\/(_next|assets|static|favicon|locales|manifest\.webmanifest|sw\.js)(\/|$)/,
    ];

    if (!p.startsWith('/api/') && !allow.some(rx => rx.test(p))) {
      console.warn('[API WARNING] missing /api prefix:', p);
    }
  } catch {}
}

export async function apiFetch(path, options = {}) {
	// Se il path inizia già con /api/, non aggiungere API_BASE_URL
	// Se il path inizia con /api/, rimuovi il prefisso /api/ e aggiungi API_BASE_URL
	let fullPath;
	if (path.startsWith('/api/')) {
		// Path già completo, usalo così
		fullPath = path;
	} else {
		// Path relativo, aggiungi API_BASE_URL
		fullPath = `${API_BASE_URL}${path}`;
	}
	
	// Aggiungi workspace_id automaticamente se disponibile
	const auth = JSON.parse(localStorage.getItem('auth') || '{}');
	const workspaceId = auth?.user?.workspace_id;
	if (workspaceId && !fullPath.includes('workspace_id=')) {
		const separator = fullPath.includes('?') ? '&' : '?';
		fullPath = `${fullPath}${separator}workspace_id=${workspaceId}`;
	}
	
	const url = normalizeUrl(fullPath);
	assertApiPrefix(url);
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
		
		// Non reindirizzare per richieste OPTIONS o endpoint /auth/*
		const method = options.method || 'GET';
		const isPreflight = method.toUpperCase() === 'OPTIONS';
		const rawUrl = resp.url || '';
		const base = '/api';
		let apiPath = '';
		try { 
			apiPath = new URL(rawUrl, base).pathname; 
		} catch {}
		const isAuthEndpoint = apiPath.startsWith('/auth/');
		const alreadyOnLogin = window.location.pathname === '/login';
		
		// Redirect automatico a /login se non è una richiesta speciale
		if (!isPreflight && !isAuthEndpoint && !alreadyOnLogin) {
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


