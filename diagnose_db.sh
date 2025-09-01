#!/bin/bash

# Script di diagnosi per lo stato del database e Alembic
# Esegui: ./diagnose_db.sh

set -e

echo "🔍 Diagnosi Database e Alembic"
echo "=============================="

# Configurazione
export PYTHONPATH=/app
export ALEMBIC_CONFIG=backend/alembic.ini

echo "📍 Configurazione:"
echo "  PYTHONPATH: $PYTHONPATH"
echo "  ALEMBIC_CONFIG: $ALEMBIC_CONFIG"
echo "  DATABASE_URL: ${DATABASE_URL:0:20}..."

echo ""
echo "🔍 1. Verifica tabella alembic_version..."
python - <<'PY'
import os, sys
from sqlalchemy import create_engine, text, inspect

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("❌ DATABASE_URL mancante", file=sys.stderr); sys.exit(1)

try:
    engine = create_engine(db_url, future=True)
    with engine.begin() as conn:
        insp = inspect(conn)
        
        if not insp.has_table("alembic_version", schema="public"):
            print("❌ Tabella alembic_version NON ESISTE")
            print("   → Alembic crede che il DB sia vergine")
            print("   → Proverà a creare tutte le tabelle da zero")
            print("   → Fallirà su tabelle già esistenti")
        else:
            print("✅ Tabella alembic_version ESISTE")
            
            # Verifica lunghezza colonna version_num
            cols = insp.get_columns("alembic_version", schema="public")
            vcol = next((c for c in cols if c["name"]=="version_num"), None)
            
            if vcol:
                col_type = str(vcol["type"])
                print(f"📏 Tipo colonna version_num: {col_type}")
                
                if "varchar" in col_type.lower() and "32" in col_type:
                    print("⚠️  PROBLEMA: Colonna version_num troppo corta (varchar(32))")
                    print("   → Revisioni lunghe come '0020_provider_account_integrations' non ci stanno")
                    print("   → Errore: StringDataRightTruncation")
                else:
                    print("✅ Colonna version_num sufficientemente larga")
            else:
                print("⚠️  Colonna version_num non trovata")
            
            # Verifica contenuto
            result = conn.execute(text("SELECT COUNT(*) FROM alembic_version"))
            version_count = result.scalar()
            
            if version_count == 0:
                print("⚠️  Tabella alembic_version è VUOTA")
                print("   → Alembic crede che il DB sia vergine")
                print("   → Proverà a creare tutte le tabelle da zero")
                print("   → Fallirà su tabelle già esistenti")
            else:
                print(f"✅ Tabella alembic_version ha {version_count} versioni")
                print("📋 Versioni registrate:")
                result = conn.execute(text("SELECT * FROM alembic_version"))
                for row in result:
                    print(f"   {row[0]}")
                    
except Exception as e:
    print(f"❌ Errore nella verifica: {e}")
PY

echo ""
echo "🔍 2. Verifica tabelle esistenti..."
echo "📋 Tabelle nel database:"
python - <<'PY'
import os, sys
from sqlalchemy import create_engine, text, inspect

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("❌ DATABASE_URL mancante", file=sys.stderr); sys.exit(1)

try:
    engine = create_engine(db_url, future=True)
    with engine.begin() as conn:
        insp = inspect(conn)
        tables = insp.get_table_names(schema="public")
        
        if tables:
            for table in sorted(tables):
                print(f"   {table}")
        else:
            print("   Nessuna tabella trovata")
            
except Exception as e:
    print(f"   Errore nella lettura delle tabelle: {e}")
PY

echo ""
echo "🔍 3. Verifica migrazioni disponibili..."
echo "📋 Migrazioni in backend/alembic/versions/:"
ls -la backend/alembic/versions/*.py 2>/dev/null | head -10 || echo "   Errore nella lettura delle migrazioni"

echo ""
echo "🔍 4. Verifica revisione head..."
HEAD_REVISION=$(alembic heads 2>/dev/null || echo "Errore")
echo "📋 Revisione head: $HEAD_REVISION"

echo ""
echo "🔍 5. Verifica stato corrente..."
CURRENT_REVISION=$(alembic current 2>/dev/null || echo "Errore")
echo "📋 Revisione corrente: $CURRENT_REVISION"

echo ""
echo "🎯 DIAGNOSI:"
if [ -z "$ALEMBIC_TABLE_EXISTS" ] || [ "$ALEMBIC_TABLE_EXISTS" = "" ]; then
    echo "❌ PROBLEMA: Tabella alembic_version non esiste"
    echo "💡 SOLUZIONE: Esegui 'alembic stamp head' per crearla e timbrarla"
elif [ "$VERSION_COUNT" = "0" ]; then
    echo "❌ PROBLEMA: Tabella alembic_version è vuota"
    echo "💡 SOLUZIONE: Esegui 'alembic stamp head' per timbrarla"
else
    echo "✅ STATO: Database e Alembic sono allineati"
    echo "💡 Il deploy dovrebbe funzionare correttamente"
fi

echo ""
echo "🔧 COMANDI UTILI:"
echo "   alembic stamp head          # Timbra a head (se tabelle esistono già)"
echo "   alembic upgrade head        # Applica migrazioni mancanti"
echo "   alembic current             # Mostra revisione corrente"
echo "   alembic heads               # Mostra revisione head"
