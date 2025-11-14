"""Settings endpoints"""
import os
import json
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config.database import engine
from models.settings import AppSettings, AppMeta
from services.settings import get_settings, get_meta

router = APIRouter()


@router.get("")
async def get_settings_endpoint() -> Dict[str, Any]:
    """Get all settings"""
    row = get_settings()
    try:
        legal_defaults = json.loads(row.legal_defaults_json or "{}")
    except Exception:
        legal_defaults = {}
    return {
        "default_agent_id": row.default_agent_id,
        "default_from_number": row.default_from_number or os.getenv("DEFAULT_FROM_NUMBER"),
        "default_spacing_ms": row.default_spacing_ms or 1000,
        "require_legal_review": bool(row.require_legal_review or 0),
        "legal_defaults": legal_defaults,
        "budget_monthly": (row.budget_monthly_cents or 0) / 100.0 if (row.budget_monthly_cents or 0) else 0,
        "budget_warn_percent": int(row.budget_warn_percent or 80),
        "budget_stop_enabled": bool(row.budget_stop_enabled or 0),
        "default_lang": row.default_lang or "",
        "supported_langs": (json.loads(row.supported_langs_json) if (row.supported_langs_json or "").strip() else []),
        "prefer_detect_language": bool(row.prefer_detect_language or 0),
        "kb_version_outbound": int(row.kb_version_outbound or 0),
        "kb_version_inbound": int(row.kb_version_inbound or 0),
        "quiet_hours_enabled": bool(row.quiet_hours_enabled or 0),
        "quiet_hours_weekdays": row.quiet_hours_weekdays,
        "quiet_hours_saturday": row.quiet_hours_saturday,
        "quiet_hours_sunday": row.quiet_hours_sunday,
        "quiet_hours_timezone": row.quiet_hours_timezone,
    }


class SettingsUpdate(BaseModel):
    default_agent_id: Optional[str] = None
    default_from_number: Optional[str] = None
    default_spacing_ms: Optional[int] = None
    require_legal_review: Optional[bool] = None
    legal_defaults: Optional[Dict[str, str]] = None
    budget_monthly: Optional[float] = None
    budget_warn_percent: Optional[int] = None
    budget_stop_enabled: Optional[bool] = None
    default_lang: Optional[str] = None
    supported_langs: Optional[List[str]] = None
    prefer_detect_language: Optional[bool] = None
    # Default Quiet Hours
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_weekdays: Optional[str] = None
    quiet_hours_saturday: Optional[str] = None
    quiet_hours_sunday: Optional[str] = None
    quiet_hours_timezone: Optional[str] = None


@router.put("")
async def update_settings(body: SettingsUpdate) -> Dict[str, Any]:
    """Update settings"""
    with Session(engine) as session:
        row = session.query(AppSettings).order_by(AppSettings.id.asc()).first()
        if not row:
            row = AppSettings()
            session.add(row)
        if body.default_agent_id is not None:
            row.default_agent_id = body.default_agent_id
        if body.default_from_number is not None:
            row.default_from_number = body.default_from_number
        if body.default_spacing_ms is not None:
            row.default_spacing_ms = max(0, int(body.default_spacing_ms))
        if body.require_legal_review is not None:
            row.require_legal_review = 1 if body.require_legal_review else 0
        if body.legal_defaults is not None:
            row.legal_defaults_json = json.dumps(body.legal_defaults or {})
        if body.budget_monthly is not None:
            row.budget_monthly_cents = int(round(max(0.0, float(body.budget_monthly)) * 100))
        if body.budget_warn_percent is not None:
            row.budget_warn_percent = max(1, min(100, int(body.budget_warn_percent)))
        if body.budget_stop_enabled is not None:
            row.budget_stop_enabled = 1 if body.budget_stop_enabled else 0
        if body.default_lang is not None:
            row.default_lang = body.default_lang
        if body.supported_langs is not None:
            try:
                row.supported_langs_json = json.dumps(list(body.supported_langs or []))
            except Exception:
                row.supported_langs_json = json.dumps([])
        # Validation: supported_langs must include default_lang
        try:
            supp = json.loads(row.supported_langs_json or "[]")
            if row.default_lang and row.default_lang not in supp:
                raise HTTPException(status_code=400, detail="supported_langs must include default_lang")
        except HTTPException:
            raise
        except Exception:
            pass
        if body.prefer_detect_language is not None:
            row.prefer_detect_language = 1 if body.prefer_detect_language else 0
        if body.quiet_hours_enabled is not None:
            row.quiet_hours_enabled = 1 if body.quiet_hours_enabled else 0
        if body.quiet_hours_weekdays is not None:
            row.quiet_hours_weekdays = body.quiet_hours_weekdays
        if body.quiet_hours_saturday is not None:
            row.quiet_hours_saturday = body.quiet_hours_saturday
        if body.quiet_hours_sunday is not None:
            row.quiet_hours_sunday = body.quiet_hours_sunday
        if body.quiet_hours_timezone is not None:
            row.quiet_hours_timezone = body.quiet_hours_timezone
        session.commit()
    return await get_settings_endpoint()


