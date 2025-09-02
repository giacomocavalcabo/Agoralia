#!/usr/bin/env python3
"""
Script per validare le chiavi i18n
Trova chiavi mancanti, duplicate e non utilizzate
"""
import os
import re
import json
from pathlib import Path
from collections import defaultdict

def find_i18n_keys_in_code():
    """Trova tutte le chiavi i18n usate nel codice"""
    keys_used = set()
    
    # Pattern per trovare t('chiave') o t("chiave")
    pattern = r"t\(['\"]([^'\"]+)['\"]"
    
    # Cerca in tutti i file .jsx, .js, .ts, .tsx
    for file_path in Path("frontend/src").rglob("*.{js,jsx,ts,tsx}"):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                matches = re.findall(pattern, content)
                keys_used.update(matches)
        except Exception as e:
            print(f"Errore leggendo {file_path}: {e}")
    
    return keys_used

def load_locale_files():
    """Carica tutti i file di localizzazione"""
    locales = {}
    
    for locale_dir in Path("frontend/public/locales").iterdir():
        if locale_dir.is_dir():
            locale_name = locale_dir.name
            locales[locale_name] = {}
            
            for json_file in locale_dir.glob("*.json"):
                namespace = json_file.stem
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        locales[locale_name][namespace] = json.load(f)
                except Exception as e:
                    print(f"Errore leggendo {json_file}: {e}")
    
    return locales

def flatten_dict(d, prefix=""):
    """Appiattisce un dizionario nidificato"""
    items = []
    for key, value in d.items():
        new_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            items.extend(flatten_dict(value, new_key))
        else:
            items.append(new_key)
    return items

def validate_i18n():
    """Valida le chiavi i18n"""
    print("🔍 Validazione i18n in corso...")
    
    # Trova chiavi usate nel codice
    keys_used = find_i18n_keys_in_code()
    print(f"📝 Trovate {len(keys_used)} chiavi usate nel codice")
    
    # Carica file di localizzazione
    locales = load_locale_files()
    
    # Analizza ogni locale
    for locale_name, namespaces in locales.items():
        print(f"\n🌍 Locale: {locale_name}")
        
        all_keys = set()
        for namespace, data in namespaces.items():
            keys = set(flatten_dict(data))
            all_keys.update(keys)
            print(f"  📁 {namespace}.json: {len(keys)} chiavi")
        
        # Trova chiavi mancanti
        missing_keys = keys_used - all_keys
        if missing_keys:
            print(f"  ❌ Chiavi mancanti ({len(missing_keys)}):")
            for key in sorted(missing_keys):
                print(f"    - {key}")
        
        # Trova chiavi non utilizzate
        unused_keys = all_keys - keys_used
        if unused_keys:
            print(f"  ⚠️  Chiavi non utilizzate ({len(unused_keys)}):")
            for key in sorted(list(unused_keys)[:10]):  # Mostra solo le prime 10
                print(f"    - {key}")
            if len(unused_keys) > 10:
                print(f"    ... e altre {len(unused_keys) - 10}")
    
    # Trova chiavi duplicate tra namespace
    print(f"\n🔄 Controllo duplicati...")
    all_keys_by_namespace = defaultdict(set)
    
    for locale_name, namespaces in locales.items():
        for namespace, data in namespaces.items():
            keys = set(flatten_dict(data))
            for key in keys:
                all_keys_by_namespace[key].add(namespace)
    
    duplicates = {key: namespaces for key, namespaces in all_keys_by_namespace.items() 
                 if len(namespaces) > 1}
    
    if duplicates:
        print(f"  ❌ Chiavi duplicate ({len(duplicates)}):")
        for key, namespaces in sorted(duplicates.items()):
            print(f"    - {key}: {', '.join(namespaces)}")
    else:
        print("  ✅ Nessuna chiave duplicata trovata")
    
    # Riepilogo
    print(f"\n📊 Riepilogo:")
    print(f"  - Chiavi usate nel codice: {len(keys_used)}")
    print(f"  - Locale disponibili: {len(locales)}")
    print(f"  - Chiavi duplicate: {len(duplicates)}")
    
    total_missing = 0
    for namespaces in locales.values():
        all_keys = set()
        for data in namespaces.values():
            all_keys.update(flatten_dict(data))
        total_missing += len(keys_used - all_keys)
    print(f"  - Chiavi mancanti totali: {total_missing}")

if __name__ == "__main__":
    validate_i18n()
