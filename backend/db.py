import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


def _database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        # Forza un connect timeout breve per evitare hang di 135s
        sep = '&' if '?' in url else '?'
        return f"{url}{sep}connect_timeout=5"
    # Fallback to local SQLite for dev
    return "sqlite:///./dev.sqlite3"


DATABASE_URL = _database_url()

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,           # Scarta connessioni morte
    pool_size=3,                  # Piccolo ma prevedibile
    max_overflow=0,               # Evita esplosioni di connessioni
    pool_recycle=1800,            # Ricicla connessioni vecchie (30 min)
    connect_args={
        **connect_args,
        # Per tagliare query bloccate lato server (opzionale ma utile)
        "options": "-c statement_timeout=5000"
    } if not DATABASE_URL.startswith("sqlite") else connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


