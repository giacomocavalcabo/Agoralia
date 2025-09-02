#!/usr/bin/env bash
set -euo pipefail
export PYTHONPATH=/app

# ripulisci variabili che possono sporcare libpq/URL
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
unset POSTGRES_HOST POSTGRES_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB
unset DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME
unset SQLALCHEMY_DATABASE_URI

python - << "PY"
import os, re, sys
from sqlalchemy.engine import make_url
from sqlalchemy import create_engine, text

raw = os.getenv("DATABASE_URL")
print("[worker] DATABASE_URL raw:", raw)
if not raw:
    print("[worker] ERROR: DATABASE_URL mancante", file=sys.stderr); sys.exit(1)
raw = raw.strip().strip('"').strip("'")
try:
    url = make_url(raw)
except Exception as e:
    print("[worker] ERROR URL:", e, file=sys.stderr); sys.exit(2)

user, host = url.username, url.host
print(f"[worker] Using host={host}, user={user}")
if re.fullmatch(r"[0-9a-fA-F-]{36}postgresql\\+\\w+", user or ""):
    print("[worker] ERROR: username malformato (concatenazione con driver)", file=sys.stderr); sys.exit(3)

eng = create_engine(raw, pool_pre_ping=True, pool_size=1, max_overflow=0)
with eng.connect() as c:
    v = c.execute(text("select version()")).scalar()
    print("[worker] ✅ DB OK:", v)
PY

exec python -m backend.worker