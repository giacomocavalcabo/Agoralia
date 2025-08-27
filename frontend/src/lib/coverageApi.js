// frontend/src/lib/coverageApi.js
import { apiFetch } from "./api";

export const fetchCountries = (provider) =>
  apiFetch(`/settings/telephony/countries?provider=${provider}`);

export const fetchCapabilities = (provider, country) =>
  apiFetch(`/settings/telephony/capabilities?provider=${provider}&country=${country}`);

export const fetchTwilioPricing = (origin, destination) =>
  apiFetch(`/settings/telephony/pricing/twilio?origin=${origin}&destination=${destination}`);
