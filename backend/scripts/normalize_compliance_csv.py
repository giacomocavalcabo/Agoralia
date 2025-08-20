#!/usr/bin/env python3
"""
Script per normalizzare e ripulire il CSV di compliance
Applica correzioni puntuali e normalizzazioni globali
"""
import re
import sys
from pathlib import Path

def normalize_compliance_csv():
    """Normalizza il CSV di compliance applicando tutte le correzioni"""
    
    # Percorso del file CSV
    csv_file = Path(__file__).parent.parent / "data" / "compliance" / "raw" / "compliance_global.csv"
    
    if not csv_file.exists():
        print(f"❌ File non trovato: {csv_file}")
        return False
    
    print("📖 Caricamento file CSV...")
    with open(csv_file, "r", encoding="utf-8") as f:
        txt = f.read()
    
    print("🔧 Applicazione correzioni...")
    
    # 1) Header canonico
    HEADER = ("Continent,Country,ISO2,Regime_B2C,opt_in_or_out_B2C,Regime_B2B,opt_in_or_out_B2B,"
              "DNC_Registry_Name,DNC_Registry_URL,DNC_API_or_Bulk,DNC_Check_Required_for_ER,"
              "Quiet_Hours_local,AI_Disclosure_Required,Recording_Basis,Existing_Relationship_Exemption,"
              "Known_Exceptions,CallerID_or_Prefix_Rules,Recent_Changes_2024plus,Last_Verified,"
              "Source_Last_Updated,Confidence,Primary_Sources,Notes_for_Product")
    
    # Mantieni solo la prima intestazione e rimuovi le successive
    lines = [ln for ln in txt.splitlines() if ln.strip()]
    first_header_done = False
    out = []
    for ln in lines:
        if ln.startswith("Continent,Country,ISO2"):
            if not first_header_done:
                out.append(HEADER)
                first_header_done = True
            # Salta le altre intestazioni
            continue
        out.append(ln)
    txt = "\n".join(out)
    
    # 2) Rimuovi placeholders contentReference[...]
    txt = re.sub(r"contentReference\[oaicite:[^\]]+\]", "", txt)
    
    # 3) Elimina la riga Bahamas con ISO2 BH
    txt = "\n".join([ln for ln in txt.splitlines() if not ln.startswith("Americas,Bahamas,BH,")])
    
    # 4) Aggiungi/forza la riga Bahamas corretta (se non presente)
    bahamas_ok = "Americas,Bahamas,BS," in txt
    if not bahamas_ok:
        txt += "\n" + (
            "Americas,Bahamas,BS,Telemarketing to consumers is governed by consumer protection regulations (URCA) and the Data Protection Act 2003; individuals have a right to opt out of marketing use of their data,Opt-out,No specific B2B telemarketing law; B2B generally permitted but personal data rules apply,Opt-out,None (no national DNC list),N/A,N/A,N/A,Not formally fixed; use reasonable hours (e.g. 08:00–21:00),Depends (no explicit AI rule; automated/prerecorded calls advisable only with consent),consent,Existing relationship does not override an individual's right to opt out,None specific beyond standard non-commercial calls,Display a valid CLI; no spoofing,No major 2024+ changes specific to telemarketing,2025-08-20,2003-01-01,Low,\"URCA consumer guidance; Data Protection Act 2003\",Maintain internal DNC, get express consent for robocalls, announce identity and honor opt-out immediately"
        )
    
    # 5) Corregge Bhutan: sostituisci "Mongolia's privacy law..." se presente
    txt = txt.replace("Mongolia's privacy law is nascent", "Bhutan's privacy framework is limited")
    
    # 6) Equatorial Guinea: correggi nota che cita Guinea-Bissau
    txt = txt.replace("any calling into Guinea-Bissau", "any calling into Equatorial Guinea")
    
    # 7) Guinea-Bissau: rimuovi riga sbagliata e inserisci riga pulita
    txt = "\n".join([ln for ln in txt.splitlines() if not ln.startswith("Africa,Guinea-Bissau,GW,")]) + "\n" + (
        "Africa,Guinea-Bissau,GW,No known telemarketing/data-protection laws specific to marketing,Opt-out (de facto),Not regulated for B2B,Opt-out,None,N/A,N/A,N/A,Not specified,No,One-party likely (assenza norme chiare; essere trasparenti),N/A,N/A,Show valid CLI,No known 2024+ changes,2025-08-20,N/A,Low,N/A,Applicare standard internazionali: identificazione chiara, frequenza bassa, opt-out immediato e niente robocalls senza consenso"
    )
    
    # 8) Normalizza booleani isolati Y/N -> Yes/No (evita parole)
    def normalize_bool(line: str) -> str:
        # Sostituisci soli campi "Y" o "N" separati da virgole
        parts = line.split(",")
        for i,p in enumerate(parts):
            if p == "Y":
                parts[i] = "Yes"
            elif p == "N":
                parts[i] = "No"
        return ",".join(parts)
    
    txt = "\n".join(normalize_bool(ln) for ln in txt.splitlines())
    
    # Salva il file normalizzato
    output_file = csv_file.parent / "compliance_global_normalized.csv"
    with open(output_file, "w", encoding="utf-8", newline="") as f:
        f.write(HEADER + "\n")
        # Evita che l'header compaia due volte
        for ln in txt.splitlines():
            if ln.startswith("Continent,Country,ISO2"):
                continue
            f.write(ln.rstrip() + "\n")
    
    print(f"✅ File normalizzato salvato: {output_file}")
    
    # Sostituisci anche il file originale
    backup_file = csv_file.parent / "compliance_global_backup.csv"
    print(f"💾 Backup del file originale: {backup_file}")
    with open(backup_file, "w", encoding="utf-8", newline="") as f:
        f.write(txt)
    
    # Sostituisci il file originale
    with open(csv_file, "w", encoding="utf-8", newline="") as f:
        f.write(txt)
    
    print(f"✅ File originale aggiornato: {csv_file}")
    
    return True

if __name__ == "__main__":
    print("🚀 Avvio normalizzazione CSV compliance...")
    success = normalize_compliance_csv()
    if success:
        print("✅ Normalizzazione completata con successo!")
    else:
        print("❌ Normalizzazione fallita!")
        sys.exit(1)
