export function allTimezones() {
  if (Intl.supportedValuesOf) {
    try { 
      return Intl.supportedValuesOf('timeZone'); 
    } catch {}
  }
  // fallback breve e ordinato (aggiungi ciò che ti serve)
  return [
    'UTC','Europe/Rome','Europe/Paris','Europe/Berlin','Europe/Madrid',
    'Europe/London','America/New_York','America/Los_Angeles',
    'Asia/Tokyo','Asia/Dubai','Asia/Kolkata','Australia/Sydney'
  ];
}

export const timezones = allTimezones();

export default timezones;
