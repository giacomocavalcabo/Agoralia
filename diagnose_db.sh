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
ALEMBIC_TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.alembic_version');" 2>/dev/null || echo "")

if [ -z "$ALEMBIC_TABLE_EXISTS" ] || [ "$ALEMBIC_TABLE_EXISTS" = "" ]; then
    echo "❌ Tabella alembic_version NON ESISTE"
    echo "   → Alembic crede che il DB sia vergine"
    echo "   → Proverà a creare tutte le tabelle da zero"
    echo "   → Fallirà su tabelle già esistenti"
else
    echo "✅ Tabella alembic_version ESISTE: $ALEMBIC_TABLE_EXISTS"
    
    # Verifica contenuto
    VERSION_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM alembic_version;" 2>/dev/null || echo "0")
    
    if [ "$VERSION_COUNT" = "0" ]; then
        echo "⚠️  Tabella alembic_version è VUOTA"
        echo "   → Alembic crede che il DB sia vergine"
        echo "   → Proverà a creare tutte le tabelle da zero"
        echo "   → Fallirà su tabelle già esistenti"
    else
        echo "✅ Tabella alembic_version ha $VERSION_COUNT versioni"
        echo "📋 Versioni registrate:"
        psql "$DATABASE_URL" -c "SELECT * FROM alembic_version;" 2>/dev/null || echo "   Errore nella lettura"
    fi
fi

echo ""
echo "🔍 2. Verifica tabelle esistenti..."
echo "📋 Tabelle nel database:"
psql "$DATABASE_URL" -c "\dt" 2>/dev/null || echo "   Errore nella lettura delle tabelle"

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
