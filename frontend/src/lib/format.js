/**
 * Utility di formattazione sicura per evitare RangeError
 * - Gestisce valori null/undefined/NaN
 * - Fallback a valori sicuri
 * - Supporta locale personalizzato
 */

export function formatDateSafe(v, locale = navigator.language) {
  try {
    if (!v) return '—';
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(locale, { 
      dateStyle: 'medium', 
      timeStyle: 'short' 
    }).format(d);
  } catch { 
    return '—'; 
  }
}

export function formatNumberSafe(v, locale = navigator.language) {
  try { 
    const num = Number(v || 0);
    if (!isFinite(num)) return '—';
    return new Intl.NumberFormat(locale).format(num); 
  } catch { 
    return String(v ?? '—'); 
  }
}

export function formatDurationSafe(seconds) {
  try {
    const s = Number(seconds || 0);
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${String(ss).padStart(2, '0')}`;
  } catch {
    return '0:00';
  }
}

export function formatCurrencySafe(amount, locale = navigator.language, currency = 'EUR') {
  try {
    const num = Number(amount || 0);
    if (!isFinite(num)) return '—';
    return new Intl.NumberFormat(locale, { 
      style: 'currency', 
      currency 
    }).format(num);
  } catch {
    return '—';
  }
}

export function formatPhoneSafe(phone, locale = navigator.language) {
  try {
    if (!phone) return '—';
    // Rimuovi spazi e caratteri non numerici
    const clean = String(phone).replace(/[^\d+]/g, '');
    if (!clean) return '—';
    return clean;
  } catch {
    return '—';
  }
}

export function formatPercentageSafe(value, locale = navigator.language) {
  try {
    const num = Number(value || 0);
    if (!isFinite(num)) return '—';
    return new Intl.NumberFormat(locale, { 
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(num / 100);
  } catch {
    return '—';
  }
}
