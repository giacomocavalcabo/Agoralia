from typing import Dict, List
from backend.models import RegulatorySubmission
from sqlalchemy.orm import Session

def get_requirements(provider: str, country: str, number_type: str, entity_type: str) -> Dict:
    """Get compliance requirements for a specific provider/country/number_type/entity_type combination"""
    provider = provider.lower()
    
    # Seed requirements - in production this would come from provider APIs
    # For now, return basic requirements for common scenarios
    requirements = {
        "twilio": {
            "IT": {
                "local": {
                    "business": {
                        "documents": ["business_registration", "proof_of_address", "tax_id"],
                        "notes": "Italian local numbers require business verification"
                    },
                    "individual": {
                        "documents": ["id_document", "proof_of_address"],
                        "notes": "Italian local numbers require ID verification"
                    }
                },
                "mobile": {
                    "business": {
                        "documents": ["business_registration", "proof_of_address"],
                        "notes": "Italian mobile numbers require business verification"
                    },
                    "individual": {
                        "documents": ["id_document"],
                        "notes": "Italian mobile numbers require ID verification"
                    }
                }
            },
            "US": {
                "local": {
                    "business": {
                        "documents": ["business_license", "ein_letter"],
                        "notes": "US local numbers require business verification"
                    },
                    "individual": {
                        "documents": ["ssn", "drivers_license"],
                        "notes": "US local numbers require SSN verification"
                    }
                }
            }
        },
        "telnyx": {
            "IT": {
                "local": {
                    "business": {
                        "documents": ["business_registration", "proof_of_address"],
                        "notes": "Telnyx Italian local numbers require business verification"
                    },
                    "individual": {
                        "documents": ["id_document", "proof_of_address"],
                        "notes": "Telnyx Italian local numbers require ID verification"
                    }
                }
            }
        }
    }
    
    return requirements.get(provider, {}).get(country, {}).get(number_type, {}).get(entity_type, {})

def submission_satisfies(requirements: Dict, provided_fields: Dict, files: List[Dict]) -> bool:
    """Check if a submission satisfies the compliance requirements"""
    if not requirements:
        return True  # No requirements means compliance is satisfied
    
    needed_docs = set(requirements.get("documents", []))
    if not needed_docs:
        return True  # No documents required
    
    # Extract document kinds from uploaded files
    have_docs = {f.get("kind") for f in files or [] if f.get("kind")}
    
    # Check if all required documents are provided
    return needed_docs.issubset(have_docs)

def ensure_compliance_or_raise(db: Session, ws_id: str, provider: str, country: str, number_type: str, entity_type: str):
    """Ensure compliance requirements are met, or raise HTTPException"""
    req = get_requirements(provider, country, number_type, entity_type)
    if not req:  # nessun requisito definito → consenti
        return
    
    # Check for approved submission
    sub = db.query(RegulatorySubmission).filter_by(
        workspace_id=ws_id, 
        provider=provider, 
        country=country,
        number_type=number_type, 
        entity_type=entity_type, 
        status="approved"
    ).order_by(RegulatorySubmission.updated_at.desc()).first()
    
    if not sub or not submission_satisfies(req, sub.provided_fields or {}, sub.files or []):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403, 
            detail={
                "error": "compliance_required",
                "message": f"Compliance requirements not met for {country} {number_type} {entity_type}",
                "requirements": req
            }
        )
