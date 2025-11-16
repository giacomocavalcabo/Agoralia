// Centralized endpoints map to avoid drift and duplication
export const endpoints = {
  health: '/health',
  auth: {
    me: '/auth/me',
    login: '/auth/login',
    register: '/auth/register',
    googleStart: '/auth/google/start',
    googleCallback: '/auth/google/callback',
  },
  billing: {
    usageMe: '/billing/me/usage',
    entitlements: '/billing/entitlements',
  },
  metrics: {
    daily: (days) => `/metrics/daily?days=${encodeURIComponent(days)}`,
    outcomes: (days) => `/metrics/outcomes?days=${encodeURIComponent(days)}`,
    accountConcurrency: '/metrics/account/concurrency',
    errors24h: '/metrics/errors/24h',
    costToday: '/metrics/cost/today',
    latencyP95: '/metrics/latency/p95',
  },
  calls: {
    live: '/calls/live',
    end: (id) => `/calls/${encodeURIComponent(id)}/end`,
    outboundRetell: '/calls/retell/outbound',
  },
  events: '/events',
  webhooks: {
    dlq: '/webhooks/dlq',
    dlqReplay: (id) => `/webhooks/dlq/${encodeURIComponent(id)}/replay`,
  },
  integrations: {
    googleCallback: '/integrations/google/auth/callback',
  },
  agents: '/agents',
  numbers: '/numbers',
  kbs: '/kbs',
  leads: '/leads',
}


