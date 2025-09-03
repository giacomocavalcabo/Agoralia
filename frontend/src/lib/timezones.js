// Lista delle timezone IANA supportate con placeholder per traduzioni
export const timezoneKeys = [
  'UTC',
  // Europe
  'Europe/London', 'Europe/Dublin', 'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Europe/Lisbon', 'Europe/Athens',
  'Europe/Prague', 'Europe/Warsaw', 'Europe/Budapest', 'Europe/Vienna', 'Europe/Zurich',
  'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Helsinki',
  'Europe/Moscow', 'Europe/Kiev', 'Europe/Istanbul',
  // America
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'America/Honolulu', 'America/Toronto', 'America/Vancouver',
  'America/Mexico_City', 'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Lima',
  'America/Bogota', 'America/Caracas', 'America/Santiago',
  // Asia
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore',
  'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Manila', 'Asia/Kolkata', 'Asia/Karachi',
  'Asia/Dubai', 'Asia/Tehran', 'Asia/Jerusalem', 'Asia/Riyadh', 'Asia/Kuwait',
  'Asia/Bahrain', 'Asia/Qatar', 'Asia/Muscat',
  // Africa
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Casablanca',
  'Africa/Nairobi', 'Africa/Addis_Ababa', 'Africa/Tunis', 'Africa/Algiers',
  // Australia/Oceania
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Adelaide',
  'Australia/Darwin', 'Australia/Brisbane', 'Pacific/Auckland', 'Pacific/Fiji',
  'Pacific/Honolulu', 'Pacific/Guam', 'Pacific/Samoa'
];

// Funzione per ottenere le timezone con traduzioni usando placeholder
export function getTimezonesWithTranslations(t) {
  return timezoneKeys.map(tz => {
    // Converte timezone IANA in placeholder (es: Europe/Rome -> account.timezones.europe.rome)
    const placeholder = `account.timezones.${tz.toLowerCase().replace('/', '.')}`;
    
    return {
      value: tz,
      label: t(placeholder, { defaultValue: tz })
    };
  });
}

// Per compatibilità con il codice esistente
export const timezones = timezoneKeys;
export default timezones;