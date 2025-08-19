import stripe
import os
import hashlib
import hmac
import json
import time
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from .db import get_db
from .models import User, Workspace, BillingAccount
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Configure Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')

# Idempotency tracking (in production, use Redis)
processed_events = set()

def verify_stripe_signature(payload: bytes, signature: str) -> bool:
    """Verify Stripe webhook signature"""
    try:
        event = stripe.Webhook.construct_event(
            payload, signature, webhook_secret
        )
        return True
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        return False
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        return False

def is_event_processed(event_id: str) -> bool:
    """Check if event was already processed (idempotency)"""
    return event_id in processed_events

def mark_event_processed(event_id: str):
    """Mark event as processed"""
    processed_events.add(event_id)
    # In production, store in Redis with TTL

@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhooks with signature verification and idempotency"""
    
    # Get the raw body and signature
    payload = await request.body()
    signature = request.headers.get('stripe-signature')
    
    if not signature:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")
    
    # Verify signature
    if not verify_stripe_signature(payload, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Parse event
    try:
        event = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    event_id = event.get('id')
    event_type = event.get('type')
    
    # Check idempotency
    if is_event_processed(event_id):
        logger.info(f"Event {event_id} already processed, skipping")
        return {"status": "already_processed"}
    
    try:
        # Process event based on type
        if event_type == 'payment_method.attached':
            await handle_payment_method_attached(event, db)
        elif event_type == 'setup_intent.succeeded':
            await handle_setup_intent_succeeded(event, db)
        elif event_type == 'invoice.payment_succeeded':
            await handle_invoice_payment_succeeded(event, db)
        elif event_type == 'invoice.payment_failed':
            await handle_invoice_payment_failed(event, db)
        elif event_type == 'charge.failed':
            await handle_charge_failed(event, db)
        elif event_type == 'customer.subscription.updated':
            await handle_subscription_updated(event, db)
        else:
            logger.info(f"Unhandled event type: {event_type}")
        
        # Mark event as processed
        mark_event_processed(event_id)
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Error processing webhook {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

async def handle_payment_method_attached(event: Dict[str, Any], db: Session):
    """Handle payment method attached event"""
    try:
        payment_method = event['data']['object']
        customer_id = payment_method['customer']
        
        # Update billing account with new payment method
        billing_account = db.query(BillingAccount).filter(
            BillingAccount.stripe_customer_id == customer_id
        ).first()
        
        if billing_account:
            billing_account.payment_method_id = payment_method['id']
            billing_account.last_updated = time.time()
            db.commit()
            
            logger.info(f"Payment method {payment_method['id']} attached to customer {customer_id}")
        
    except Exception as e:
        logger.error(f"Error handling payment_method.attached: {e}")
        db.rollback()

async def handle_setup_intent_succeeded(event: Dict[str, Any], db: Session):
    """Handle setup intent succeeded event"""
    try:
        setup_intent = event['data']['object']
        customer_id = setup_intent['customer']
        
        # Update billing account with successful setup
        billing_account = db.query(BillingAccount).filter(
            BillingAccount.stripe_customer_id == customer_id
        ).first()
        
        if billing_account:
            billing_account.setup_intent_status = 'succeeded'
            billing_account.last_updated = time.time()
            db.commit()
            
            logger.info(f"Setup intent succeeded for customer {customer_id}")
        
    except Exception as e:
        logger.error(f"Error handling setup_intent.succeeded: {e}")
        db.rollback()

async def handle_invoice_payment_succeeded(event: Dict[str, Any], db: Session):
    """Handle successful invoice payment"""
    try:
        invoice = event['data']['object']
        customer_id = invoice['customer']
        amount_paid = invoice['amount_paid']
        
        # Update billing account with successful payment
        billing_account = db.query(BillingAccount).filter(
            BillingAccount.stripe_customer_id == customer_id
        ).first()
        
        if billing_account:
            # Add credits to account
            billing_account.balance_cents += amount_paid
            billing_account.last_payment_date = time.time()
            billing_account.last_payment_amount = amount_paid
            db.commit()
            
            logger.info(f"Payment succeeded: {amount_paid} cents for customer {customer_id}")
        
    except Exception as e:
        logger.error(f"Error handling invoice.payment_succeeded: {e}")
        db.rollback()

async def handle_invoice_payment_failed(event: Dict[str, Any], db: Session):
    """Handle failed invoice payment"""
    try:
        invoice = event['data']['object']
        customer_id = invoice['customer']
        
        # Update billing account with failed payment
        billing_account = db.query(BillingAccount).filter(
            BillingAccount.stripe_customer_id == customer_id
        ).first()
        
        if billing_account:
            billing_account.payment_failed = True
            billing_account.last_payment_failure = time.time()
            db.commit()
            
            logger.warning(f"Payment failed for customer {customer_id}")
        
    except Exception as e:
        logger.error(f"Error handling invoice.payment_failed: {e}")
        db.rollback()

async def handle_charge_failed(event: Dict[str, Any], db: Session):
    """Handle failed charge"""
    try:
        charge = event['data']['object']
        customer_id = charge['customer']
        
        # Update billing account with failed charge
        billing_account = db.query(BillingAccount).filter(
            BillingAccount.stripe_customer_id == customer_id
        ).first()
        
        if billing_account:
            billing_account.charge_failed = True
            billing_account.last_charge_failure = time.time()
            db.commit()
            
            logger.warning(f"Charge failed for customer {customer_id}")
        
    except Exception as e:
        logger.error(f"Error handling charge.failed: {e}")
        db.rollback()

async def handle_subscription_updated(event: Dict[str, Any], db: Session):
    """Handle subscription updates"""
    try:
        subscription = event['data']['object']
        customer_id = subscription['customer']
        status = subscription['status']
        
        # Update billing account with subscription status
        billing_account = db.query(BillingAccount).filter(
            BillingAccount.stripe_customer_id == customer_id
        ).first()
        
        if billing_account:
            billing_account.subscription_status = status
            billing_account.last_updated = time.time()
            db.commit()
            
            logger.info(f"Subscription updated to {status} for customer {customer_id}")
        
    except Exception as e:
        logger.error(f"Error handling subscription.updated: {e}")
        db.rollback()
