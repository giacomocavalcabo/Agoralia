"""Campaign and Lead management endpoints"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
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
    status: Optional[str] = None


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
        return [{"id": c.id, "name": c.name, "status": c.status} for c in rows]


@router.post("/campaigns")
async def create_campaign(request: Request, body: CampaignCreate) -> Dict[str, Any]:
    """Create campaign"""
    tenant_id = extract_tenant_id(request)
    with tenant_session(request) as session:
        c = Campaign(name=body.name, status=body.status, tenant_id=tenant_id)
        session.add(c)
        session.commit()
        session.refresh(c)
        return {"ok": True, "id": c.id, "name": c.name, "status": c.status}


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

