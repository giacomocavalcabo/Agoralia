// Semplificato: usa sempre VITE_API_BASE_URL se configurato, altrimenti default basato su window.location
function getBaseUrl() {
  // Se VITE_API_BASE_URL è configurato, usalo (priorità massima)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  // Se siamo su localhost, usa backend locale
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8000'
    }
    // Altrimenti (qualsiasi altro dominio, incluso Vercel preview e produzione), usa sempre api.agoralia.app
    return 'https://api.agoralia.app'
  }
  // Fallback se window non è disponibile (SSR, ma non dovrebbe succedere)
  return 'https://api.agoralia.app'
}

const BASE_URL = getBaseUrl()

export async function apiFetch(path, options = {}) {
  let url
  // Se path inizia con http, usalo direttamente
  if (path.startsWith('http')) {
    url = path
  } else {
    // Normalizza il path: aggiungi / se manca
    const normalizedPath = path.startsWith('/') ? path : '/' + path
    // Costruisci URL completo usando BASE_URL (sempre assoluto, mai relativo)
    const base = getBaseUrl() // Richiama getBaseUrl() per assicurarsi che sia aggiornato
    url = `${base}${normalizedPath}`
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
  // Usa lo stesso BASE_URL di apiFetch
  const apiBase = getBaseUrl()
  const wsBase = apiBase.replace(/^http/, 'ws').replace(/^https/, 'wss')
  const normalizedPath = path.startsWith('/') ? path : '/' + path
  return `${wsBase}${normalizedPath}${qp}`
}

// --- Normalized request helper (non-breaking: new API) ---
async function parseJsonSafe(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return { data: null, error: 'non_json_response' }
  try {
    const data = await response.json()
    return { data, error: null }
  } catch {
    return { data: null, error: 'invalid_json' }
  }
}

export async function apiRequest(path, options = {}) {
  const response = await apiFetch(path, options)
  if (response.status === 401) {
    // Notifica il sistema auth (AuthProvider ascolta questo evento)
    window.dispatchEvent(new CustomEvent('auth:logout'))
  }
  const { data, error } = await parseJsonSafe(response)
  if (!response.ok) {
    const errDetail = (data && (data.detail || data.message)) || error || `HTTP_${response.status}`
    return { ok: false, status: response.status, data: null, error: errDetail, headers: response.headers }
  }
  return { ok: true, status: response.status, data, error: null, headers: response.headers }
}


