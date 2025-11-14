"""Country compliance rules service"""
import json
import os
from pathlib import Path
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from config.database import engine
from models.compliance import CountryRule
from utils.helpers import country_iso_from_e164


# Path to compliance JSON file
BACKEND_DIR = Path(__file__).resolve().parent.parent
COMPLIANCE_JSON_PATH = BACKEND_DIR.parent / "knowledge" / "general" / "data" / "compliance.v2.json"

# Cache for loaded JSON data
_COMPLIANCE_CACHE: Optional[Dict[str, Any]] = None


def _load_compliance_json() -> Dict[str, Any]:
    """Load compliance rules from JSON file"""
    global _COMPLIANCE_CACHE
    if _COMPLIANCE_CACHE is not None:
        return _COMPLIANCE_CACHE
    
    try:
        if COMPLIANCE_JSON_PATH.exists():
            with open(COMPLIANCE_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                _COMPLIANCE_CACHE = data.get("fused_by_iso", {})
                return _COMPLIANCE_CACHE
    except Exception:
        pass
    
    _COMPLIANCE_CACHE = {}
    return _COMPLIANCE_CACHE


def _parse_quiet_hours(quiet_hours: Optional[Any]) -> tuple:
    """Parse quiet hours from JSON format"""
    if not quiet_hours:
        return (False, None, None, None)
    
    weekdays = None
    saturday = None
    sunday = None
    
    if isinstance(quiet_hours, dict):
        weekdays_list = quiet_hours.get("weekdays")
        if isinstance(weekdays_list, list) and len(weekdays_list) >= 2:
            weekdays = f"{weekdays_list[0]}-{weekdays_list[1]}"
        saturday_val = quiet_hours.get("saturday")
        if saturday_val == "forbidden":
            saturday = "forbidden"
        elif isinstance(saturday_val, list) and len(saturday_val) >= 2:
            saturday = f"{saturday_val[0]}-{saturday_val[1]}"
        sunday_val = quiet_hours.get("sunday")
        if sunday_val == "forbidden":
            sunday = "forbidden"
        elif isinstance(sunday_val, list) and len(sunday_val) >= 2:
            sunday = f"{sunday_val[0]}-{sunday_val[1]}"
    
    enabled = weekdays is not None or saturday is not None or sunday is not None
    return (enabled, weekdays, saturday, sunday)


def _json_to_country_rule(country_iso: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert JSON country data to CountryRule fields"""
    regime = data.get("regime", {})
    regime_b2b = regime.get("b2b", {}).get("type", "opt_out")
    regime_b2c = regime.get("b2c", {}).get("type", "opt_out")
    
    dnc = data.get("dnc", {})
    dnc_registry_enabled = bool(dnc.get("has_registry", False))
    dnc_check_required = bool(dnc.get("check_required", False))
    dnc_api_available = bool(dnc.get("api_available", False))
    
    quiet_hours_enabled, quiet_hours_weekdays, quiet_hours_saturday, quiet_hours_sunday = _parse_quiet_hours(data.get("quiet_hours"))
    
    ai_disclosure = data.get("ai_disclosure", {})
    ai_disclosure_required = bool(ai_disclosure.get("required", False))
    
    recording = data.get("recording", {})
    recording_basis = recording.get("basis", "consent")
    
    # Determine timezone (default to UTC, can be improved)
    timezone = "UTC"  # TODO: Map country to timezone
    
    # Store full metadata
    metadata = {
        "country": data.get("country"),
        "continent": data.get("continent"),
        "confidence": data.get("confidence"),
        "last_verified": data.get("last_verified"),
        "rules": data.get("rules", {}),
        "sources": data.get("sources", {}),
    }
    
    return {
        "country_iso": country_iso.upper(),
        "regime_b2b": regime_b2b,
        "regime_b2c": regime_b2c,
        "dnc_registry_enabled": 1 if dnc_registry_enabled else 0,
        "dnc_registry_name": dnc.get("name"),
        "dnc_registry_url": dnc.get("url"),
        "dnc_check_required": 1 if dnc_check_required else 0,
        "dnc_api_available": 1 if dnc_api_available else 0,
        "quiet_hours_enabled": 1 if quiet_hours_enabled else 0,
        "quiet_hours_weekdays": quiet_hours_weekdays,
        "quiet_hours_saturday": quiet_hours_saturday,
        "quiet_hours_sunday": quiet_hours_sunday,
        "timezone": timezone,
        "ai_disclosure_required": 1 if ai_disclosure_required else 0,
        "ai_disclosure_note": ai_disclosure.get("note"),
        "recording_basis": recording_basis,
        "metadata_json": json.dumps(metadata) if metadata else None,
    }


def get_country_rule(tenant_id: Optional[int], country_iso: str, session: Optional[Session] = None) -> Optional[Dict[str, Any]]:
    """
    Get country rule for tenant and country.
    Priority: 1) Tenant override, 2) Global from DB, 3) JSON defaults
    
    Returns: Dict with CountryRule fields or None
    """
    country_iso = country_iso.upper()
    
    # 1. Check tenant override in DB
    if session is not None:
        rule = (
            session.query(CountryRule)
            .filter(CountryRule.tenant_id == tenant_id, CountryRule.country_iso == country_iso)
            .first()
        )
        if rule:
            return {
                "country_iso": rule.country_iso,
                "regime_b2b": rule.regime_b2b,
                "regime_b2c": rule.regime_b2c,
                "dnc_registry_enabled": bool(rule.dnc_registry_enabled),
                "dnc_registry_name": rule.dnc_registry_name,
                "dnc_registry_url": rule.dnc_registry_url,
                "dnc_check_required": bool(rule.dnc_check_required),
                "dnc_api_available": bool(rule.dnc_api_available),
                "quiet_hours_enabled": bool(rule.quiet_hours_enabled),
                "quiet_hours_weekdays": rule.quiet_hours_weekdays,
                "quiet_hours_saturday": rule.quiet_hours_saturday,
                "quiet_hours_sunday": rule.quiet_hours_sunday,
                "timezone": rule.timezone or "UTC",
                "ai_disclosure_required": bool(rule.ai_disclosure_required),
                "ai_disclosure_note": rule.ai_disclosure_note,
                "recording_basis": rule.recording_basis or "consent",
                "metadata_json": rule.metadata_json,
            }
    
    # 2. Check global (tenant_id=NULL) in DB
    if session is not None:
        rule = (
            session.query(CountryRule)
            .filter(CountryRule.tenant_id.is_(None), CountryRule.country_iso == country_iso)
            .first()
        )
        if rule:
            return {
                "country_iso": rule.country_iso,
                "regime_b2b": rule.regime_b2b,
                "regime_b2c": rule.regime_b2c,
                "dnc_registry_enabled": bool(rule.dnc_registry_enabled),
                "dnc_registry_name": rule.dnc_registry_name,
                "dnc_registry_url": rule.dnc_registry_url,
                "dnc_check_required": bool(rule.dnc_check_required),
                "dnc_api_available": bool(rule.dnc_api_available),
                "quiet_hours_enabled": bool(rule.quiet_hours_enabled),
                "quiet_hours_weekdays": rule.quiet_hours_weekdays,
                "quiet_hours_saturday": rule.quiet_hours_saturday,
                "quiet_hours_sunday": rule.quiet_hours_sunday,
                "timezone": rule.timezone or "UTC",
                "ai_disclosure_required": bool(rule.ai_disclosure_required),
                "ai_disclosure_note": rule.ai_disclosure_note,
                "recording_basis": rule.recording_basis or "consent",
                "metadata_json": rule.metadata_json,
            }
    
    # 3. Fallback to JSON defaults
    json_data = _load_compliance_json()
    if country_iso in json_data:
        return _json_to_country_rule(country_iso, json_data[country_iso])
    
    # 4. Default permissive rule if nothing found
    return {
        "country_iso": country_iso,
        "regime_b2b": "opt_out",
        "regime_b2c": "opt_out",
        "dnc_registry_enabled": False,
        "dnc_registry_name": None,
        "dnc_registry_url": None,
        "dnc_check_required": False,
        "dnc_api_available": False,
        "quiet_hours_enabled": False,
        "quiet_hours_weekdays": None,
        "quiet_hours_saturday": None,
        "quiet_hours_sunday": None,
        "timezone": "UTC",
        "ai_disclosure_required": False,
        "ai_disclosure_note": None,
        "recording_basis": "consent",
        "metadata_json": None,
    }


def get_country_rule_for_number(tenant_id: Optional[int], to_number: str, session: Optional[Session] = None) -> Optional[Dict[str, Any]]:
    """Get country rule for a phone number"""
    country_iso = country_iso_from_e164(to_number)
    if not country_iso:
        return None
    return get_country_rule(tenant_id, country_iso, session)

