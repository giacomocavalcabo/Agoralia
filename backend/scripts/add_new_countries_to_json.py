#!/usr/bin/env python3
"""
Script per aggiungere nuovi paesi al file JSON di compliance
"""
import json
import sys
from pathlib import Path

def add_new_countries():
    """Aggiunge i nuovi paesi al file JSON di compliance"""
    
    # Percorso del file JSON
    json_file = Path(__file__).parent.parent / "data" / "compliance" / "rules.v1.json"
    
    if not json_file.exists():
        print(f"❌ File non trovato: {json_file}")
        return False
    
    print("📖 Caricamento file JSON...")
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Nuovi paesi da aggiungere
    new_countries = [
        {
            "region": "Europe",
            "country": "Belarus",
            "iso2": "BY",
            "regimeB2C": "Written opt-in consent required",
            "optInOrOutB2C": "Opt-in",
            "regimeB2B": "No specific B2B regulation",
            "optInOrOutB2B": "Not specified",
            "dncRegistryName": "None",
            "dncRegistryURL": "",
            "dncAPIorBulk": "Not applicable",
            "dncCheckRequiredForER": "Not applicable",
            "quietHours": "Not specified",
            "aiDisclosureRequired": "Not specified",
            "recordingBasis": "Consent",
            "existingRelationshipExemption": "None",
            "knownExceptions": "None",
            "callerIDPrefixRules": "No specific rules",
            "recentChanges": "2021 law amendment prohibits unsolicited calls",
            "lastVerified": "2025-08-19",
            "primarySources": "Law on Advertising (2021)",
            "notesForProduct": "No DNC; must stop on request",
            "sourceLastUpdated": "2021-07-08",
            "confidence": "Low"
        },
        {
            "region": "Africa",
            "country": "Eritrea",
            "iso2": "ER",
            "regimeB2C": "No specific telemarketing regulation found",
            "optInOrOutB2C": "Not specified (liberal approach)",
            "regimeB2B": "No specific B2B telemarketing regulation found",
            "optInOrOutB2B": "Not specified",
            "dncRegistryName": "None",
            "dncRegistryURL": "",
            "dncAPIorBulk": "Not applicable",
            "dncCheckRequiredForER": "Not applicable",
            "quietHours": "Not specified",
            "aiDisclosureRequired": "Not specified",
            "recordingBasis": "Not specified",
            "existingRelationshipExemption": "Not applicable",
            "knownExceptions": "None",
            "callerIDPrefixRules": "No specific rules",
            "recentChanges": "None known",
            "lastVerified": "2025-08-19",
            "primarySources": "LawGratis (secondary)",
            "notesForProduct": "No DNC; no telemarketing law found; liberal approach",
            "sourceLastUpdated": "2025-04-11",
            "confidence": "Medium"
        },
        {
            "region": "Asia",
            "country": "North Korea",
            "iso2": "KP",
            "regimeB2C": "State-run telecom; no consumer marketing law",
            "optInOrOutB2C": "Not applicable",
            "regimeB2B": "Not applicable",
            "optInOrOutB2B": "Not applicable",
            "dncRegistryName": "",
            "dncRegistryURL": "",
            "dncAPIorBulk": "Not applicable",
            "dncCheckRequiredForER": "Not applicable",
            "quietHours": "Not specified",
            "aiDisclosureRequired": "Not applicable",
            "recordingBasis": "Not specified",
            "existingRelationshipExemption": "Not applicable",
            "knownExceptions": "None",
            "callerIDPrefixRules": "No specific rules",
            "recentChanges": "None known",
            "lastVerified": "2025-09-24",
            "primarySources": "Amnesty Int'l report (EN)",
            "notesForProduct": "All telecoms under state control; assume no marketing allowed",
            "sourceLastUpdated": "",
            "confidence": "Low"
        },
        {
            "region": "Asia",
            "country": "Kazakhstan",
            "iso2": "KZ",
            "regimeB2C": "No special telemarketing law (calls allowed)",
            "optInOrOutB2C": "Opt-out (no consent required)",
            "regimeB2B": "Not specifically regulated",
            "optInOrOutB2B": "Not specified",
            "dncRegistryName": "",
            "dncRegistryURL": "",
            "dncAPIorBulk": "Not applicable",
            "dncCheckRequiredForER": "Not applicable",
            "quietHours": "Not specified",
            "aiDisclosureRequired": "Not specified",
            "recordingBasis": "Consent (privacy of calls guaranteed)",
            "existingRelationshipExemption": "Not specified",
            "knownExceptions": "None",
            "callerIDPrefixRules": "No specific rules",
            "recentChanges": "None known",
            "lastVerified": "2025-09-24",
            "primarySources": "Gazeta NV (ad law) (RU); Constitution Art.31 (RU)",
            "notesForProduct": "No opt-in required; calls are private (Art.31)",
            "sourceLastUpdated": "2014-01-12",
            "confidence": "Medium"
        },
        {
            "region": "Asia",
            "country": "Tajikistan",
            "iso2": "TJ",
            "regimeB2C": "Personal data law requires consent",
            "optInOrOutB2C": "Opt-in (subject consent needed)",
            "regimeB2B": "Not specifically regulated",
            "optInOrOutB2B": "Not specified",
            "dncRegistryName": "",
            "dncRegistryURL": "",
            "dncAPIorBulk": "Not applicable",
            "dncCheckRequiredForER": "Not applicable",
            "quietHours": "Not specified",
            "aiDisclosureRequired": "Not specified",
            "recordingBasis": "Consent (PD law requires consent)",
            "existingRelationshipExemption": "Not specified",
            "knownExceptions": "None",
            "callerIDPrefixRules": "No specific rules",
            "recentChanges": "None known",
            "lastVerified": "2025-09-24",
            "primarySources": "PD Law 2018 (EN)",
            "notesForProduct": "Personal data processing needs consent; no telemarketing-specific laws",
            "sourceLastUpdated": "2019-04-04",
            "confidence": "High"
        },
        {
            "region": "Asia",
            "country": "Turkmenistan",
            "iso2": "TM",
            "regimeB2C": "Advertising law bans using personal data for ads",
            "optInOrOutB2C": "Opt-in (personal data use prohibited)",
            "regimeB2B": "Not specifically regulated",
            "optInOrOutB2B": "Not specified",
            "dncRegistryName": "",
            "dncRegistryURL": "",
            "dncAPIorBulk": "Not applicable",
            "dncCheckRequiredForER": "Not applicable",
            "quietHours": "Not specified",
            "aiDisclosureRequired": "Not specified",
            "recordingBasis": "Consent (personal data protected)",
            "existingRelationshipExemption": "Not specified",
            "knownExceptions": "None",
            "callerIDPrefixRules": "No specific rules",
            "recentChanges": "None known",
            "lastVerified": "2025-09-24",
            "primarySources": "Advertising Law Art.5(8) (EN)",
            "notesForProduct": "Personal data cannot be used for marketing",
            "sourceLastUpdated": "2017-07-05",
            "confidence": "Medium"
        },
        {
            "region": "Asia",
            "country": "Yemen",
            "iso2": "YE",
            "regimeB2C": "No specific telemarketing/DNC regime found",
            "optInOrOutB2C": "Not specified",
            "regimeB2B": "No specific B2B telemarketing regulation found",
            "optInOrOutB2B": "Not specified",
            "dncRegistryName": "None",
            "dncRegistryURL": "",
            "dncAPIorBulk": "Not applicable",
            "dncCheckRequiredForER": "Not applicable",
            "quietHours": "Not specified",
            "aiDisclosureRequired": "Not specified",
            "recordingBasis": "Consent (recommended)",
            "existingRelationshipExemption": "Not specified",
            "knownExceptions": "None",
            "callerIDPrefixRules": "Display valid CLI",
            "recentChanges": "No telemarketing-specific updates located",
            "lastVerified": "2025-08-18",
            "primarySources": "Ministry of Industry & Trade (moit.gov.ye); Public telecom portal (ptic.gov.ye) (availability varies)",
            "notesForProduct": "Conservative defaults; no robocalls; provide opt-out",
            "sourceLastUpdated": "2020-01-01",
            "confidence": "Low"
        }
    ]
    
    print("🔧 Aggiunta nuovi paesi a fused_by_iso...")
    
    # Aggiungi alla sezione fused_by_iso
    for country in new_countries:
        iso = country["iso2"]
        if iso not in data["fused_by_iso"]:
            # Converti il formato per fused_by_iso
            fused_entry = {
                "country": country["country"],
                "iso": country["iso2"],
                "regime_b2c": country["optInOrOutB2C"].lower().replace(" ", "_") if country["optInOrOutB2C"] != "Not specified" else "unknown",
                "regime_b2b": country["optInOrOutB2B"].lower().replace(" ", "_") if country["optInOrOutB2B"] != "Not specified" else "unknown",
                "quiet_hours": None if country["quietHours"] == "Not specified" else country["quietHours"],
                "ai_disclosure": country["aiDisclosureRequired"].lower().replace(" ", "_") if country["aiDisclosureRequired"] != "Not specified" else "unknown",
                "recording_basis": country["recordingBasis"].lower().replace(" ", "_") if country["recordingBasis"] != "Not specified" else "unknown",
                "callerid_rules": country["callerIDPrefixRules"],
                "recent_changes": country["recentChanges"] if country["recentChanges"] != "None known" else None,
                "last_verified": country["lastVerified"],
                "confidence": country["confidence"].lower(),
                "confidence_score": None,
                "regime_b2c_text": country["regimeB2C"],
                "regime_b2b_text": country["regimeB2B"],
                "notes_for_product": country["notesForProduct"],
                "dnc": [
                    {
                        "name": country["dncRegistryName"] if country["dncRegistryName"] != "None" else "None",
                        "url": country["dncRegistryURL"],
                        "access": "unknown",
                        "check_required_for_er": False
                    }
                ],
                "sources": [
                    {
                        "title": country["primarySources"],
                        "url": None,
                        "updated": country["sourceLastUpdated"] if country["sourceLastUpdated"] else None
                    }
                ],
                "exceptions": [],
                "flags": {
                    "requires_consent_b2c": "opt-in" in country["optInOrOutB2C"].lower(),
                    "requires_consent_b2b": "opt-in" in country["optInOrOutB2B"].lower(),
                    "requires_dnc_scrub": country["dncRegistryName"] != "None",
                    "allows_automated": True,
                    "recording_requires_consent": "consent" in country["recordingBasis"].lower(),
                    "has_quiet_hours": country["quietHours"] != "Not specified"
                }
            }
            data["fused_by_iso"][iso] = fused_entry
            print(f"✅ Aggiunto {iso} ({country['country']}) a fused_by_iso")
        else:
            print(f"⚠️  {iso} ({country['country']}) già presente in fused_by_iso")
    
    print("🔧 Aggiunta nuovi paesi a countries...")
    
    # Aggiungi alla sezione countries
    for country in new_countries:
        iso = country["iso2"]
        # Verifica se già presente
        if not any(c.get("iso") == iso for c in data["countries"]):
            country_entry = {
                "iso": iso,
                "confidence": country["confidence"].lower(),
                "last_verified": country["lastVerified"]
            }
            data["countries"].append(country_entry)
            print(f"✅ Aggiunto {iso} ({country['country']}) a countries")
        else:
            print(f"⚠️  {iso} ({country['country']}) già presente in countries")
    
    # Salva il file aggiornato
    backup_file = json_file.parent / "rules.v1_backup.json"
    print(f"💾 Backup del file originale: {backup_file}")
    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Aggiorna il file originale
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ File JSON aggiornato: {json_file}")
    
    return True

if __name__ == "__main__":
    print("🚀 Avvio aggiunta nuovi paesi al JSON...")
    success = add_new_countries()
    if success:
        print("✅ Aggiunta nuovi paesi completata con successo!")
    else:
        print("❌ Aggiunta nuovi paesi fallita!")
        sys.exit(1)
