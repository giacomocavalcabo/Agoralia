# backend/services/telephony_providers.py
from .crypto import enc, dec
from ..models import ProviderAccount, NumberOrder, TelephonyProvider, Number
from sqlalchemy.orm import Session
from fastapi import HTTPException
from .providers import twilio, telnyx

def get_provider_client(p: TelephonyProvider):
    """Get the appropriate provider client based on provider type"""
    return twilio if p == TelephonyProvider.twilio else telnyx

async def start_purchase(db: Session, workspace_id: str, account: ProviderAccount, payload: dict):
    """Start a number purchase process"""
    client = get_provider_client(account.provider)
    
    # Extract account_sid or connection_id from the account
    account_sid = payload.get("account_sid")
    
    res = await client.purchase_number(
        api_key=dec(account.api_key_encrypted),
        account_sid=account_sid,
        country=payload["country"],
        type_=payload.get("type", "local"),
        area_code=payload.get("area_code"),
    )
    
    order = NumberOrder(
        id=payload["request_id"],
        workspace_id=workspace_id,
        provider=account.provider,
        request=payload,
        status=res["status"],
        provider_ref=res["provider_ref"],
        result=res,
    )
    
    db.add(order)
    db.commit()
    return order

async def start_import(db: Session, workspace_id: str, account: ProviderAccount, e164: str, req_id: str):
    """Start a number import process"""
    client = get_provider_client(account.provider)
    
    res = await client.import_number(
        api_key=dec(account.api_key_encrypted),
        account_sid=None,  # Not needed for import
        e164=e164,
    )
    
    order = NumberOrder(
        id=req_id,
        workspace_id=workspace_id,
        provider=account.provider,
        request={"e164": e164},
        status=res["status"],
        provider_ref=res["provider_ref"],
        result=res,
    )
    
    db.add(order)
    db.commit()
    return order

async def finalize_activate_number(db: Session, order: NumberOrder, hosted: bool):
    """Create/update Number in DB when order is finalized"""
    # Check if number already exists
    num = db.query(Number).filter_by(
        workspace_id=order.workspace_id, 
        e164=order.result["e164"]
    ).first()
    
    if not num:
        num = Number(
            id=f"num_{order.result['e164']}",
            workspace_id=order.workspace_id,
            e164=order.result["e164"],
        )
        db.add(num)
    
    # Update number with provider info
    num.provider = order.provider.value
    num.provider_ref = order.provider_ref
    num.hosted = hosted
    num.verified_cli = False  # Will be verified later
    
    # Update order status
    order.status = "active"
    
    db.commit()
    return num
