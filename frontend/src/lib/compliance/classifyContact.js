/**
 * Contact classification engine for compliance
 */

// Import the hook for dynamic rules loading
import { getRuleV1, RULES_V1_DEFAULT } from './useCountryRulesV1'

/**
 * Classify a contact based on country rules and contact attributes
 * @param {Object} contact - Contact data
 * @param {Object} countryRules - Country-specific rules
 * @returns {Object} Classification result with verdict and reasons
 */
export function classifyContact(contact, countryRules) {
  const reasons = []
  
  // B2B contacts
  if (contact.contact_class === 'b2b') {
    if (countryRules.requires_consent_b2b && contact.existing !== true) {
      return { 
        verdict: 'blocked', 
        reasons: ['B2B consent required but no existing relationship documented'] 
      }
    }
    return { 
      verdict: 'allowed', 
      reasons: ['B2B contact - allowed by default'] 
    }
  }
  
  // Unknown contact class is conditional
  if (contact.contact_class !== 'b2c') {
    return { 
      verdict: 'conditional', 
      reasons: ['Contact class is unknown - requires manual review'] 
    }
  }
  
  // B2C contacts
  if (countryRules.requires_consent_b2c) {
    if (contact.opt_in === true) {
      return { 
        verdict: 'allowed', 
        reasons: ['B2C contact with documented opt-in consent'] 
      }
    }
    if (contact.opt_in === false) {
      return { 
        verdict: 'blocked', 
        reasons: ['B2C opt-in required but consent not given'] 
      }
    }
    return { 
      verdict: 'conditional', 
      reasons: ['B2C opt-in required but status unknown'] 
    }
  }
  
  // Check DNC if required
  if (countryRules.requires_dnc_scrub) {
    if (contact.national_dnc === 'in') {
      return { 
        verdict: 'blocked', 
        reasons: ['Contact is registered in national Do Not Call registry'] 
      }
    }
    if (contact.national_dnc === 'not_in') {
      return { 
        verdict: 'allowed', 
        reasons: ['B2C contact not in DNC registry'] 
      }
    }
    return { 
      verdict: 'conditional', 
      reasons: ['DNC registry exists but status unknown - requires verification'] 
    }
  }
  
  // Default: allowed for unspecified countries
  return { 
    verdict: 'allowed', 
    reasons: ['No specific restrictions apply'] 
  }
}

/**
 * Get country rules for a given ISO code using v1 rules
 * @param {string} countryISO - Country ISO code (e.g., 'IT', 'US')
 * @param {object} rules - Rules data from useCountryRulesV1
 * @returns {Object} Country rules or default rules
 */
export function getCountryRules(countryISO, rules = {}) {
  if (!countryISO || !rules) return RULES_V1_DEFAULT
  
  const rule = getRuleV1(rules, countryISO)
  
  // Transform v1 format to legacy format for backward compatibility
  return {
    b2c_regime: rule.regime_b2c,
    b2b_regime: rule.regime_b2b,
    has_dnc: rule.flags.requires_dnc_scrub,
    requires_consent_b2c: rule.flags.requires_consent_b2c,
    requires_consent_b2b: rule.flags.requires_consent_b2b,
    allows_automated: rule.flags.allows_automated,
    recording_requires_consent: rule.flags.recording_requires_consent,
    has_quiet_hours: rule.flags.has_quiet_hours,
    ai_disclosure: rule.ai_disclosure,
    recording_basis: rule.recording_basis,
    dnc: rule.dnc
  }
}

/**
 * Batch classify multiple contacts
 * @param {Array} contacts - Array of contact objects
 * @param {object} rules - Rules data from useCountryRulesV1
 * @returns {Array} Array of classification results
 */
export function classifyContacts(contacts, rules = {}) {
  return contacts.map(contact => {
    const countryRules = getCountryRules(contact.country_iso, rules)
    const classification = classifyContact(contact, countryRules)
    
    return {
      ...contact,
      compliance_category: classification.verdict,
      compliance_reasons: classification.reasons
    }
  })
}

/**
 * Get compliance statistics for a batch of contacts
 * @param {Array} contacts - Array of classified contacts
 * @returns {Object} Statistics object
 */
export function getComplianceStats(contacts) {
  const stats = {
    total: contacts.length,
    allowed: 0,
    conditional: 0,
    blocked: 0
  }
  
  contacts.forEach(contact => {
    if (contact.compliance_category) {
      stats[contact.compliance_category]++
    }
  })
  
  return stats
}
