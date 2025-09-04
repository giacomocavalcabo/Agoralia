import { apiFetch } from './api.js';

export async function fetchMetricsOverview({ days=30, campaignId, agentId, lang, country } = {}) {
  const params = new URLSearchParams();
  params.set("days", String(days));
  if (campaignId) params.set("campaign_id", campaignId);
  if (agentId) params.set("agent_id", agentId);
  if (lang) params.set("lang", lang);
  if (country) params.set("country", country);

  try {
    return await apiFetch(`/metrics/overview?${params.toString()}`);
  } catch (error) {
    throw new Error(error?.message || 'Metrics error');
  }
}
