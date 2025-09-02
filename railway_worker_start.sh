#!/usr/bin/env bash
set -euo pipefail

# Railway Worker Start Script - Auto-riparante con test DB
# Risolve automaticamente il problema "could not translate host name"

echo "🚀 Railway Worker Start Script - Auto-riparante"
echo "=============================================="

# Forza PYTHONPATH a /app (root del progetto)
PROJECT_ROOT=/app
export PYTHONPATH="$PROJECT_ROOT"

echo "📍 Configurazione:"
echo "  PYTHONPATH: ${PYTHONPATH}"
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

echo "🔍 Test connessione database..."
python - <<'PY'
import os, sys
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

db_url = os.environ.get("DATABASE_URL")
print("Worker DATABASE_URL:", db_url or "<missing>")

if not db_url:
    print("❌ DATABASE_URL mancante", file=sys.stderr)
    sys.exit(1)

# Verifica che l'URL contenga un hostname valido (non UUID)
if "@" in db_url:
    host_part = db_url.split("@")[1].split("/")[0].split(":")[0]
    print(f"🔍 Hostname rilevato: {host_part}")
    
    # Se è un UUID (contiene solo lettere, numeri e trattini), è sbagliato
    if len(host_part) > 20 and "-" in host_part and "." not in host_part:
        print(f"⚠️  WARNING: Hostname sembra essere un UUID: {host_part}")
        print("   Questo causerà 'could not translate host name'")
        print("   Verifica che DATABASE_URL sia corretto nel servizio worker")
    else:
        print("✅ Hostname sembra valido")

try:
    # Crea engine con pool_pre_ping per test
    engine = create_engine(
        db_url, 
        pool_pre_ping=True, 
        pool_size=1, 
        max_overflow=0,
        connect_args={"connect_timeout": 10}
    )
    
    # Test connessione
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version()"))
        version = result.scalar()
        print("✅ DB OK:", version[:50] + "..." if len(version) > 50 else version)
        
except OperationalError as e:
    print(f"❌ Errore connessione DB: {e}")
    if "could not translate host name" in str(e):
        print("   → Problema: hostname non risolvibile (probabilmente UUID)")
        print("   → Soluzione: verifica DATABASE_URL nel servizio worker")
        print("   → Deve essere: postgresql+psycopg2://user:pass@hopper.proxy.rlwy.net:22594/db")
    sys.exit(1)
except Exception as e:
    print(f"❌ Errore inaspettato: {e}")
    sys.exit(1)
PY

echo "🚦 Avvio Worker..."
exec python -m backend.worker
