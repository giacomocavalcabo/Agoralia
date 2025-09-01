#!/bin/bash

# Railway Start Script - Auto-riparante per Alembic
# Risolve automaticamente il problema "Table already exists"

set -e

echo "🚀 Railway Start Script - Auto-riparante"
echo "========================================"

# Configurazione
export PYTHONPATH=/app
export ALEMBIC_CONFIG=backend/alembic.ini

echo "📍 Configurazione:"
echo "  PYTHONPATH: $PYTHONPATH"
echo "  ALEMBIC_CONFIG: $ALEMBIC_CONFIG"
echo "  DATABASE_URL: ${DATABASE_URL:0:20}..."

# Verifica se la tabella alembic_version esiste
echo "🔍 Verifica tabella alembic_version..."
ALEMBIC_TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.alembic_version');" 2>/dev/null || echo "")

if [ -z "$ALEMBIC_TABLE_EXISTS" ] || [ "$ALEMBIC_TABLE_EXISTS" = "" ]; then
    echo "❌ Tabella alembic_version non esiste"
    echo "🔧 Creazione tabella e stamp a head..."
    alembic stamp head
    echo "✅ Tabella alembic_version creata e timbrata a head"
else
    echo "✅ Tabella alembic_version esiste: $ALEMBIC_TABLE_EXISTS"
    
    # Verifica se è vuota
    VERSION_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM alembic_version;" 2>/dev/null || echo "0")
    
    if [ "$VERSION_COUNT" = "0" ]; then
        echo "⚠️  Tabella alembic_version è vuota"
        echo "🔧 Stamp a head..."
        alembic stamp head
        echo "✅ Stamp a head completato"
    else
        echo "✅ Tabella alembic_version ha $VERSION_COUNT versioni"
    fi
fi

# Esegui le migrazioni (sarà no-op se già a head)
echo "🔄 Esecuzione migrazioni..."
alembic upgrade head
echo "✅ Migrazioni completate"

# Avvia uvicorn
echo "🚀 Avvio uvicorn..."
exec uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1 --loop asyncio --http h11
