from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from ..compliance.rules_loader_v1 import get_rules_v1_response, get_rule_v1

router = APIRouter(prefix="/compliance", tags=["compliance"])

@router.get("/rules/v1")
async def get_compliance_rules_v1(
    iso: Optional[str] = Query(None, description="Comma-separated ISO codes (e.g., IT,FR,NL)")
):
    """
    Get compliance rules v1 for all countries or filtered by ISO codes
    """
    iso_list = None
    if iso:
        iso_list = [code.strip().upper() for code in iso.split(",")]
    
    return get_rules_v1_response(iso_list)

@router.get("/rules/v1/{iso}")
async def get_compliance_rule_v1(iso: str):
    """
    Get compliance rule v1 for specific country
    """
    rule = get_rule_v1(iso)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Country {iso} not found")
    
    return rule
