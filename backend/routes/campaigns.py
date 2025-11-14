"""Campaign and Lead management endpoints"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import json
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config.database import engine
from models.campaigns import Campaign, Lead
from models.calls import CallRecord
from models.compliance import Disposition
from utils.auth import extract_tenant_id
from utils.tenant import tenant_session
from utils.helpers import country_iso_from_e164

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class CampaignCreate(BaseModel):
    name: str
    status: Optional[str] = "draft"
    agent_id: Optional[str] = None
    from_number_id: Optional[int] = None
    kb_id: Optional[int] = None
    start_date: Optional[str] = None  # ISO 8601 datetime string
    end_date: Optional[str] = None  # ISO 8601 datetime string
    timezone: Optional[str] = "UTC"
    max_calls_per_day: Optional[int] = None
    budget_cents: Optional[int] = None
    cost_per_call_cents: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    agent_id: Optional[str] = None
    from_number_id: Optional[int] = None
    kb_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    timezone: Optional[str] = None
    max_calls_per_day: Optional[int] = None
    budget_cents: Optional[int] = None
    cost_per_call_cents: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class LeadCreate(BaseModel):
    name: str
    phone: str
    company: Optional[str] = None
    preferred_lang: Optional[str] = None
    role: Optional[str] = None
    consent_basis: Optional[str] = None
    consent_status: Optional[str] = None
    campaign_id: Optional[int] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    preferred_lang: Optional[str] = None
    role: Optional[str] = None
    consent_basis: Optional[str] = None
    consent_status: Optional[str] = None
    campaign_id: Optional[int] = None


# ============================================================================
# Campaign Endpoints
# ============================================================================

@router.get("/campaigns")
async def list_campaigns(request: Request) -> List[Dict[str, Any]]:
    """List campaigns"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        q = session.query(Campaign)
        if tenant_id is not None:
            q = q.filter(Campaign.tenant_id == tenant_id)
        rows = q.order_by(Campaign.id.desc()).limit(200).all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "status": c.status,
                "agent_id": c.agent_id,
                "from_number_id": c.from_number_id,
                "calls_made": c.calls_made,
                "calls_successful": c.calls_successful,
                "total_cost_cents": c.total_cost_cents,
                "start_date": c.start_date.isoformat() if c.start_date else None,
                "end_date": c.end_date.isoformat() if c.end_date else None,
                "created_at": c.created_at.isoformat(),
            }
            for c in rows
        ]


