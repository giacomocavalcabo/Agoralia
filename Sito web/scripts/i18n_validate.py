#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validatore i18n per Sito Web
Controlla coerenza placeholder e chiavi mancanti
"""
import json, re, sys
from pathlib import Path

# Configurazione
ROOT = Path(__file__).parent.parent
CONFIG_FILE = ROOT / "i18n.config.json"

def read_json(path):
    if not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Errore lettura {path}: {e}")
        return {}

def load_config():
    if not CONFIG_FILE.exists():
        print(f"❌ Config file non trovato: {CONFIG_FILE}")
        sys.exit(1)
    return read_json(CONFIG_FILE)

config = load_config()
SRC = config["sourceLocale"]
TARGETS = config["targetLocales"]
PRESERVE_PATTERNS = config["preservePatterns"]
LOCALES_DIR = ROOT / config["paths"]["locales"]

# Pattern per placeholder
PH_REGEX = re.compile("|".join(f"({p})" for p in PRESERVE_PATTERNS))

def extract_placeholders(text):
    """Estrae placeholder dal testo"""
    if not isinstance(text, str):
        return set()
    matches = PH_REGEX.findall(text)
    # Flatten tuple results and filter empty strings
    return set(m for match in matches for m in (match if isinstance(match, str) else match) if m)

def flatten_dict(d, prefix=""):
    """Appiattisce dict nidificato"""
    result = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            result.update(flatten_dict(v, key))
        else:
            result[key] = v
    return result

def main():
    print("🔍 Validazione i18n Sito Web")
    print("=" * 50)
    
    # Carica file sorgente
    src_file = LOCALES_DIR / f"{SRC}.json"
    if not src_file.exists():
        print(f"❌ File sorgente non trovato: {src_file}")
        sys.exit(1)
    
    src_data = read_json(src_file)
    src_flat = flatten_dict(src_data)
    
    errors = []
    
    # Valida ogni lingua target
    for target in TARGETS:
        target_file = LOCALES_DIR / f"{target}.json"
        
        if not target_file.exists():
            errors.append(f"[MISSING FILE] {target}.json non trovato")
            continue
        
        target_data = read_json(target_file)
        target_flat = flatten_dict(target_data)
        
        # Controlla chiavi mancanti
        missing_keys = set(src_flat.keys()) - set(target_flat.keys())
        for key in missing_keys:
            errors.append(f"[MISSING KEY] {target}:{key} - presente in {SRC} ma non in {target}")
        
        # Controlla chiavi extra
        extra_keys = set(target_flat.keys()) - set(src_flat.keys())
        for key in extra_keys:
            errors.append(f"[EXTRA KEY] {target}:{key} - presente in {target} ma non in {SRC}")
        
        # Controlla placeholder
        for key in src_flat.keys():
            if key not in target_flat:
                continue
            
            src_text = src_flat[key]
            target_text = target_flat[key]
            
            if not isinstance(src_text, str) or not isinstance(target_text, str):
                continue
            
            src_placeholders = extract_placeholders(src_text)
            target_placeholders = extract_placeholders(target_text)
            
            if src_placeholders != target_placeholders:
                errors.append(f"[PLACEHOLDERS] {target}:{key} {src_placeholders} != {target_placeholders}")
    
    # Report finale
    if errors:
        print(f"\n❌ Validazione fallita con {len(errors)} errore(i):")
        for error in errors:
            print(f"  {error}")
        sys.exit(1)
    else:
        print("✅ Validazione i18n superata.")

if __name__ == "__main__":
    main()
