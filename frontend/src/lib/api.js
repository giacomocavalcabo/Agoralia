const BASE_URL = 'http://127.0.0.1:8000'

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`
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
  return `ws://127.0.0.1:8000${path}${qp}`
}


