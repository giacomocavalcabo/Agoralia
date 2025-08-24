/**
 * Contact classification engine for compliance
 */

export const countryRulesByISO = {
  IT: { b2c_regime: 'opt-in', has_dnc: true },
  FR: { b2c_regime: 'opt-in', has_dnc: true },
  DE: { b2c_regime: 'opt-out', has_dnc: true },
  US: { b2c_regime: 'opt-out', has_dnc: true },
  GB: { b2c_regime: 'opt-out', has_dnc: true },
  ES: { b2c_regime: 'opt-in', has_dnc: true },
  NL: { b2c_regime: 'opt-in', has_dnc: true },
  BE: { b2c_regime: 'opt-in', has_dnc: true },
  AT: { b2c_regime: 'opt-out', has_dnc: true },
  CH: { b2c_regime: 'opt-out', has_dnc: false }
}

/**
 * Classify a contact based on country rules and contact attributes
 * @param {Object} contact - Contact data
 * @param {Object} countryRules - Country-specific rules
 * @returns {Object} Classification result with verdict and reasons
 */
export function classifyContact(contact, countryRules) {
  const reasons = []
  
  // B2B contacts are always allowed (opt-out regime)
  if (contact.contact_class === 'b2b') {
    return { 
      verdict: 'allowed', 
      reasons: ['B2B contacts are always allowed (opt-out regime)'] 
    }
  }
  
  // Unknown contact class is conditional
  if (contact.contact_class !== 'b2c') {
    return { 
      verdict: 'conditional', 
      reasons: ['Contact class is unknown - requires manual review'] 
    }
  }
  
  // B2C contacts in opt-in countries require explicit opt-in
  if (countryRules.b2c_regime === 'opt-in') {
    if (contact.opt_in === true) {
      return { 
        verdict: 'allowed', 
        reasons: ['B2C contact with documented opt-in consent'] 
      }
    }
    if (contact.opt_in === false) {
      return { 
        verdict: 'blocked', 
        reasons: ['B2C contact in opt-in country without consent'] 
      }
    }
    return { 
      verdict: 'conditional', 
      reasons: ['B2C contact in opt-in country - opt-in status unknown'] 
    }
  }
  
  // B2C contacts in opt-out countries (default allowed unless in DNC)
  if (countryRules.has_dnc) {
    if (contact.national_dnc === 'in') {
      return { 
        verdict: 'blocked', 
        reasons: ['Contact is registered in national Do Not Call registry'] 
      }
    }
    if (contact.national_dnc === 'not_in') {
      return { 
        verdict: 'allowed', 
        reasons: ['B2C contact not in DNC registry (opt-out country)'] 
      }
    }
    return { 
      verdict: 'conditional', 
      reasons: ['DNC registry exists but status unknown - requires verification'] 
    }
  }
  
  // No DNC registry - allowed by default
  return { 
    verdict: 'allowed', 
    reasons: ['No national DNC registry exists for this country'] 
  }
}

/**
 * Get country rules for a given ISO code
 * @param {string} countryISO - Country ISO code (e.g., 'IT', 'US')
 * @returns {Object} Country rules or default rules
 */
export function getCountryRules(countryISO) {
  return countryRulesByISO[countryISO?.toUpperCase()] || {
    b2c_regime: 'opt-out',
    has_dnc: false
  }
}

/**
 * Batch classify multiple contacts
 * @param {Array} contacts - Array of contact objects
 * @returns {Array} Array of classification results
 */
export function classifyContacts(contacts) {
  return contacts.map(contact => {
    const countryRules = getCountryRules(contact.country_iso)
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
