import json
import logging
from pathlib import Path
from typing import Dict, Optional
from .models_v1 import RuleV1, RulesV1Response

logger = logging.getLogger(__name__)

# Global rules storage
RULES_V1: Dict[str, RuleV1] = {}

def load_rules_v1() -> Dict[str, RuleV1]:
    """Load compliance rules v1 from JSON file"""
    global RULES_V1
    
    try:
        rules_path = Path(__file__).parent.parent / "data" / "compliance" / "rules.v1.json"
        
        if not rules_path.exists():
            logger.error(f"Rules file not found: {rules_path}")
            return {}
        
        with open(rules_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Extract rules from "fused_by_iso" structure
        rules_data = data.get("fused_by_iso", {})
        
        # Validate and load each rule
        for iso, rule_data in rules_data.items():
            try:
                rule = RuleV1(**rule_data)
                RULES_V1[iso] = rule
            except Exception as e:
                logger.warning(f"Invalid rule for {iso}: {e}")
                continue
        
        count = len(RULES_V1)
        logger.info(f"Loaded {count} compliance rules v1")
        
        # Assert coverage (should be >= 240 countries)
        if count < 240:
            logger.warning(f"Expected >= 240 countries, got {count}")
        else:
            logger.info(f"✅ Coverage OK: {count} countries loaded")
        
        return RULES_V1
        
    except Exception as e:
        logger.error(f"Failed to load compliance rules: {e}")
        return {}

def get_rule_v1(iso: str) -> Optional[RuleV1]:
    """Get rule for specific ISO code"""
    return RULES_V1.get(iso.upper())

def get_rules_v1(iso_list: Optional[list] = None) -> Dict[str, RuleV1]:
    """Get rules, optionally filtered by ISO codes"""
    if not iso_list:
        return RULES_V1
    
    return {iso: RULES_V1[iso] for iso in iso_list if iso in RULES_V1}

def get_rules_v1_response(iso_list: Optional[list] = None) -> RulesV1Response:
    """Get rules response in API format"""
    rules = get_rules_v1(iso_list)
    return RulesV1Response(
        version="v1",
        count=len(rules),
        rules=rules
    )

# Load rules on module import
load_rules_v1()
