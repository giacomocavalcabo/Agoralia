#!/usr/bin/env bash
set -euo pipefail

# Forza PYTHONPATH a /app (root del progetto)
PROJECT_ROOT=/app
export PYTHONPATH="$PROJECT_ROOT"
export ALEMBIC_CONFIG=${ALEMBIC_CONFIG:-backend/alembic.ini}

echo "🚀 Railway Start Script - Auto-riparante"
echo "📍 Configurazione:"
echo "  PYTHONPATH: ${PYTHONPATH}"
echo "  ALEMBIC_CONFIG: ${ALEMBIC_CONFIG}"
echo "  DATABASE_URL: ${DATABASE_URL:-<missing>}"

echo "🧪 Verifico che 'import backend' funzioni..."
python - <<'PY'
import sys, os
try:
    import backend
    print("✅ import backend OK - path:", os.path.dirname(backend.__file__))
except Exception as e:
    print("❌ import backend FAILED:", e)
    print("sys.path:", sys.path)
    raise
PY

echo "🔧 Normalizzo tabella alembic_version a varchar(255)..."
python - <<'PY'
import os, sys
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import ProgrammingError

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("❌ DATABASE_URL mancante", file=sys.stderr); sys.exit(1)

engine = create_engine(db_url, future=True)

with engine.begin() as conn:
    insp = inspect(conn)
    # 1) Crea tabella se manca (con varchar(255))
    if not insp.has_table("alembic_version", schema="public"):
        conn.execute(text("CREATE TABLE public.alembic_version (version_num varchar(255) NOT NULL)"))
        print("✅ Creata tabella public.alembic_version con varchar(255)")
    else:
        # 2) Allarga la colonna se troppo corta
        cols = insp.get_columns("alembic_version", schema="public")
        vcol = next((c for c in cols if c["name"]=="version_num"), None)
        if vcol is None:
            conn.execute(text("ALTER TABLE public.alembic_version ADD COLUMN version_num varchar(255) NOT NULL"))
            print("✅ Aggiunta colonna version_num varchar(255)")
        else:
            # alcuni driver non riportano lunghezza, gestisci comunque l'ALTER in try/except
            try:
                conn.execute(text("ALTER TABLE public.alembic_version ALTER COLUMN version_num TYPE varchar(255)"))
                print("✅ Normalizzata version_num a varchar(255)")
            except ProgrammingError:
                # tipo già abbastanza largo / nessun cambio
                print("ℹ️  Nessun cambio necessario al tipo di version_num")
print("👌 Tabella/colonna pronta.")
PY

echo "🔖 Stamp a head con Alembic..."
PYTHONPATH=/app alembic -c "${ALEMBIC_CONFIG}" stamp head

echo "⬆️  Upgrade head (no-op se già a posto)..."
PYTHONPATH=/app alembic -c "${ALEMBIC_CONFIG}" upgrade head

echo "🚦 Avvio Uvicorn..."
exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --loop asyncio --http h11
