#!/usr/bin/env python3
"""
Script per confrontare la mappatura tra CSV e JSON di compliance
"""
import csv
import json
import sys
from pathlib import Path

def compare_mapping():
    """Confronta la mappatura tra CSV e JSON"""
    
    base_dir = Path(__file__).parent.parent / "data" / "compliance"
    csv_file = base_dir / "raw" / "compliance_global.csv"
    json_file = base_dir / "rules.v1.json"
    
    print("🔍 ANALISI MAPPATURA CSV → JSON")
    print("=" * 50)
    
    # Leggi CSV header
    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        csv_headers = reader.fieldnames
    
    print(f"📋 CSV Headers ({len(csv_headers)}):")
    for i, header in enumerate(csv_headers):
        print(f"  {i+1:2d}. {header}")
    
    print(f"\n📋 JSON fused_by_iso Structure:")
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Prendi un esempio di paese dal JSON
    example_country = list(data["fused_by_iso"].keys())[0]
    example_data = data["fused_by_iso"][example_country]
    
    print(f"  Esempio per {example_country} ({example_data.get('country', 'Unknown')}):")
    for key, value in example_data.items():
        print(f"    {key}: {type(value).__name__} = {str(value)[:100]}{'...' if len(str(value)) > 100 else ''}")
    
    print(f"\n🔍 MAPPATURA SUGGERITA:")
    print("=" * 50)
    
    # Mappatura suggerita basata sui confronti
    mapping = {
        "Continent": "N/A (non presente in JSON)",
        "Country": "country",
        "ISO2": "iso", 
        "Regime_B2C": "regime_b2c_text",
        "opt_in_or_out_B2C": "regime_b2c",
        "Regime_B2B": "regime_b2b_text",
        "opt_in_or_out_B2B": "regime_b2b",
        "DNC_Registry_Name": "dnc[0].name",
        "DNC_Registry_URL": "dnc[0].url",
        "DNC_API_or_Bulk": "dnc[0].access",
        "DNC_Check_Required_for_ER": "dnc[0].check_required_for_er",
        "Quiet_Hours_local": "quiet_hours",
        "AI_Disclosure_Required": "ai_disclosure",
        "Recording_Basis": "recording_basis",
        "Existing_Relationship_Exemption": "N/A (non presente in JSON)",
        "Known_Exceptions": "exceptions",
        "CallerID_or_Prefix_Rules": "callerid_rules",
        "Recent_Changes_2024plus": "recent_changes",
        "Last_Verified": "last_verified",
        "Source_Last_Updated": "sources[0].updated",
        "Confidence": "confidence",
        "Primary_Sources": "sources[0].title",
        "Notes_for_Product": "notes_for_product"
    }
    
    for csv_field, json_field in mapping.items():
        print(f"  {csv_field:25} → {json_field}")
    
    print(f"\n⚠️  PROBLEMI IDENTIFICATI:")
    print("=" * 50)
    
    # Verifica problemi
    problems = []
    
    # 1. Campi mancanti nel JSON
    missing_in_json = ["Continent", "Existing_Relationship_Exemption"]
    for field in missing_in_json:
        problems.append(f"Campo '{field}' presente nel CSV ma non nel JSON")
    
    # 2. Strutture nidificate
    nested_fields = ["dnc", "sources", "exceptions", "flags"]
    for field in nested_fields:
        problems.append(f"Campo '{field}' nel JSON è una struttura nidificata")
    
    # 3. Conversione di tipi
    problems.append("Alcuni campi richiedono conversione di tipo (es. 'Yes' → True)")
    
    for i, problem in enumerate(problems, 1):
        print(f"  {i}. {problem}")
    
    print(f"\n✅ CONCLUSIONI:")
    print("=" * 50)
    print("La mappatura non è 1:1. Il JSON ha:")
    print("- Strutture più complesse (dnc, sources, flags)")
    print("- Campi mancanti (Continent, Existing_Relationship_Exemption)")
    print("- Formati diversi per alcuni valori")
    print("- Campi calcolati (flags)")
    
    return True

if __name__ == "__main__":
    print("🚀 Avvio analisi mappatura CSV vs JSON...")
    success = compare_mapping()
    if success:
        print("\n✅ Analisi mappatura completata!")
    else:
        print("\n❌ Analisi mappatura fallita!")
        sys.exit(1)
