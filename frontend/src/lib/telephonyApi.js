// frontend/src/lib/telephonyApi.js
import { apiFetch } from "./api";

export async function getCoverage(provider) {
  const r = await fetch(`/api/settings/telephony/coverage?provider=${provider}`);
  if (!r.ok) throw new Error(`coverage_${r.status}`);
  return r.json();
}

export async function searchInventoryTwilio({ country, type, areaCode, contains }) {
  const qs = new URLSearchParams({
    provider: 'twilio',
    country,
    number_type: type,
  });
  if (areaCode) qs.set('area_code', areaCode);
  if (contains) qs.set('contains', contains);
  
  const r = await fetch(`/api/settings/telephony/inventory/search?${qs}`);
  if (!r.ok) throw new Error(`inv_${r.status}`);
  return r.json();
}

export async function rebuildTwilioSnapshot() {
  const r = await fetch('/api/settings/telephony/coverage/rebuild?provider=twilio', {
    method: 'POST',
    headers: { 
      'X-Cron-Secret': import.meta.env.VITE_CRON_SECRET ?? '' // opzionale, solo in local
    },
  });
  if (!r.ok) throw new Error(`rebuild_${r.status}`);
  return r.json();
}

// Compliance API
export const getComplianceRequirements = (q) =>
  apiFetch(`/api/settings/telephony/compliance/requirements?provider=${q.provider}&country=${q.country}&number_type=${q.number_type}&entity_type=${q.entity_type}`);

export const createComplianceSubmission = (body) =>
  apiFetch('/api/settings/telephony/compliance/submissions', { method:'POST', body: JSON.stringify(body) });

export const uploadComplianceFile = (subId, kind, file) => {
  const fd = new FormData(); 
  fd.append('kind', kind); 
  fd.append('f', file);
  return apiFetch(`/api/settings/telephony/compliance/submissions/${subId}/files`, { method:'POST', body: fd });
};

// Portability API
export const checkPortability = (provider, country, type) =>
  apiFetch(`/api/settings/telephony/portability?provider=${provider}&country=${country}&number_type=${type}`);

// Mantieni compatibilità con l'API esistente
export { 
  listProviders, 
  upsertProvider, 
  purchaseNumber, 
  importNumberApi, 
  listOrders 
} from './numbersApi';
