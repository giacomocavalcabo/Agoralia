export async function fetchMetricsOverview({ days=30, campaignId, agentId, lang, country } = {}) {
  const params = new URLSearchParams();
  params.set("days", String(days));
  if (campaignId) params.set("campaign_id", campaignId);
  if (agentId) params.set("agent_id", agentId);
  if (lang) params.set("lang", lang);
  if (country) params.set("country", country);

  const res = await fetch(`/api/metrics/overview?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err?.detail?.message || `Metrics error ${res.status}`);
  }
  return res.json();
}
