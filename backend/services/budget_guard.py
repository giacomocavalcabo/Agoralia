"""
Budget Guard Service
Handles atomic budget checks and ledger writes to prevent race conditions
"""

from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from sqlalchemy import select, and_
from sqlalchemy.orm import Session
from fastapi import HTTPException
from backend.models import Workspace, BillingLedger
from backend.services.billing_service import month_window, sum_ledger, check_budget


def atomic_budget_check(
    session: Session, 
    workspace_id: str, 
    amount_cents: int,
    idempotency_key: Optional[str] = None,
    operation_kind: str = "unknown"
) -> Tuple[Workspace, Dict[str, Any]]:
    """
    Atomic budget check with workspace lock to prevent race conditions
    
    Args:
        session: Database session
        workspace_id: Workspace ID
        amount_cents: Amount to check in cents
        idempotency_key: Idempotency key for deduplication
        operation_kind: Type of operation (e.g., "number_purchase", "import")
    
    Returns:
        Tuple of (workspace, budget_check_result)
    
    Raises:
        HTTPException: If budget limit exceeded
    """
    
    # Lock workspace row to prevent concurrent budget modifications
    workspace = session.execute(
        select(Workspace)
        .where(Workspace.id == workspace_id)
        .with_for_update()
    ).scalar_one()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check idempotency first (if key provided)
    if idempotency_key:
        existing_ledger = session.execute(
            select(BillingLedger)
            .where(
                and_(
                    BillingLedger.workspace_id == workspace_id,
                    BillingLedger.idempotency_key == idempotency_key
                )
            )
        ).scalar_one_or_none()
        
        if existing_ledger:
            # Return existing transaction info
            return workspace, {
                "idempotent": True,
                "existing_ledger_id": existing_ledger.id,
                "amount_cents": existing_ledger.amount_cents,
                "kind": existing_ledger.kind
            }
    
    # Calculate current month-to-date spending within the transaction
    reset_day = workspace.budget_resets_day or 1
    start, end = month_window(datetime.utcnow(), reset_day)
    mtd_spend = sum_ledger(session, workspace_id, start, end)
    
    # Check budget constraints
    budget_check = check_budget(workspace, mtd_spend, amount_cents)
    
    if budget_check["blocked"]:
        if workspace.budget_hard_stop:
            raise HTTPException(
                status_code=402, 
                detail={
                    "error": "budget_exceeded",
                    "message": "Monthly budget limit exceeded",
                    "mtd_spend_cents": mtd_spend,
                    "budget_limit_cents": budget_check["limit"],
                    "threshold_hit": budget_check["threshold_hit"],
                    "operation_kind": operation_kind
                }
            )
        else:
            # Soft stop: proceed but mark as warning
            budget_check["warning"] = True
            budget_check["message"] = "Budget threshold reached but proceeding"
    
    return workspace, budget_check


def atomic_ledger_write(
    session: Session,
    workspace_id: str,
    amount_cents: int,
    currency: str,
    provider: Optional[str],
    kind: str,
    metadata: Optional[dict] = None,
    idempotency_key: Optional[str] = None
) -> BillingLedger:
    """
    Atomic ledger write with budget check
    
    Args:
        session: Database session
        workspace_id: Workspace ID
        amount_cents: Amount in cents
        currency: Currency code
        provider: Provider name
        kind: Transaction type
        metadata: Additional metadata
        idempotency_key: Idempotency key
    
    Returns:
        Created ledger entry
    """
    
    # Perform atomic budget check
    workspace, budget_check = atomic_budget_check(
        session, workspace_id, amount_cents, idempotency_key, kind
    )
    
    # If idempotent, return existing entry
    if budget_check.get("idempotent"):
        return session.execute(
            select(BillingLedger)
            .where(BillingLedger.id == budget_check["existing_ledger_id"])
        ).scalar_one()
    
    # Create new ledger entry
    from uuid import uuid4
    ledger_entry = BillingLedger(
        id=str(uuid4()),
        workspace_id=workspace_id,
        amount_cents=amount_cents,
        currency=currency,
        provider=provider,
        kind=kind,
        metadata_json=metadata or {},
        idempotency_key=idempotency_key
    )
    
    session.add(ledger_entry)
    session.flush()  # Get ID without committing
    
    return ledger_entry


def get_workspace_budget_status(
    session: Session, 
    workspace_id: str
) -> Dict[str, Any]:
    """
    Get current budget status for a workspace
    
    Args:
        session: Database session
        workspace_id: Workspace ID
    
    Returns:
        Budget status information
    """
    
    workspace = session.execute(
        select(Workspace)
        .where(Workspace.id == workspace_id)
    ).scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    reset_day = workspace.budget_resets_day or 1
    start, end = month_window(datetime.utcnow(), reset_day)
    mtd_spend = sum_ledger(session, workspace_id, start, end)
    
    return {
        "workspace_id": workspace_id,
        "monthly_budget_cents": workspace.monthly_budget_cents or 0,
        "budget_currency": workspace.budget_currency or "USD",
        "budget_resets_day": reset_day,
        "budget_hard_stop": bool(workspace.budget_hard_stop),
        "mtd_spend_cents": mtd_spend,
        "remaining_cents": max(0, (workspace.monthly_budget_cents or 0) - mtd_spend),
        "threshold_hit": None,  # Will be calculated if needed
        "billing_period": {
            "start": start.isoformat(),
            "end": end.isoformat()
        }
    }
