"""
Billing and Budget Schemas
Pydantic models for budget management and billing operations
"""

from pydantic import BaseModel, conint, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class BudgetSettings(BaseModel):
    """Budget configuration for a workspace"""
    monthly_budget_cents: conint(ge=0) = Field(0, description="Monthly budget in cents (0 = unlimited)")
    budget_currency: str = Field("USD", description="Budget currency code (3 letters)")
    budget_resets_day: conint(ge=1, le=28) = Field(1, description="Day of month when budget resets (1-28)")
    budget_hard_stop: bool = Field(True, description="Stop operations when budget limit is reached")
    budget_thresholds: List[float] = Field([0.8, 1.0], description="Warning thresholds as percentages")


class BudgetState(BaseModel):
    """Current budget state for a workspace"""
    settings: BudgetSettings
    spend_month_to_date_cents: int = Field(0, description="Spending in current billing period (cents)")
    blocked: bool = Field(False, description="Whether operations are blocked due to budget")
    threshold_hit: Optional[float] = Field(None, description="Current threshold warning level (0.8, 1.0, etc.)")
    billing_period: Optional[Dict[str, str]] = Field(None, description="Current billing period start/end dates")


class LedgerEntry(BaseModel):
    """Individual ledger entry"""
    id: str
    workspace_id: str
    amount_cents: int
    currency: str
    provider: Optional[str] = None
    kind: str
    metadata: Optional[Dict[str, Any]] = Field(None, alias="metadata_json")  # Mappa da metadata_json del DB
    idempotency_key: Optional[str] = None
    created_at: datetime
    
    class Config:
        populate_by_name = True  # Permette sia metadata che metadata_json


class LedgerResponse(BaseModel):
    """Paginated ledger response"""
    entries: List[LedgerEntry]
    total: int
    page: int
    page_size: int
    has_more: bool


class BudgetUpdateRequest(BaseModel):
    """Request to update budget settings"""
    monthly_budget_cents: Optional[conint(ge=0)] = None
    budget_currency: Optional[str] = None
    budget_resets_day: Optional[conint(ge=1, le=28)] = None
    budget_hard_stop: Optional[bool] = None
    budget_thresholds: Optional[List[float]] = None


class BudgetExceededError(BaseModel):
    """Error response when budget is exceeded"""
    error: str = "budget_exceeded"
    message: str = "Monthly budget limit exceeded"
    mtd_spend_cents: int
    budget_limit_cents: int
    threshold_hit: Optional[float] = None


class RateLimitError(BaseModel):
    """Error response when rate limit is exceeded"""
    error: str = "rate_limited"
    message: str = "Rate limit exceeded"
    retry_after_seconds: int
    route: str
    limit: int
    window_seconds: int
