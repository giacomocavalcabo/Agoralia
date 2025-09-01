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

# --- PREPARA alembic_version CON VARCHAR(255) E TIMBRA A HEAD ---
echo "🔧 Normalizzo tabella alembic_version a varchar(255) e timbro head..."

# 1) Crea tabella se manca (con varchar(255))
psql "$DATABASE_URL" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='alembic_version'
  ) THEN
    CREATE TABLE public.alembic_version (version_num varchar(255) NOT NULL);
  END IF;
END $$;
SQL

# 2) Se esiste ma la colonna è corta (< 64), allarga a varchar(255)
psql "$DATABASE_URL" <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema='public' 
      AND table_name='alembic_version' 
      AND column_name='version_num'
      AND (character_maximum_length IS NOT NULL AND character_maximum_length < 64)
  ) THEN
    ALTER TABLE public.alembic_version 
      ALTER COLUMN version_num TYPE varchar(255);
  END IF;
END $$;
SQL

# 3) Prendi l'ID del head (la stringa che Alembic vuole inserire)
HEAD_REV=$(alembic heads --verbose | awk '/^Rev: /{print $2; exit}')
echo "🔖 Head revision: ${HEAD_REV}"

# 4) Se la tabella è vuota o ha un valore diverso, imposta il valore a head
#    (se già presente uguale, non fa nulla)
CURR_REV=$(psql "$DATABASE_URL" -tAc "SELECT version_num FROM alembic_version LIMIT 1" | tr -d '[:space:]')
if [ -z "$CURR_REV" ]; then
  psql "$DATABASE_URL" -c "INSERT INTO alembic_version(version_num) VALUES ('${HEAD_REV}');"
elif [ "$CURR_REV" != "$HEAD_REV" ]; then
  psql "$DATABASE_URL" -c "UPDATE alembic_version SET version_num='${HEAD_REV}';"
fi

# Esegui le migrazioni (sarà no-op se già a head)
echo "🔄 Esecuzione migrazioni..."
alembic upgrade head
echo "✅ Migrazioni completate"

# Avvia uvicorn
echo "🚀 Avvio uvicorn..."
exec uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1 --loop asyncio --http h11
