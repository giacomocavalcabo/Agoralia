// frontend/src/lib/telephonyApi.js
import { http } from './http';

// Numbers management
export const listNumbers = () => http.get('/settings/telephony/numbers').then(r => r.data);
export const searchInventory = (params) => http.get('/settings/telephony/inventory/search', { params }).then(r => r.data);
export const purchaseNumber = (payload) =>
  http.post('/settings/telephony/numbers/purchase', payload, { 
    headers: { 'Idempotency-Key': crypto.randomUUID() }
  }).then(r => r.data);

export const purchaseRetellNumber = purchaseNumber; // Alias per compatibilità

export const importNumber = (payload) =>
  http.post('/settings/telephony/numbers/import', payload, { 
    headers: { 'Idempotency-Key': crypto.randomUUID() }
  }).then(r => r.data);

export const importNumberApi = importNumber; // Alias per compatibilità

export const bindNumber = (payload) => http.post('/settings/telephony/bind', payload).then(r => r.data);
export const setRouting = bindNumber; // Alias per compatibilità

// Stub per compatibilità (non più necessario con il nuovo sistema)
export const confirmImport = async () => ({ success: true });

// Provider management
export const listProviders = () => http.get('/settings/telephony/providers').then(r => r.data);
export const connectProvider = (payload) => http.post('/settings/telephony/providers', payload).then(r => r.data);
export const upsertProvider = connectProvider; // Alias per compatibilità

// Coverage and capabilities
export const getCoverage = () => http.get('/settings/telephony/coverage').then(r => r.data);
export const rebuildCoverage = () => http.post('/settings/telephony/coverage/rebuild').then(r => r.data);
export const getCountries = () => http.get('/settings/telephony/countries').then(r => r.data);
export const getCapabilities = () => http.get('/settings/telephony/capabilities').then(r => r.data);

// Billing and compliance
export const billingSummary = () => http.get('/settings/billing/summary').then(r => r.data);
export const complianceRequirements = (params) => http.get('/compliance/requirements', { params }).then(r => r.data);

// Orders
export const listOrders = () => http.get('/settings/telephony/orders').then(r => r.data);

// Agents for binding
export const listAgents = () => http.get('/settings/telephony/agents').then(r => r.data);
