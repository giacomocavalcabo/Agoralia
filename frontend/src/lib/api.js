const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export async function apiFetch(path, options = {}) {
  let url
  // Se path inizia con http, usalo direttamente
  if (path.startsWith('http')) {
    url = path
  } else {
    // Normalizza il path: aggiungi / se manca
    const normalizedPath = path.startsWith('/') ? path : '/' + path
    
    // Se BASE_URL è impostato (production), usa direttamente il backend
    // Altrimenti usa /api come prefisso per il rewrite di Vercel
    if (BASE_URL && BASE_URL !== 'http://127.0.0.1:8000' && !BASE_URL.includes('localhost')) {
      // Production: usa BASE_URL direttamente (es. https://api.agoralia.app)
      url = `${BASE_URL}${normalizedPath}`
    } else {
      // Development o Vercel: usa /api come prefisso per il rewrite
      url = `/api${normalizedPath}`
    }
  }
  
  const headers = new Headers(options.headers || {})
  const tenantId = localStorage.getItem('tenant_id')
  if (tenantId) headers.set('X-Tenant-Id', tenantId)
  const token = localStorage.getItem('auth_token')
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  // If body is object and no content-type set, assume JSON
  let body = options.body
  if (body && typeof body === 'object' && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }
  const resp = await fetch(url, { ...options, headers, body })
  // Intercept paywall errors globally for POST requests
  if ((options.method || 'GET').toUpperCase() !== 'GET' && (resp.status === 402 || resp.status === 403)) {
    try {
      const detail = await resp.clone().json()
      window.dispatchEvent(new CustomEvent('paywall:show', { detail: { message: detail?.detail || `Error ${resp.status}` } }))
    } catch {
      window.dispatchEvent(new CustomEvent('paywall:show', { detail: { message: `Error ${resp.status}` } }))
    }
  }
  return resp
}

export function wsUrl(path) {
  const tenantId = localStorage.getItem('tenant_id')
  const qp = tenantId ? (path.includes('?') ? `&tenant_id=${tenantId}` : `?tenant_id=${tenantId}`) : ''
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
  
  // Se siamo in production con BASE_URL configurato, usa direttamente
  if (apiBase && apiBase !== 'http://127.0.0.1:8000' && !apiBase.includes('localhost')) {
    const wsBase = apiBase.replace(/^http/, 'ws').replace(/^https/, 'wss')
    const normalizedPath = path.startsWith('/') ? path : '/' + path
    return `${wsBase}${normalizedPath}${qp}`
  } else {
    // Development o Vercel: usa /api come prefisso per il rewrite
    const normalizedPath = path.startsWith('/') ? path : '/' + path
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/api${normalizedPath}${qp}`
  }
}


