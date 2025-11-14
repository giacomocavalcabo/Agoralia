"""Template endpoints"""
from typing import Dict, Any
from fastapi import APIRouter, Request, Body
from pydantic import BaseModel

from models.campaigns import Campaign, Lead
from utils.auth import extract_tenant_id
from utils.tenant import tenant_session

router = APIRouter()


@router.get("/templates")
async def list_templates():
    """List available templates"""
    return {
        "items": [
            {"id": "rfq-it", "name": "RFQ – IT", "lang": "it-IT", "desc": "Richiesta preventivo in italiano"},
            {"id": "demo-fr", "name": "Demo – FR", "lang": "fr-FR", "desc": "Campagna demo in francese"},
            {"id": "reorder-ar", "name": "Reorder – AR", "lang": "ar-EG", "desc": "Riordino clienti in arabo"},
        ]
    }


@router.post("/templates/apply")
async def apply_template(request: Request, payload: Dict[str, Any] = Body(...)):
    """Apply a template to create campaign and leads"""
    tpl_id = (payload or {}).get("template_id")
    if not tpl_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="template_id required")
    
    tenant_id = extract_tenant_id(request)
    lang_map = {"rfq-it": "it-IT", "demo-fr": "fr-FR", "reorder-ar": "ar-EG"}
    default_names = {
        "rfq-it": [
            ("Giulia Rossi", "+39020000001", "Milanotech"),
            ("Luca Bianchi", "+39020000002", "Bianchi SRL"),
            ("Sara Verdi", "+39020000003", "Verdi SpA"),
        ],
        "demo-fr": [
            ("Camille Dupont", "+33170000001", "Dupont SA"),
            ("Louis Martin", "+33170000002", "Martin SARL"),
            ("Emma Bernard", "+33170000003", "Bernard SAS"),
        ],
        "reorder-ar": [
            ("Omar Nasser", "+20220000001", "Nasser Co"),
            ("Layla Hassan", "+20220000002", "Hassan LLC"),
            ("Yusuf Ali", "+20220000003", "Ali Traders"),
        ],
    }
    with tenant_session(request) as session:
        c = Campaign(name=f"{tpl_id}", status="active", tenant_id=tenant_id)
        session.add(c)
        session.commit()
        session.refresh(c)
        lang = lang_map.get(tpl_id, "en-US")
        for nm, ph, co in default_names.get(tpl_id, []):
            l = Lead(
                name=nm,
                phone=ph,
                company=co,
                preferred_lang=lang,
                consent_status="unknown",
                tenant_id=tenant_id,
                campaign_id=c.id,
            )
            session.add(l)
        session.commit()
        return {"ok": True, "campaign_id": c.id, "template_id": tpl_id}

