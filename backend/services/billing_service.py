"""
Billing Service for Budget Management and Ledger Tracking
Handles workspace budget calculations, spending limits, and transaction logging
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session
from backend.models import Workspace, BillingLedger
from uuid import uuid4
import json


def month_window(now: datetime, reset_day: int) -> Tuple[datetime, datetime]:
    """
    Calculate billing month window based on reset day
    
    Args:
        now: Current datetime
        reset_day: Day of month when budget resets (1-28)
    
    Returns:
        Tuple of (start_date, end_date) for current billing period
    """
    tz = timezone.utc
    now = now.astimezone(tz)
    start = now.replace(day=reset_day, hour=0, minute=0, second=0, microsecond=0)
    
    if now.day < reset_day:
        # Window starts from previous month
        prev_month = (start.replace(day=1) - timedelta(days=1)).replace(day=reset_day)
        start = prev_month
    
    # Calculate end date (next reset day)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    
    return start, end


def sum_ledger(session: Session, workspace_id: str, start: datetime, end: datetime) -> int:
    """
    Sum all ledger entries for a workspace within a date range
    
    Args:
        session: Database session
        workspace_id: Workspace ID
        start: Start date (inclusive)
        end: End date (exclusive)
    
    Returns:
        Total amount in cents
    """
    query = select(func.coalesce(func.sum(BillingLedger.amount_cents), 0)).where(
        and_(
            BillingLedger.workspace_id == workspace_id,
            BillingLedger.created_at >= start,
            BillingLedger.created_at < end
        )
    )
    result = session.execute(query).scalar_one()
    return int(result or 0)


def check_budget(workspace: Workspace, mtd_spend: int, new_amount: int) -> Dict[str, Any]:
    """
    Check if a new transaction would exceed budget limits
    
    Args:
        workspace: Workspace object with budget settings
        mtd_spend: Month-to-date spending in cents
        new_amount: New transaction amount in cents
    
    Returns:
        Dict with budget check results
    """
    limit_ = workspace.monthly_budget_cents or 0
    hard_stop = bool(workspace.budget_hard_stop)
    
    # Parse thresholds (handle both JSON and string)
    thresholds = [0.8, 1.0]  # default
    if workspace.budget_thresholds:
        if isinstance(workspace.budget_thresholds, str):
            try:
                thresholds = json.loads(workspace.budget_thresholds)
            except:
                thresholds = [0.8, 1.0]
        else:
            thresholds = workspace.budget_thresholds
    
    blocked = False
    threshold_hit: Optional[float] = None
    
    if limit_ > 0:
        ratio = (mtd_spend + new_amount) / max(limit_, 1)
        
        # Check which threshold is hit
        for t in sorted(thresholds):
            if ratio >= t:
                threshold_hit = t
        
        # Check if blocked by hard stop
        blocked = hard_stop and (mtd_spend + new_amount) > limit_
    
    return {
        "blocked": blocked,
        "threshold_hit": threshold_hit,
        "limit": limit_,
        "mtd_before": mtd_spend,
        "mtd_after": mtd_spend + new_amount,
        "ratio": (mtd_spend + new_amount) / max(limit_, 1) if limit_ > 0 else 0
    }


def append_ledger(session: Session, workspace_id: str, amount_cents: int, 
                  currency: str, provider: Optional[str], kind: str,
                  metadata: Optional[dict] = None,
                  idempotency_key: Optional[str] = None) -> str:
    """
    Add a new entry to the billing ledger
    
    Args:
        session: Database session
        workspace_id: Workspace ID
        amount_cents: Amount in cents (positive for charges, negative for credits)
        currency: Currency code (e.g., "USD")
        provider: Provider name (e.g., "twilio", "telnyx")
        kind: Transaction type (e.g., "number_purchase", "refund")
        metadata: Additional transaction metadata
        idempotency_key: Idempotency key to prevent duplicates
    
    Returns:
        Ledger entry ID
    """
    entry = BillingLedger(
        id=str(uuid4()),
        workspace_id=workspace_id,
        amount_cents=amount_cents,
        currency=currency,
        provider=provider,
        kind=kind,
        metadata_json=metadata or {},
        idempotency_key=idempotency_key
    )
    
    session.add(entry)
    session.flush()  # Get the ID without committing
    return entry.id


def get_workspace_budget_state(workspace: Workspace, session: Session) -> Dict[str, Any]:
    """
    Get complete budget state for a workspace
    
    Args:
        workspace: Workspace object
        session: Database session
    
    Returns:
        Dict with budget state information
    """
    reset_day = workspace.budget_resets_day or 1
    start, end = month_window(datetime.utcnow(), reset_day)
    mtd_spend = sum_ledger(session, workspace.id, start, end)
    
    # Check if currently blocked
    blocked = False
    if workspace.monthly_budget_cents and workspace.budget_hard_stop:
        blocked = mtd_spend >= workspace.monthly_budget_cents
    
    # Check current threshold
    threshold_hit = None
    if workspace.monthly_budget_cents > 0:
        ratio = mtd_spend / workspace.monthly_budget_cents
        thresholds = workspace.budget_thresholds or [0.8, 1.0]
        
        if isinstance(thresholds, str):
            try:
                thresholds = json.loads(thresholds)
            except:
                thresholds = [0.8, 1.0]
        
        for t in sorted(thresholds):
            if ratio >= t:
                threshold_hit = t
    
    return {
        "monthly_budget_cents": workspace.monthly_budget_cents or 0,
        "budget_currency": workspace.budget_currency or "USD",
        "budget_resets_day": reset_day,
        "budget_hard_stop": bool(workspace.budget_hard_stop),
        "budget_thresholds": workspace.budget_thresholds or [0.8, 1.0],
        "spend_month_to_date_cents": mtd_spend,
        "blocked": blocked,
        "threshold_hit": threshold_hit,
        "billing_period": {
            "start": start.isoformat(),
            "end": end.isoformat()
        }
    }


def check_idempotency(session: Session, idempotency_key: str) -> Optional[BillingLedger]:
    """
    Check if an idempotency key already exists
    
    Args:
        session: Database session
        idempotency_key: Idempotency key to check
    
    Returns:
        Existing ledger entry if found, None otherwise
    """
    if not idempotency_key:
        return None
    
    query = select(BillingLedger).where(BillingLedger.idempotency_key == idempotency_key)
    return session.execute(query).scalar_one_or_none()
