import os
import uuid
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import (
    create_engine,
    String,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship, sessionmaker, Session
from passlib.context import CryptContext
from jose import jwt, JWTError

DATABASE_URL = os.getenv("DATABASE_URL", "")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
JWT_ALG = "HS256"
JWT_TTL_MIN = 60 * 24 * 7  # 7 days

if not DATABASE_URL:
    # Allow startup even without DB for local build; endpoints will fail with 503
    engine = None
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True) if engine else None
Base = declarative_base()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"ws_{uuid.uuid4().hex}")
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    members: Mapped[list["Membership"]] = relationship("Membership", back_populates="workspace")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"usr_{uuid.uuid4().hex}")
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    memberships: Mapped[list["Membership"]] = relationship("Membership", back_populates="user")


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "workspace_id", name="uq_membership_user_ws"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"mem_{uuid.uuid4().hex}")
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    workspace_id: Mapped[str] = mapped_column(String, ForeignKey("workspaces.id"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False, default="member")  # admin | member
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped[User] = relationship("User", back_populates="memberships")
    workspace: Mapped[Workspace] = relationship("Workspace", back_populates="members")


# Pydantic schemas
class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1)
    password: str = Field(min_length=6)


class RegisterResponse(BaseModel):
    user_id: str
    workspace_id: str
    token: str


class UserUpdateRequest(BaseModel):
    name: str | None = None
    current_password: str | None = None
    new_password: str | None = None


class WorkspaceUpdateRequest(BaseModel):
    name: str


def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_password(raw: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    return pwd_context.verify(raw, hashed)


def create_token(user_id: str, workspace_id: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=JWT_TTL_MIN)
    payload = {"sub": user_id, "ws": workspace_id, "exp": exp}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> tuple[str, str]:
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return data.get("sub"), data.get("ws")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"invalid_token: {e}")


def get_db() -> Session:
    if not SessionLocal:
        raise HTTPException(status_code=503, detail="database_unavailable")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app = FastAPI(title="ColdAI Backend", version="0.0.1")


@app.get("/health")
def health():
    return {"ok": True}


@app.on_event("startup")
def _on_startup() -> None:
    if engine:
        Base.metadata.create_all(bind=engine)


@app.post("/api/auth/register", response_model=RegisterResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    # check email unique
    exists = db.query(User).filter(User.email == body.email).first()
    if exists:
        raise HTTPException(status_code=409, detail="email_taken")

    ws = Workspace(name=f"{body.name}'s Workspace")
    user = User(email=body.email, name=body.name, password_hash=hash_password(body.password))
    db.add(ws)
    db.add(user)
    db.flush()

    mem = Membership(user_id=user.id, workspace_id=ws.id, role="admin")
    db.add(mem)
    db.commit()

    token = create_token(user.id, ws.id)
    return RegisterResponse(user_id=user.id, workspace_id=ws.id, token=token)


def auth_guard(authorization: str = Header(None)) -> tuple[str, str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    token = authorization.split(" ", 1)[1]
    return decode_token(token)


@app.patch("/api/user/update")
def update_user(body: UserUpdateRequest, db: Session = Depends(get_db), ident: tuple[str, str] = Depends(auth_guard)):
    user_id, _ = ident
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")

    if body.name:
        user.name = body.name

    if body.new_password:
        # If user has existing password, require current_password match
        if user.password_hash and not (body.current_password and verify_password(body.current_password, user.password_hash)):
            raise HTTPException(status_code=400, detail="invalid_current_password")
        user.password_hash = hash_password(body.new_password)

    db.commit()
    return {"ok": True}


@app.patch("/api/workspace/update")
def update_workspace(body: WorkspaceUpdateRequest, db: Session = Depends(get_db), ident: tuple[str, str] = Depends(auth_guard)):
    user_id, ws_id = ident
    # verify admin
    mem = (
        db.query(Membership)
        .filter(Membership.user_id == user_id, Membership.workspace_id == ws_id)
        .first()
    )
    if not mem:
        raise HTTPException(status_code=403, detail="not_a_member")
    if mem.role != "admin":
        raise HTTPException(status_code=403, detail="not_admin")

    ws = db.query(Workspace).filter(Workspace.id == ws_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="workspace_not_found")

    ws.name = body.name
    db.commit()
    return {"ok": True}
