// frontend/src/lib/telephonyApi.js
import { http } from './http';

// Numbers management
export const listNumbers = () => http.get('/api/settings/telephony/numbers').then(r => r.data);
export const searchInventory = (params) => http.get('/api/settings/telephony/inventory/search', { params }).then(r => r.data);
export const purchaseNumber = (payload) =>
  http.post('/api/settings/telephony/numbers/purchase', payload, { 
    headers: { 'Idempotency-Key': crypto.randomUUID() }
  }).then(r => r.data);

export const purchaseRetellNumber = purchaseNumber; // Alias per compatibilità

export const importNumber = (payload) =>
  http.post('/api/settings/telephony/numbers/import', payload, { 
    headers: { 'Idempotency-Key': crypto.randomUUID() }
  }).then(r => r.data);

export const importNumberApi = importNumber; // Alias per compatibilità

export const bindNumber = (payload) => http.post('/api/settings/telephony/bind', payload).then(r => r.data);
export const setRouting = bindNumber; // Alias per compatibilità

// Stub per compatibilità (non più necessario con il nuovo sistema)
export const confirmImport = async () => ({ success: true });

// Provider management
export const listProviders = () => http.get('/api/settings/telephony/providers').then(r => r.data);
export const connectProvider = (payload) => http.post('/api/settings/telephony/providers', payload).then(r => r.data);
export const upsertProvider = connectProvider; // Alias per compatibilità

// Coverage and capabilities
export const getCoverage = () => http.get('/api/settings/telephony/coverage').then(r => r.data);
export const rebuildCoverage = () => http.post('/api/settings/telephony/coverage/rebuild').then(r => r.data);
export const getCountries = () => http.get('/api/settings/telephony/countries').then(r => r.data);
export const getCapabilities = () => http.get('/api/settings/telephony/capabilities').then(r => r.data);

// Billing and compliance
export const billingSummary = () => http.get('/api/settings/billing/summary').then(r => r.data);
export const complianceRequirements = (params) => http.get('/compliance/requirements', { params }).then(r => r.data);

// Orders
export const listOrders = () => http.get('/api/settings/telephony/orders').then(r => r.data);

// Agents for binding
export const listAgents = () => http.get('/api/settings/telephony/agents').then(r => r.data);

// CLI verification
export const verifyCli = (numberId) => 
  http.post('/api/settings/telephony/numbers/verify-cli', { number_id: numberId }).then(r => r.data);
