#!/usr/bin/env python3
"""
Script per rimuovere i duplicati dal CSV mantenendo i secondi
"""
import csv
import sys
from pathlib import Path
from collections import defaultdict

def clean_row(row, fieldnames):
    """Pulisce una riga rimuovendo campi None e extra"""
    cleaned_row = {}
    for field in fieldnames:
        value = row.get(field, '')
        cleaned_row[field] = '' if value is None else str(value)
    return cleaned_row

def remove_csv_duplicates():
    """Rimuove i duplicati dal CSV mantenendo i secondi"""
    
    # Percorso del file CSV
    csv_file = Path(__file__).parent.parent / "data" / "compliance" / "raw" / "compliance_global.csv"
    
    if not csv_file.exists():
        print(f"❌ File non trovato: {csv_file}")
        return False
    
    print("📖 Caricamento file CSV...")
    
    # Leggi tutte le righe
    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)
    
    print(f"📊 Righe totali: {len(rows)}")
    
    # Identifica duplicati
    iso_count = defaultdict(list)
    for i, row in enumerate(rows):
        iso = row.get('ISO2', '')
        if iso and iso != 'ISO2':
            iso_count[iso].append(i)
    
    # Trova duplicati
    duplicates = {iso: indices for iso, indices in iso_count.items() if len(indices) > 1}
    
    if not duplicates:
        print("✅ Nessun duplicato trovato!")
        return True
    
    print(f"🔍 Duplicati trovati: {len(duplicates)}")
    for iso, indices in duplicates.items():
        print(f"  {iso}: righe {indices}")
    
    # Rimuovi i primi duplicati (mantieni i secondi)
    rows_to_remove = []
    for iso, indices in duplicates.items():
        # Mantieni solo l'ultimo (secondo) duplicato
        rows_to_remove.extend(indices[:-1])
    
    print(f"🗑️  Righe da rimuovere: {len(rows_to_remove)}")
    
    # Rimuovi le righe duplicate
    rows_cleaned = [row for i, row in enumerate(rows) if i not in rows_to_remove]
    
    print(f"✅ Righe dopo pulizia: {len(rows_cleaned)}")
    
    # Salva backup (gestisci campi None)
    backup_file = csv_file.parent / "compliance_global_before_dedup.csv"
    print(f"💾 Backup del file originale: {backup_file}")
    
    # Pulisci i dati per il backup
    rows_for_backup = [clean_row(row, fieldnames) for row in rows]
    
    with open(backup_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_for_backup)
    
    # Salva file pulito (gestisci anche qui i campi None)
    rows_for_clean = [clean_row(row, fieldnames) for row in rows_cleaned]
    
    with open(csv_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_for_clean)
    
    print(f"✅ File CSV pulito salvato: {csv_file}")
    
    return True

if __name__ == "__main__":
    print("🚀 Avvio rimozione duplicati CSV...")
    success = remove_csv_duplicates()
    if success:
        print("✅ Rimozione duplicati completata con successo!")
    else:
        print("❌ Rimozione duplicati fallita!")
        sys.exit(1)
