// frontend/src/lib/numbersApi.js
import { apiFetch } from './api'

export async function listNumbers(params = {}) {
  return apiFetch('/settings/telephony/numbers', { method: 'GET', params })
}

export async function purchaseRetellNumber(body) {
  // country, type, area_code?
  return apiFetch('/settings/telephony/retell/purchase', { method: 'POST', body })
}

export async function importNumber(body) {
  // { provider: 'twilio'|'telnyx'|'zadarma', e164: '+1...' }
  return apiFetch('/settings/telephony/import', { method: 'POST', body })
}

export async function confirmImport(body) {
  // { token|code, request_id? }
  return apiFetch('/numbers/byo/confirm', { method: 'POST', body })
}

export async function setRouting(numberId, body) {
  // { inbound_agent_id?, outbound_agent_id? }
  return apiFetch(`/settings/telephony/bind`, { method: 'POST', body: { number_id: numberId, ...body } })
}

export const listAgents = () => apiFetch("/settings/telephony/agents");

export const bindNumber = (body) =>
  apiFetch("/settings/telephony/bind", {
    method: "POST",
    body: JSON.stringify(body),
  });