@router.post("/campaigns")
async def create_campaign(request: Request, body: CampaignCreate) -> Dict[str, Any]:
    """Create campaign"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        # Parse datetime strings
        start_date = None
        if body.start_date:
            try:
                start_date = datetime.fromisoformat(body.start_date.replace("Z", "+00:00"))
            except Exception:
                pass
        end_date = None
        if body.end_date:
            try:
                end_date = datetime.fromisoformat(body.end_date.replace("Z", "+00:00"))
            except Exception:
                pass
        
        c = Campaign(
            name=body.name,
            status=body.status or "draft",
            tenant_id=tenant_id,
            agent_id=body.agent_id,
            from_number_id=body.from_number_id,
            kb_id=body.kb_id,
            start_date=start_date,
            end_date=end_date,
            timezone=body.timezone or "UTC",
            max_calls_per_day=body.max_calls_per_day,
            budget_cents=body.budget_cents,
            cost_per_call_cents=body.cost_per_call_cents or 100,
            metadata_json=json.dumps(body.metadata) if body.metadata else None,
        )
        session.add(c)
        session.commit()
        session.refresh(c)
        return {
            "ok": True,
            "id": c.id,
            "name": c.name,
            "status": c.status,
            "agent_id": c.agent_id,
            "from_number_id": c.from_number_id,
            "created_at": c.created_at.isoformat(),
        }


@router.get("/campaigns/{campaign_id}")
async def get_campaign(request: Request, campaign_id: int) -> Dict[str, Any]:
    """Get campaign details"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        c = session.get(Campaign, campaign_id)
        if not c or (tenant_id is not None and c.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Load leads count
        leads_count = session.query(Lead).filter(Lead.campaign_id == campaign_id).count()
        
        return {
            "id": c.id,
            "name": c.name,
            "status": c.status,
            "agent_id": c.agent_id,
            "from_number_id": c.from_number_id,
            "kb_id": c.kb_id,
            "start_date": c.start_date.isoformat() if c.start_date else None,
            "end_date": c.end_date.isoformat() if c.end_date else None,
            "timezone": c.timezone,
            "max_calls_per_day": c.max_calls_per_day,
            "budget_cents": c.budget_cents,
            "cost_per_call_cents": c.cost_per_call_cents,
            "calls_made": c.calls_made,
            "calls_successful": c.calls_successful,
            "calls_failed": c.calls_failed,
            "total_cost_cents": c.total_cost_cents,
            "leads_count": leads_count,
            "metadata": json.loads(c.metadata_json) if c.metadata_json else None,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(request: Request, campaign_id: int, body: CampaignUpdate) -> Dict[str, Any]:
    """Update campaign (only if status is draft or paused)"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        c = session.get(Campaign, campaign_id)
        if not c or (tenant_id is not None and c.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Allow updates only if draft or paused
        if c.status not in {"draft", "paused", None}:
            raise HTTPException(status_code=400, detail="Cannot update campaign when status is not draft or paused")
        
        # Update fields
        if body.name is not None:
            c.name = body.name
        if body.status is not None:
            c.status = body.status
        if body.agent_id is not None:
            c.agent_id = body.agent_id
        if body.from_number_id is not None:
            c.from_number_id = body.from_number_id
        if body.kb_id is not None:
            c.kb_id = body.kb_id
        if body.start_date is not None:
            try:
                c.start_date = datetime.fromisoformat(body.start_date.replace("Z", "+00:00"))
            except Exception:
                pass
        if body.end_date is not None:
            try:
                c.end_date = datetime.fromisoformat(body.end_date.replace("Z", "+00:00"))
            except Exception:
                pass
        if body.timezone is not None:
            c.timezone = body.timezone
        if body.max_calls_per_day is not None:
            c.max_calls_per_day = body.max_calls_per_day
        if body.budget_cents is not None:
            c.budget_cents = body.budget_cents
        if body.cost_per_call_cents is not None:
            c.cost_per_call_cents = body.cost_per_call_cents
        if body.metadata is not None:
            c.metadata_json = json.dumps(body.metadata)
        
        c.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(c)
        return {"ok": True, "id": c.id, "status": c.status}


@router.post("/campaigns/{campaign_id}/start")
async def start_campaign(request: Request, campaign_id: int) -> Dict[str, Any]:
    """Start campaign"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        c = session.get(Campaign, campaign_id)
        if not c or (tenant_id is not None and c.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        if c.status not in {"draft", "paused"}:
            raise HTTPException(status_code=400, detail="Campaign can only be started from draft or paused status")
        
        # Validate required fields
        if not c.agent_id:
            raise HTTPException(status_code=400, detail="Campaign must have agent_id to start")
        
        c.status = "scheduled" if c.start_date and c.start_date > datetime.now(timezone.utc) else "running"
        c.updated_at = datetime.now(timezone.utc)
        session.commit()
        return {"ok": True, "status": c.status}


@router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(request: Request, campaign_id: int) -> Dict[str, Any]:
    """Pause campaign"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        c = session.get(Campaign, campaign_id)
        if not c or (tenant_id is not None and c.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        if c.status not in {"scheduled", "running"}:
            raise HTTPException(status_code=400, detail="Campaign can only be paused when scheduled or running")
        
        c.status = "paused"
        c.updated_at = datetime.now(timezone.utc)
        session.commit()
        return {"ok": True, "status": c.status}


@router.post("/campaigns/{campaign_id}/resume")
async def resume_campaign(request: Request, campaign_id: int) -> Dict[str, Any]:
    """Resume paused campaign"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        c = session.get(Campaign, campaign_id)
        if not c or (tenant_id is not None and c.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        if c.status != "paused":
            raise HTTPException(status_code=400, detail="Campaign can only be resumed when paused")
        
        # Determine if scheduled or running based on start_date
        if c.start_date and c.start_date > datetime.now(timezone.utc):
            c.status = "scheduled"
        else:
            c.status = "running"
        c.updated_at = datetime.now(timezone.utc)
        session.commit()
        return {"ok": True, "status": c.status}


@router.post("/campaigns/{campaign_id}/stop")
async def stop_campaign(request: Request, campaign_id: int) -> Dict[str, Any]:
    """Stop campaign definitively"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        c = session.get(Campaign, campaign_id)
        if not c or (tenant_id is not None and c.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        c.status = "cancelled"
        c.updated_at = datetime.now(timezone.utc)
        session.commit()
        return {"ok": True, "status": c.status}


@router.get("/campaigns/{campaign_id}/stats")
async def get_campaign_stats(request: Request, campaign_id: int) -> Dict[str, Any]:
    """Get detailed campaign statistics"""
    tenant_id = extract_tenant_id(request)
    qualified_set = {"qualified", "rfq", "quote_sent", "reorder"}
    with tenant_session(request) as session:
        c = session.get(Campaign, campaign_id)
        if not c or (tenant_id is not None and c.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Leads for this campaign
        leads = session.query(Lead).filter(Lead.campaign_id == campaign_id).all()
        phones = [l.phone for l in leads if l.phone]
        leads_count = len(leads)
        
        calls_count = 0
        calls_successful = 0
        qualified = 0
        
        if phones:
            calls = (
                session.query(CallRecord)
                .filter(CallRecord.to_number.in_(phones))
                .all()
            )
            calls_count = len(calls)
            calls_successful = sum(1 for cl in calls if cl.status == "ended" or cl.status == "completed")
            
            if calls:
                call_ids = [cl.id for cl in calls]
                qd = (
                    session.query(Disposition)
                    .filter(Disposition.call_id.in_(call_ids))
                    .all()
                )
                qualified = sum(1 for d in qd if (d.outcome or "").lower() in qualified_set)
        
        conversion_rate = (qualified / calls_count * 100.0) if calls_count else 0.0
        
        return {
            "campaign_id": campaign_id,
            "status": c.status,
            "leads_count": leads_count,
            "calls_made": calls_count,
            "calls_successful": calls_successful,
            "calls_failed": c.calls_failed,
            "total_cost_cents": c.total_cost_cents,
            "qualified_leads": qualified,
            "conversion_rate": round(conversion_rate, 2),
        }


@router.get("/campaigns/kpi")
async def campaigns_kpi(request: Request) -> List[Dict[str, Any]]:
    """Get campaign KPIs"""
    tenant_id = extract_tenant_id(request)
    qualified_set = {"qualified", "rfq", "quote_sent", "reorder"}
    with tenant_session(request) as session:
        # campaigns
        q = session.query(Campaign)
        if tenant_id is not None:
            q = q.filter(Campaign.tenant_id == tenant_id)
        camps = q.order_by(Campaign.id.desc()).all()
        results: List[Dict[str, Any]] = []
        for c in camps:
            # leads for this campaign
            leads = session.query(Lead).filter(Lead.campaign_id == c.id).all()
            phones = [l.phone for l in leads if l.phone]
            leads_count = len(leads)
            calls_count = 0
            qualified = 0
            if phones:
                calls = (
                    session.query(CallRecord)
                    .filter(CallRecord.to_number.in_(phones))
                    .all()
                )
                calls_count = len(calls)
                if calls:
                    call_ids = [cl.id for cl in calls]
                    qd = (
                        session.query(Disposition)
                        .filter(Disposition.call_id.in_(call_ids))
                        .all()
                    )
                    qualified = sum(1 for d in qd if (d.outcome or "").lower() in qualified_set)
            results.append({
                "id": c.id,
                "name": c.name,
                "status": c.status,
                "leads": leads_count,
                "calls": calls_count,
                "qualified": qualified,
                "qualified_rate": (qualified / calls_count * 100.0) if calls_count else 0.0,
            })
        return results


# ============================================================================
# Lead Endpoints
# ============================================================================

@router.get("/leads")
async def list_leads(
    request: Request,
    campaign_id: Optional[int] = None,
    q: Optional[str] = None,
    country_iso: Optional[str] = None,
    preferred_lang: Optional[str] = None,
    role: Optional[str] = None,
    consent_status: Optional[str] = None,
    created_gte: Optional[str] = None,
    created_lte: Optional[str] = None,
    limit: Optional[int] = 25,
    offset: Optional[int] = 0,
) -> Dict[str, Any]:
    """List leads with filters and pagination"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        query = session.query(Lead)
        if tenant_id is not None:
            query = query.filter(Lead.tenant_id == tenant_id)
        if campaign_id is not None:
            query = query.filter(Lead.campaign_id == campaign_id)
        if country_iso:
            query = query.filter(Lead.country_iso == country_iso)
        if preferred_lang:
            query = query.filter(Lead.preferred_lang == preferred_lang)
        if role:
            query = query.filter(Lead.role == role)
        if consent_status:
            query = query.filter(Lead.consent_status == consent_status)
        if q is not None and q.strip():
            term = f"%{q.strip()}%"
            query = query.filter((Lead.name.like(term)) | (Lead.company.like(term)) | (Lead.phone.like(term)))
        # Date filters ISO 8601
        try:
            if created_gte:
                gte = datetime.fromisoformat(created_gte)
                query = query.filter(Lead.created_at >= gte)
        except Exception:
            pass
        try:
            if created_lte:
                lte = datetime.fromisoformat(created_lte)
                query = query.filter(Lead.created_at <= lte)
        except Exception:
            pass
        total = query.count()
        # Pagination
        safe_limit = max(1, min(int(limit or 25), 100))
        safe_offset = max(0, int(offset or 0))
        rows = (
            query.order_by(Lead.id.desc())
            .offset(safe_offset)
            .limit(safe_limit)
            .all()
        )
        return {
            "total": total,
            "limit": safe_limit,
            "offset": safe_offset,
            "items": [
                {
                    "id": l.id,
                    "name": l.name,
                    "company": l.company,
                    "phone": l.phone,
                    "country_iso": l.country_iso,
                    "preferred_lang": l.preferred_lang,
                    "role": l.role,
                    "consent_basis": l.consent_basis,
                    "consent_status": l.consent_status,
                    "campaign_id": l.campaign_id,
                    "created_at": l.created_at.isoformat(),
                }
                for l in rows
            ],
        }


@router.post("/leads")
async def create_lead(request: Request, body: LeadCreate) -> Dict[str, Any]:
    """Create lead"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        l = Lead(
            tenant_id=tenant_id,
            name=body.name,
            phone=body.phone,
            company=body.company,
            preferred_lang=body.preferred_lang,
            role=body.role,
            consent_basis=body.consent_basis,
            consent_status=body.consent_status or "unknown",
            country_iso=country_iso_from_e164(body.phone),
            campaign_id=body.campaign_id,
        )
        session.add(l)
        session.commit()
    return {"ok": True}


@router.patch("/leads/{lead_id}")
async def update_lead(request: Request, lead_id: int, body: LeadUpdate) -> Dict[str, Any]:
    """Update lead"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        l = session.get(Lead, lead_id)
        if not l or (tenant_id is not None and l.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Lead not found")
        for field in ["name", "phone", "company", "preferred_lang", "role", "consent_basis", "consent_status", "campaign_id"]:
            val = getattr(body, field)
            if val is not None:
                setattr(l, field, val)
        if body.phone is not None:
            l.country_iso = country_iso_from_e164(body.phone)
        session.commit()
    return {"ok": True}


@router.delete("/leads/{lead_id}")
async def delete_lead(request: Request, lead_id: int) -> Dict[str, Any]:
    """Delete lead"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        l = session.get(Lead, lead_id)
        if not l or (tenant_id is not None and l.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Lead not found")
        session.delete(l)
        session.commit()
    return {"ok": True}

