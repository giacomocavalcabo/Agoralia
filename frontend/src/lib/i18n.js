// Robust i18n loader using Vite's import.meta.glob (build-time bundling)
// No runtime fetch → no broken paths in production

// Load ALL json files via Vite (build-time) without fetch
const files = import.meta.glob('../locales/*/*.json', { eager: true });

// Build resources object: { en: {common: {...}, auth: {...}}, it: {...} }
export const resources = {};

for (const path in files) {
  const [, locale, nsFile] = path.match(/locales\/([^/]+)\/([^/]+)\.json$/) || [];
  if (!locale || !nsFile) continue;
  
  resources[locale] ||= {};
  resources[locale][nsFile] = files[path].default;
}

// Fallback chain: locale → base → en
export function getFallbackChain(locale) {
  const base = locale.split('-')[0];
  return [locale, base, 'en'].filter((l, i, arr) => arr.indexOf(l) === i);
}

// Get translation with fallback chain
export function getTranslation(
  key, 
  locale, 
  namespaces = ['common']
) {
  const fallbacks = getFallbackChain(locale);
  
  for (const fallbackLocale of fallbacks) {
    if (!resources[fallbackLocale]) continue;
    
    for (const ns of namespaces) {
      const nsData = resources[fallbackLocale][ns];
      if (!nsData) continue;
      
      const parts = key.split('.');
      let value = nsData;
      
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      
      if (value !== undefined) {
        return value;
      }
    }
  }
  
  return null;
}

// Interpolation helper
export function interpolate(text, params = {}) {
  return text.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
}

// RTL detection
export function isRtl(locale) {
  return locale.startsWith('ar') || locale.startsWith('he') || locale.startsWith('fa');
}

// Format helpers using Intl
export const fmt = {
  number: (n, locale) => new Intl.NumberFormat(locale).format(n),
  date: (d, locale) => new Intl.DateTimeFormat(locale).format(d),
  currency: (amount, locale, currency = 'USD') => 
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
};
