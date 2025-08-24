"""
Compliance Engine for Lead Classification

This module provides the core logic for classifying leads based on compliance rules.
It implements the green/amber/red classification system for B2B/B2C contacts.
"""

import logging
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
import json
import os

logger = logging.getLogger(__name__)

# Load compliance rules from the new v2 format
COMPLIANCE_RULES_PATH = os.environ.get("COMPLIANCE_RULES_PATH") or os.path.join(
    os.path.dirname(__file__), "..", "data", "compliance", "compliance.v2.json"
)

class ComplianceEngine:
    """Engine for classifying leads based on compliance rules"""
    
    def __init__(self):
        self.rules = self._load_compliance_rules()
    
    def _load_compliance_rules(self) -> Dict[str, Any]:
        """Load compliance rules from the v2 JSON file"""
        try:
            with open(COMPLIANCE_RULES_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
            country_count = len(data.get('fused_by_iso', {}))
            logger.info(f"Loaded compliance rules for {country_count} countries")
            return data
        except FileNotFoundError:
            logger.warning(f"Compliance rules file not found at {COMPLIANCE_RULES_PATH}")
            return {"fused_by_iso": {}}
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in compliance rules: {e}")
            return {"fused_by_iso": {}}
        except Exception as e:
            logger.error(f"Failed to load compliance rules: {e}")
            return {"fused_by_iso": {}}
    
    def get_country_rules(self, country_iso: str) -> Optional[Dict[str, Any]]:
        """Get compliance rules for a specific country"""
        if not country_iso:
            return None
        
        # Try to find country rules
        country_iso = country_iso.upper()
        
        # The v2 format uses fused_by_iso structure
        return self.rules.get("fused_by_iso", {}).get(country_iso)
    
    def classify_contact(self, contact: Dict[str, Any], country_iso: str) -> Tuple[str, List[str]]:
        """
        Classify a contact as allowed, conditional, or blocked
        
        Args:
            contact: Contact data with compliance fields
            country_iso: ISO country code
            
        Returns:
            Tuple of (category, reasons)
            category: 'allowed', 'conditional', or 'blocked'
            reasons: List of reason strings
        """
        country_rules = self.get_country_rules(country_iso)
        if not country_rules:
            # Unknown country - default to conditional for safety
            return "conditional", ["Paese non riconosciuto nelle regole di compliance"]
        
        contact_class = contact.get("contact_class", "unknown")
        relationship_basis = contact.get("relationship_basis", "unknown")
        opt_in = contact.get("opt_in")
        national_dnc = contact.get("national_dnc", "unknown")
        
        reasons = []
        
        # B2B classification (default: allowed)
        if contact_class == "b2b":
            if relationship_basis == "existing":
                return "allowed", ["B2B con relazione esistente"]
            elif relationship_basis == "none":
                return "allowed", ["B2B senza relazione esistente"]
            else:  # unknown
                return "conditional", ["B2B con base giuridica sconosciuta"]
        
        # B2C classification
        if contact_class == "b2c":
            regime_b2c = country_rules.get("regime", {}).get("b2c", {}).get("type", "unspecified")
            dnc_info = country_rules.get("dnc", {})
            has_dnc_registry = dnc_info.get("has_registry", False)
            
            if regime_b2c == "opt-in":
                if opt_in is True:
                    return "allowed", ["B2C opt-in documentato"]
                elif opt_in is False:
                    return "blocked", ["B2C opt-in richiesto ma non fornito"]
                else:  # unknown
                    return "blocked", ["B2C richiede opt-in ma stato sconosciuto"]
            
            elif regime_b2c == "opt-out":
                if has_dnc_registry:
                    if national_dnc == "in":
                        return "blocked", ["Numero presente nel registro nazionale DNC"]
                    elif national_dnc == "not_in":
                        return "allowed", ["B2C opt-out con DNC non iscritto"]
                    else:  # unknown
                        return "conditional", ["Registro DNC presente ma stato sconosciuto"]
                else:
                    return "allowed", ["Nessun registro nazionale; onorare opt-out se espresso"]
            
            else:  # unspecified/unknown regime
                if has_dnc_registry:
                    if national_dnc == "in":
                        return "blocked", ["Numero presente nel registro nazionale DNC"]
                    elif national_dnc == "not_in":
                        return "allowed", ["B2C con DNC non iscritto"]
                    else:  # unknown
                        return "conditional", ["Registro DNC presente ma stato sconosciuto"]
                else:
                    return "allowed", ["Nessun registro nazionale; regime non specificato"]
        
        # Unknown contact class - default to conditional for safety
        return "conditional", ["Classe contatto sconosciuta"]
    
    def apply_heuristics(self, contact: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply automatic heuristics to suggest contact classification
        
        Args:
            contact: Contact data
            
        Returns:
            Contact data with suggested fields
        """
        suggestions = {}
        
        # Infer contact class from company/email
        company = contact.get("company", "")
        email = contact.get("email", "")
        
        if company or (email and self._is_business_email(email)):
            suggestions["contact_class"] = "b2b"
        
        # Infer relationship basis from email domain
        if email and contact.get("workspace_domain"):
            if email.split("@")[-1] == contact.get("workspace_domain"):
                suggestions["relationship_basis"] = "existing"
        
        return suggestions
    
    def _is_business_email(self, email: str) -> bool:
        """Check if email appears to be from a business domain"""
        if not email or "@" not in email:
            return False
        
        domain = email.split("@")[-1].lower()
        personal_domains = {"gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com"}
        
        return domain not in personal_domains
    
    def validate_contact(self, contact: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate contact data and return validation results
        
        Args:
            contact: Contact data to validate
            
        Returns:
            Validation results with errors and warnings
        """
        errors = []
        warnings = []
        
        # Required fields
        if not contact.get("phone_e164"):
            errors.append("Numero di telefono richiesto")
        
        if not contact.get("name"):
            warnings.append("Nome mancante")
        
        # Phone number format validation
        phone = contact.get("phone_e164", "")
        if phone and not phone.startswith("+"):
            errors.append("Numero di telefono deve iniziare con +")
        
        # Country validation
        country_iso = contact.get("country_iso")
        if country_iso and len(country_iso) != 2:
            errors.append("Codice paese deve essere di 2 caratteri")
        
        # Compliance field validation
        contact_class = contact.get("contact_class")
        if contact_class and contact_class not in ["b2b", "b2c", "unknown"]:
            errors.append("Classe contatto non valida")
        
        relationship_basis = contact.get("relationship_basis")
        if relationship_basis and relationship_basis not in ["existing", "none", "unknown"]:
            errors.append("Base relazione non valida")
        
        national_dnc = contact.get("national_dnc")
        if national_dnc and national_dnc not in ["in", "not_in", "unknown"]:
            errors.append("Stato DNC non valido")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    def get_compliance_summary(self, contacts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get compliance summary for a list of contacts
        
        Args:
            contacts: List of contact data
            
        Returns:
            Summary with counts and breakdowns
        """
        summary = {
            "total": len(contacts),
            "allowed": 0,
            "conditional": 0,
            "blocked": 0,
            "unknown": 0,
            "by_country": {},
            "by_class": {"b2b": 0, "b2c": 0, "unknown": 0}
        }
        
        for contact in contacts:
            category = contact.get("compliance_category", "unknown")
            country = contact.get("country_iso", "unknown")
            contact_class = contact.get("contact_class", "unknown")
            
            summary[category] += 1
            summary["by_class"][contact_class] += 1
            
            if country not in summary["by_country"]:
                summary["by_country"][country] = {"total": 0, "allowed": 0, "conditional": 0, "blocked": 0}
            
            summary["by_country"][country]["total"] += 1
            summary["by_country"][country][category] += 1
        
        return summary


# Global instance
compliance_engine = ComplianceEngine()
