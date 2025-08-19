import { parsePhoneNumber, isValidPhoneNumber, AsYouType } from 'libphonenumber-js'

/**
 * Normalize phone number to E.164 format
 * @param {string} phone - Raw phone number
 * @param {string} defaultCountry - Default country code (e.g., 'IT')
 * @returns {object} { e164: string, isValid: boolean, country: string, type: string }
 */
export function normalizePhoneNumber(phone, defaultCountry = 'IT') {
  if (!phone || typeof phone !== 'string') {
    return { e164: null, isValid: false, country: null, type: null }
  }

  // Clean the input
  let cleanPhone = phone.trim()
  
  // Handle common prefixes
  if (cleanPhone.startsWith('0039')) {
    cleanPhone = '+' + cleanPhone.substring(2)
  } else if (cleanPhone.startsWith('39') && !cleanPhone.startsWith('+39')) {
    cleanPhone = '+' + cleanPhone
  } else if (cleanPhone.startsWith('0') && defaultCountry === 'IT') {
    // Italian numbers starting with 0
    cleanPhone = '+39' + cleanPhone.substring(1)
  }

  try {
    const phoneNumber = parsePhoneNumber(cleanPhone, defaultCountry)
    
    if (phoneNumber && phoneNumber.isValid()) {
      return {
        e164: phoneNumber.format('E.164'),
        isValid: true,
        country: phoneNumber.country,
        type: phoneNumber.getType(),
        national: phoneNumber.formatNational(),
        international: phoneNumber.formatInternational()
      }
    }
  } catch (error) {
    console.warn('Phone parsing error:', error)
  }

  return { e164: null, isValid: false, country: null, type: null }
}

/**
 * Format phone number as you type
 * @param {string} phone - Raw phone number
 * @param {string} defaultCountry - Default country code
 * @returns {string} Formatted phone number
 */
export function formatAsYouType(phone, defaultCountry = 'IT') {
  const formatter = new AsYouType(defaultCountry)
  return formatter.input(phone)
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @param {string} defaultCountry - Default country code
 * @returns {boolean} Is valid phone number
 */
export function validatePhoneNumber(phone, defaultCountry = 'IT') {
  if (!phone) return false
  
  try {
    return isValidPhoneNumber(phone, defaultCountry)
  } catch {
    return false
  }
}

/**
 * Extract country code from phone number
 * @param {string} phone - Phone number
 * @returns {string|null} Country code or null
 */
export function extractCountryCode(phone) {
  if (!phone) return null
  
  try {
    const phoneNumber = parsePhoneNumber(phone)
    return phoneNumber?.country || null
  } catch {
    return null
  }
}

/**
 * Convert phone number to different formats
 * @param {string} phone - E.164 phone number
 * @param {string} format - Desired format ('E.164', 'NATIONAL', 'INTERNATIONAL')
 * @returns {string|null} Formatted phone number
 */
export function formatPhoneNumber(phone, format = 'E.164') {
  if (!phone) return null
  
  try {
    const phoneNumber = parsePhoneNumber(phone)
    if (phoneNumber && phoneNumber.isValid()) {
      switch (format) {
        case 'E.164':
          return phoneNumber.format('E.164')
        case 'NATIONAL':
          return phoneNumber.formatNational()
        case 'INTERNATIONAL':
          return phoneNumber.formatInternational()
        default:
          return phoneNumber.format('E.164')
      }
    }
  } catch (error) {
    console.warn('Phone formatting error:', error)
  }
  
  return null
}
