"""
CRM Field Mapping Presets for quick onboarding
"""
from typing import Dict, Any

# Default field mappings for each CRM provider
CRM_MAPPING_PRESETS = {
    "hubspot": {
        "contact": {
            "firstname": "firstname",
            "lastname": "lastname",
            "email": "email",
            "phone": "phone",
            "company": "company",
            "jobtitle": "jobtitle",
            "country": "country",
            "lifecyclestage": "lifecyclestage",
            "lead_status": "hs_lead_status",
            "notes": "notes"
        },
        "company": {
            "name": "name",
            "website": "website",
            "phone": "phone",
            "industry": "industry",
            "city": "city",
            "state": "state",
            "country": "country",
            "numberofemployees": "numberofemployees",
            "annualrevenue": "annualrevenue"
        },
        "deal": {
            "dealname": "dealname",
            "amount": "amount",
            "dealstage": "dealstage",
            "closedate": "closedate",
            "dealtype": "dealtype",
            "pipeline": "pipeline",
            "probability": "hs_probability"
        }
    },
    "zoho": {
        "contact": {
            "first_name": "First_Name",
            "last_name": "Last_Name",
            "email": "Email",
            "phone": "Phone",
            "account_name": "Account_Name",
            "title": "Title",
            "country": "Country",
            "lead_status": "Lead_Status",
            "description": "Description"
        },
        "company": {
            "name": "Account_Name",
            "website": "Website",
            "phone": "Phone",
            "industry": "Industry",
            "city": "Billing_City",
            "state": "Billing_State",
            "country": "Billing_Country",
            "employees": "No_of_Employees",
            "annual_revenue": "Annual_Revenue"
        },
        "deal": {
            "deal_name": "Deal_Name",
            "amount": "Amount",
            "stage": "Stage",
            "closing_date": "Closing_Date",
            "deal_type": "Deal_Type",
            "probability": "Probability",
            "description": "Description"
        }
    },
    "odoo": {
        "contact": {
            "firstname": "name (first part)",
            "lastname": "name (last part)",
            "email": "email",
            "phone": "phone",
            "company": "parent_id (company)",
            "job_title": "function",
            "country": "country_id",
            "notes": "comment"
        },
        "company": {
            "name": "name",
            "website": "website",
            "phone": "phone",
            "industry": "industry_id",
            "city": "city",
            "state": "state_id",
            "country": "country_id",
            "employees": "employee_count",
            "annual_revenue": "annual_revenue"
        },
        "deal": {
            "deal_name": "name",
            "amount": "expected_revenue",
            "stage": "stage_id",
            "closing_date": "date_deadline",
            "deal_type": "type",
            "probability": "probability",
            "description": "description"
        }
    }
}

# Transformation presets for common field mappings
TRANSFORMATION_PRESETS = {
    "phone_normalize": {
        "description": "Normalize phone to E.164 format",
        "transform": "e164",
        "example": "+1234567890"
    },
    "email_lowercase": {
        "description": "Convert email to lowercase",
        "transform": "lower",
        "example": "user@example.com"
    },
    "name_titlecase": {
        "description": "Convert name to title case",
        "transform": "title",
        "example": "John Doe"
    },
    "amount_multiply_100": {
        "description": "Multiply amount by 100 (cents to dollars)",
        "transform": "*100",
        "example": "1000 → 100000"
    },
    "date_iso": {
        "description": "Convert date to ISO format",
        "transform": "iso",
        "example": "2024-01-01T00:00:00Z"
    }
}

# Picklist mappings for common CRM stages
PICKLIST_PRESETS = {
    "hubspot": {
        "deal_stages": [
            "appointmentscheduled",
            "qualifiedtobuy",
            "presentationscheduled",
            "contractsent",
            "closedwon",
            "closedlost"
        ],
        "lifecycle_stages": [
            "lead",
            "marketingqualifiedlead",
            "salesqualifiedlead",
            "opportunity",
            "customer",
            "evangelist",
            "other"
        ]
    },
    "zoho": {
        "deal_stages": [
            "Qualification",
            "Needs Analysis",
            "Proposal",
            "Negotiation",
            "Closed Won",
            "Closed Lost"
        ],
        "lead_status": [
            "New",
            "Contacted",
            "Qualified",
            "Unqualified",
            "Junk Lead"
        ]
    },
    "odoo": {
        "deal_stages": [
            "New",
            "Qualified",
            "Proposition",
            "Won",
            "Lost"
        ],
        "lead_types": [
            "lead",
            "opportunity",
            "customer"
        ]
    }
}


def get_mapping_preset(provider: str, object_type: str) -> Dict[str, str]:
    """Get default field mapping for a provider and object type"""
    return CRM_MAPPING_PRESETS.get(provider, {}).get(object_type, {})


def get_transformation_presets() -> Dict[str, Dict[str, Any]]:
    """Get available transformation presets"""
    return TRANSFORMATION_PRESETS


def get_picklist_presets(provider: str) -> Dict[str, list]:
    """Get picklist presets for a provider"""
    return PICKLIST_PRESETS.get(provider, {})


def get_all_presets(provider: str) -> Dict[str, Any]:
    """Get all presets for a provider"""
    return {
        "field_mappings": {
            object_type: get_mapping_preset(provider, object_type)
            for object_type in ["contact", "company", "deal"]
        },
        "transformations": get_transformation_presets(),
        "picklists": get_picklist_presets(provider)
    }
