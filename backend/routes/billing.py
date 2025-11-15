"""Billing and Stripe endpoints"""
import os
import json
from typing import Dict, Any, List
from fastapi import APIRouter, Request, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import stripe

from config.database import engine
from models.billing import Subscription, UsageEvent, Addon, Entitlement
from models.campaigns import Campaign, Lead
from utils.auth import extract_tenant_id
from utils.tenant import tenant_session

router = APIRouter()

stripe.api_key = os.getenv("STRIPE_API_KEY", "")


class StripeEvent(BaseModel):
    id: str
    type: str
    data: Dict[str, Any]


class AddonUpdate(BaseModel):
    qty: int


@router.post("/checkout")
async def billing_checkout(request: Request, plan: str = "core") -> Dict[str, Any]:
    """Create Stripe checkout session"""
    if not stripe.api_key:
        raise HTTPException(status_code=400, detail="Stripe not configured")
    tenant_id = extract_tenant_id(request)
    price_map = {
        "core": os.getenv("STRIPE_PRICE_CORE", ""),
        "pro": os.getenv("STRIPE_PRICE_PRO", ""),
    }
    price_id = price_map.get(plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Unknown plan")
    try:
        success_url = os.getenv("STRIPE_SUCCESS_URL")
        cancel_url = os.getenv("STRIPE_CANCEL_URL")
        if not success_url or not cancel_url:
            raise HTTPException(status_code=500, detail="Stripe URLs not configured")
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=cancel_url,
            client_reference_id=str(tenant_id or "0"),
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/portal")
async def billing_portal(request: Request) -> Dict[str, Any]:
    """Get Stripe billing portal session"""
    if not stripe.api_key:
        raise HTTPException(status_code=400, detail="Stripe not configured")
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        sub = (
            session.query(Subscription)
            .filter(Subscription.tenant_id == (tenant_id or 0))
            .order_by(Subscription.id.desc())
            .first()
        )
        customer = sub.stripe_customer_id if sub and sub.stripe_customer_id else os.getenv("STRIPE_FALLBACK_CUSTOMER", "")
    try:
        return_url = os.getenv("STRIPE_PORTAL_RETURN_URL")
        if not return_url:
            raise HTTPException(status_code=500, detail="Stripe portal return URL not configured")
        portal = stripe.billing_portal.Session.create(
            customer=customer,
            return_url=return_url,
        )
        return {"url": portal.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook/stripe")
async def billing_webhook_stripe(request: Request):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature")
    wh_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    try:
        event = stripe.Webhook.construct_event(payload, sig, wh_secret) if wh_secret else stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    etype = event["type"]
    obj = event["data"]["object"]
    with Session(engine) as session:
        try:
            if etype == "checkout.session.completed":
                tenant_ref = (obj.get("client_reference_id") or "0")
                plan_code = "core" if os.getenv("STRIPE_PRICE_CORE") in str(obj) else ("pro" if os.getenv("STRIPE_PRICE_PRO") in str(obj) else "core")
                sub_id = obj.get("subscription")
                cust_id = obj.get("customer")
                tenant_id = int(tenant_ref) if str(tenant_ref).isdigit() else 0
                sub = Subscription(tenant_id=tenant_id, plan_code=plan_code, status="active", stripe_subscription_id=sub_id, stripe_customer_id=cust_id)
                session.add(sub)
                session.commit()
            if etype.startswith("customer.subscription."):
                sub_id = obj.get("id")
                status = obj.get("status")
                row = session.query(Subscription).filter(Subscription.stripe_subscription_id == sub_id).order_by(Subscription.id.desc()).first()
                if row:
                    row.status = status
                    session.commit()
        except Exception:
            session.rollback()
            raise
    return {"received": True}


@router.get("/overview")
async def billing_overview(request: Request) -> Dict[str, Any]:
    """Get billing overview"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        sub = (
            session.query(Subscription)
            .filter(Subscription.tenant_id == (tenant_id or 0))
            .order_by(Subscription.id.desc())
            .first()
        )
        plan = (sub.plan_code if sub else "free")
        status = (sub.status if sub else "trialing")
        start_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        usage = (
            session.query(UsageEvent)
            .filter(UsageEvent.ts >= start_month)
            .filter((UsageEvent.tenant_id == (tenant_id or 0)) if tenant_id is not None else True)
            .all()
        )
        minutes = sum(int(u.minutes_billed or 0) for u in usage)
        trial_days_left = None
        trial_expires_at = None
        if sub and (sub.plan_code or "free") == "free" and (sub.status or "trialing") == "trialing":
            started = sub.created_at or datetime.now(timezone.utc)
            delta_days = (datetime.now(timezone.utc) - started).days
            left = max(0, 14 - delta_days)
            trial_days_left = left
            trial_expires_at = (started + timedelta(days=14)).isoformat()
        plan_lower = (plan or "free").lower()
        minutes_cap = None if plan_lower == "pro" else (1000 if plan_lower == "core" else 100)
        return {
            "plan": plan,
            "status": status,
            "minutes_month_to_date": minutes,
            "minutes_cap": minutes_cap,
            "trial_days_left": trial_days_left,
            "trial_expires_at": trial_expires_at
        }


@router.get("/me/usage")
async def me_usage(request: Request) -> Dict[str, Any]:
    """Lightweight usage snapshot"""
    return await billing_overview(request)


@router.post("/usage/sync")
async def billing_usage_sync() -> Dict[str, Any]:
    """Sync usage to Stripe"""
    with Session(engine) as session:
        rows = session.query(UsageEvent).filter(UsageEvent.synced_to_stripe == 0).all()
        count = 0
        for r in rows:
            r.synced_to_stripe = 1
            count += 1
        session.commit()
    return {"synced": count}


@router.get("/entitlements")
async def get_entitlements(request: Request) -> Dict[str, Any]:
    """Get plan entitlements"""
    tenant_id = extract_tenant_id(request)
    
    def _plan_entitlements(plan_code: str) -> Dict[str, Any]:
        if plan_code == "enterprise":
            return {
                "calendar_full": True,
                "calendar_week_day": True,
                "workflows_limit": None,
                "languages_allowance": None,
                "agents_limit": None,  # Unlimited
                "integrations": ["hubspot", "zoho", "odoo", "csv"],
                "analytics_advanced": True,
                "roles_enabled": True,
                "sso": True,
                "sla": True,
                "data_residency": "EU",
                "retention_custom": True,
                "premium_models": True,
                "byo_telephony": True,
                "custom_integrations": True,
                "success_manager": True,
            }
        if plan_code == "pro":
            return {
                "calendar_full": True,
                "calendar_week_day": True,
                "workflows_limit": None,
                "languages_allowance": None,
                "agents_limit": 20,  # 20 agents max
                "integrations": ["hubspot", "zoho", "odoo", "csv"],
                "analytics_advanced": True,
                "roles_enabled": True,
            }
        if plan_code == "core":
            return {
                "calendar_full": False,
                "calendar_week_day": True,
                "workflows_limit": 3,
                "languages_allowance": 3,
                "agents_limit": 5,  # 5 agents max
                "integrations": ["hubspot", "zoho", "odoo", "csv"],
            }
        return {
            "calendar_full": False,
            "calendar_week_day": False,
            "workflows_limit": 0,
            "languages_allowance": 1,
            "agents_limit": 1,  # 1 agent max (Free plan)
            "integrations": ["csv"],
        }
    
    with Session(engine) as session:
        sub = (
            session.query(Subscription)
            .filter(Subscription.tenant_id == (tenant_id or 0))
            .order_by(Subscription.id.desc())
            .first()
        )
        base = _plan_entitlements(sub.plan_code if sub else "free")
        addons = session.query(Addon).filter(Addon.tenant_id == (tenant_id or 0), Addon.active == 1).all()
        inbound_slots = 0
        for a in addons:
            if a.type == "inbound_slot" and a.qty and a.qty > 0:
                inbound_slots += int(a.qty)
        base["inbound_enabled"] = inbound_slots > 0
        base["inbound_slots"] = inbound_slots
        rows = session.query(Entitlement).filter(Entitlement.tenant_id == (tenant_id or 0)).all()
        for e in rows:
            try:
                base[e.key] = json.loads(e.value) if e.value else True
            except Exception:
                base[e.key] = e.value
    return base


@router.get("/addons")
async def list_addons(request: Request) -> List[Dict[str, Any]]:
    """List addons"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        rows = session.query(Addon).filter(Addon.tenant_id == (tenant_id or 0)).all()
        return [{"id": a.id, "type": a.type, "qty": a.qty, "active": bool(a.active)} for a in rows]


@router.post("/addons/inbound_slot")
async def set_inbound_slots(request: Request, body: AddonUpdate) -> Dict[str, Any]:
    """Set inbound slots addon"""
    tenant_id = extract_tenant_id(request)
    with Session(engine) as session:
        row = (
            session.query(Addon)
            .filter(Addon.tenant_id == (tenant_id or 0), Addon.type == "inbound_slot")
            .one_or_none()
        )
        if not row:
            row = Addon(tenant_id=(tenant_id or 0), type="inbound_slot", qty=max(0, int(body.qty or 0)))
            session.add(row)
        else:
            row.qty = max(0, int(body.qty or 0))
            row.active = 1 if row.qty > 0 else 0
        session.commit()
    return {"ok": True}

