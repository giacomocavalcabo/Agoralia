// Robust i18n loader using Vite's import.meta.glob (lazy per locale)
// No runtime fetch → no broken paths in production

const loaders = import.meta.glob('../locales/*/*.json', { import: 'default' });

const cache = {}; // { 'it-IT': { common: {...}, admin: {...} }, ... }

function pathParts(p) {
  // ../locales/it-IT/common.json -> { locale:'it-IT', ns:'common' }
  const segs = p.split('/');
  const locale = segs[segs.length - 2];
  const ns = segs[segs.length - 1].replace('.json', '');
  return { locale, ns };
}

export async function loadLocale(locale) {
  if (cache[locale]) return cache[locale];
  
  const entries = Object.entries(loaders).filter(([p]) => p.includes(`/locales/${locale}/`));
  if (!entries.length) {
    console.warn(`[i18n] Locale ${locale} not found, using empty dict`);
    return (cache[locale] = {}); // locale non trovato
  }

  const pairs = await Promise.all(
    entries.map(async ([p, importer]) => {
      try {
        const mod = await importer();
        const { ns } = pathParts(p);
        return [ns, mod];
      } catch (error) {
        console.error(`[i18n] Failed to load ${p}:`, error);
        return [pathParts(p).ns, {}];
      }
    })
  );
  
  const dict = Object.fromEntries(pairs);
  cache[locale] = dict;
  console.log(`[i18n] Loaded locale ${locale}:`, Object.keys(dict));
  return dict;
}

export function getDict(locale, ns = 'common') {
  return cache[locale]?.[ns] ?? null;
}

export function knownLocales() {
  // deduci i locali disponibili dal glob (una volta)
  const set = new Set();
  Object.keys(loaders).forEach((p) => {
    const segs = p.split('/');
    set.add(segs[segs.length - 2]);
  });
  return Array.from(set);
}

// Fallback chain helper
export function getFallbackChain(locale) {
  const base = locale.split('-')[0];
  return [locale, base, 'en-US'].filter((l, i, arr) => arr.indexOf(l) === i);
}

// Interpolation helper
export function interpolate(text, params = {}) {
  return text.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
}

// RTL detection
export function isRtl(locale) {
  return /^ar|^fa|^he/.test(locale);
}

// Format helpers using Intl
export const fmt = {
  number: (n, locale) => new Intl.NumberFormat(locale).format(n),
  date: (d, locale, opts) => new Intl.DateTimeFormat(locale, opts).format(d),
  currency: (amount, locale, currency = 'USD') => 
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
};