@router.get("/general")
async def get_settings_general() -> Dict[str, Any]:
    """Get general settings"""
    meta = get_meta()
    s = get_settings()
    return {
        "workspace_name": meta.workspace_name or "",
        "timezone": meta.timezone or "",
        "ui_locale": s.default_lang or "en-US",
        "brand": {"logo_url": meta.brand_logo_url or "", "color": meta.brand_color or "#10a37f"},
    }


class GeneralUpdate(BaseModel):
    workspace_name: Optional[str] = None
    timezone: Optional[str] = None
    ui_locale: Optional[str] = None
    brand: Optional[Dict[str, Any]] = None


@router.put("/general")
async def put_settings_general(body: GeneralUpdate) -> Dict[str, Any]:
    """Update general settings"""
    with Session(engine) as session:
        meta = session.query(AppMeta).order_by(AppMeta.id.asc()).first() or AppMeta()
        session.add(meta)
        if body.workspace_name is not None:
            meta.workspace_name = body.workspace_name
        if body.timezone is not None:
            meta.timezone = body.timezone
        if body.brand is not None:
            meta.brand_logo_url = (body.brand or {}).get("logo_url")
            meta.brand_color = (body.brand or {}).get("color")
        s = session.query(AppSettings).order_by(AppSettings.id.asc()).first() or AppSettings()
        session.add(s)
        if body.ui_locale is not None:
            s.default_lang = body.ui_locale
        session.commit()
    return await get_settings_general()


@router.get("/languages")
async def get_settings_languages() -> Dict[str, Any]:
    """Get language settings"""
    s = get_settings()
    try:
        supported = json.loads(s.supported_langs_json or "[]")
    except Exception:
        supported = []
    return {
        "default_lang": s.default_lang or "",
        "supported_langs": supported,
        "prefer_detect": bool(s.prefer_detect_language or 0),
    }


class LanguagesUpdate(BaseModel):
    default_lang: Optional[str] = None
    supported_langs: Optional[List[str]] = None
    prefer_detect: Optional[bool] = None


@router.put("/languages")
async def put_settings_languages(body: LanguagesUpdate) -> Dict[str, Any]:
    """Update language settings"""
    with Session(engine) as session:
        s = session.query(AppSettings).order_by(AppSettings.id.asc()).first() or AppSettings()
        session.add(s)
        if body.default_lang is not None:
            s.default_lang = body.default_lang
        if body.supported_langs is not None:
            try:
                s.supported_langs_json = json.dumps(list(body.supported_langs or []))
            except Exception:
                s.supported_langs_json = json.dumps([])
        if body.prefer_detect is not None:
            s.prefer_detect_language = 1 if body.prefer_detect else 0
        try:
            supp = json.loads(s.supported_langs_json or "[]")
            if s.default_lang and s.default_lang not in supp:
                raise HTTPException(status_code=400, detail="supported_langs must include default_lang")
        except HTTPException:
            raise
        except Exception:
            pass
        session.commit()
    return await get_settings_languages()


@router.get("/telephony")
async def get_settings_telephony() -> Dict[str, Any]:
    """Get telephony settings"""
    s = get_settings()
    return {
        "default_from_number": s.default_from_number or os.getenv("DEFAULT_FROM_NUMBER"),
        "spacing_ms": s.default_spacing_ms or 1000,
    }


class TelephonyUpdate(BaseModel):
    default_from_number: Optional[str] = None
    spacing_ms: Optional[int] = None


@router.put("/telephony")
async def put_settings_telephony(body: TelephonyUpdate) -> Dict[str, Any]:
    """Update telephony settings"""
    with Session(engine) as session:
        s = session.query(AppSettings).order_by(AppSettings.id.asc()).first() or AppSettings()
        session.add(s)
        if body.default_from_number is not None:
            s.default_from_number = body.default_from_number
        if body.spacing_ms is not None:
            s.default_spacing_ms = max(0, int(body.spacing_ms or 0))
        session.commit()
    return await get_settings_telephony()


@router.get("/compliance")
async def get_settings_compliance() -> Dict[str, Any]:
    """Get compliance settings"""
    s = get_settings()
    try:
        rules = json.loads(s.legal_defaults_json or "{}")
    except Exception:
        rules = {}
    return {
        "require_legal_review": bool(s.require_legal_review or 0),
        "country_rules": rules,
    }


class ComplianceUpdate(BaseModel):
    require_legal_review: Optional[bool] = None
    country_rules: Optional[Dict[str, Any]] = None


@router.put("/compliance")
async def put_settings_compliance(body: ComplianceUpdate) -> Dict[str, Any]:
    """Update compliance settings"""
    with Session(engine) as session:
        s = session.query(AppSettings).order_by(AppSettings.id.asc()).first() or AppSettings()
        session.add(s)
        if body.require_legal_review is not None:
            s.require_legal_review = 1 if body.require_legal_review else 0
        if body.country_rules is not None:
            s.legal_defaults_json = json.dumps(body.country_rules or {})
        session.commit()
    return await get_settings_compliance()

