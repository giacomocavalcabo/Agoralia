#!/usr/bin/env python3
"""
Script per analizzare le differenze tra CSV e JSON di compliance
"""
import csv
import json
import sys
from pathlib import Path

def analyze_differences():
    """Analizza le differenze tra CSV e JSON"""
    
    base_dir = Path(__file__).parent.parent / "data" / "compliance"
    csv_file = base_dir / "raw" / "compliance_global.csv"
    json_file = base_dir / "rules.v1.json"
    
    if not csv_file.exists():
        print(f"❌ File CSV non trovato: {csv_file}")
        return False
    
    if not json_file.exists():
        print(f"❌ File JSON non trovato: {json_file}")
        return False
    
    print("📖 Caricamento file CSV...")
    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        csv_countries = {row['ISO2']: row['Country'] for row in reader if row['ISO2'] and row['ISO2'] != 'ISO2'}
    
    print("📖 Caricamento file JSON...")
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    json_fused = set(data["fused_by_iso"].keys())
    json_countries = set(c["iso"] for c in data["countries"])
    csv_countries_set = set(csv_countries.keys())
    
    print("\n📊 STATISTICHE:")
    print(f"CSV: {len(csv_countries_set)} paesi")
    print(f"JSON fused_by_iso: {len(json_fused)} paesi")
    print(f"JSON countries: {len(json_countries)} paesi")
    
    print("\n🔍 DIFFERENZE CSV vs JSON fused_by_iso:")
    csv_only = csv_countries_set - json_fused
    json_only = json_fused - csv_countries_set
    
    if csv_only:
        print(f"📋 Paesi SOLO nel CSV ({len(csv_only)}):")
        for iso in sorted(csv_only):
            print(f"  {iso}: {csv_countries[iso]}")
    else:
        print("✅ Tutti i paesi del CSV sono presenti nel JSON fused_by_iso")
    
    if json_only:
        print(f"📋 Paesi SOLO nel JSON fused_by_iso ({len(json_only)}):")
        for iso in sorted(json_only):
            country_name = data["fused_by_iso"][iso].get("country", "Unknown")
            print(f"  {iso}: {country_name}")
    else:
        print("✅ Tutti i paesi del JSON fused_by_iso sono presenti nel CSV")
    
    print("\n🔍 DIFFERENZE CSV vs JSON countries:")
    csv_only_countries = csv_countries_set - json_countries
    json_only_countries = json_countries - csv_countries_set
    
    if csv_only_countries:
        print(f"📋 Paesi SOLO nel CSV ({len(csv_only_countries)}):")
        for iso in sorted(csv_only_countries):
            print(f"  {iso}: {csv_countries[iso]}")
    else:
        print("✅ Tutti i paesi del CSV sono presenti nel JSON countries")
    
    if json_only_countries:
        print(f"📋 Paesi SOLO nel JSON countries ({len(json_only_countries)}):")
        for iso in sorted(json_only_countries):
            print(f"  {iso}")
    else:
        print("✅ Tutti i paesi del JSON countries sono presenti nel CSV")
    
    print("\n🔍 PAESI MANCANTI:")
    missing_in_json = csv_only
    missing_in_csv = json_only
    
    if missing_in_json:
        print(f"❌ Mancanti nel JSON fused_by_iso ({len(missing_in_json)}):")
        for iso in sorted(missing_in_json):
            print(f"  {iso}: {csv_countries[iso]}")
    
    if missing_in_csv:
        print(f"❌ Mancanti nel CSV ({len(missing_in_csv)}):")
        for iso in sorted(missing_in_csv):
            country_name = data["fused_by_iso"][iso].get("country", "Unknown")
            print(f"  {iso}: {country_name}")
    
    return True

if __name__ == "__main__":
    print("🚀 Avvio analisi differenze CSV vs JSON...")
    success = analyze_differences()
    if success:
        print("\n✅ Analisi completata!")
    else:
        print("\n❌ Analisi fallita!")
        sys.exit(1)
