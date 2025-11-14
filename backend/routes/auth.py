"""Authentication endpoints"""
import os
from typing import Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config.database import engine
from models.users import User
from utils.auth import extract_tenant_id, _hash_password, _verify_password, _encode_token

router = APIRouter()


class AuthRegister(BaseModel):
    email: str
    password: str
    name: str | None = None
    admin_secret: str | None = None


class AuthLogin(BaseModel):
    email: str
    password: str


@router.post("/register")
async def auth_register(body: AuthRegister):
    """Register new user"""
    with Session(engine) as session:
        existing = session.query(User).filter(User.email == body.email.lower()).one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="email exists")
        salt, h = _hash_password(body.password)
        is_admin = 1 if (body.admin_secret and body.admin_secret == os.getenv("ADMIN_SIGNUP_SECRET")) else 0
        user = User(tenant_id=0, email=body.email.lower(), name=body.name, password_salt=salt, password_hash=h, is_admin=is_admin)
        session.add(user)
        session.commit()
        user.tenant_id = user.id
        session.commit()
        token = _encode_token({
            "sub": user.id,
            "tenant_id": user.tenant_id,
            "is_admin": bool(user.is_admin),
            "exp": (datetime.now(timezone.utc) + timedelta(days=7)).timestamp()
        })
        return {"token": token, "tenant_id": user.tenant_id, "is_admin": bool(user.is_admin)}


@router.post("/login")
async def auth_login(body: AuthLogin):
    """Login user"""
    with Session(engine) as session:
        user = session.query(User).filter(User.email == body.email.lower()).one_or_none()
        if not user or not _verify_password(body.password, user.password_salt, user.password_hash):
            raise HTTPException(status_code=401, detail="invalid credentials")
        token = _encode_token({
            "sub": user.id,
            "tenant_id": user.tenant_id,
            "is_admin": bool(user.is_admin),
            "exp": (datetime.now(timezone.utc) + timedelta(days=7)).timestamp()
        })
        return {"token": token, "tenant_id": user.tenant_id, "is_admin": bool(user.is_admin)}

