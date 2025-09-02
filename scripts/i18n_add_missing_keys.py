#!/usr/bin/env python3
"""
Script per aggiungere automaticamente le chiavi mancanti ai cataloghi i18n.
Analizza l'output di i18n_scan_code.py e aggiunge solo le chiavi missing ai file en-US.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

def run_scanner():
    """Esegue lo scanner e cattura le chiavi mancanti"""
    try:
        result = subprocess.run([sys.executable, 'scripts/i18n_scan_code.py'], 
                              capture_output=True, text=True, cwd='.')
        return result.stdout
    except Exception as e:
        print(f"❌ Errore eseguendo scanner: {e}")
        sys.exit(1)

def parse_missing_keys(scanner_output):
    """Estrae le chiavi mancanti dall'output dello scanner"""
    missing_keys = []
    lines = scanner_output.split('\n')
    
    for line in lines:
        if '[MISSING KEY]' in line:
            # Esempio: "❌ [MISSING KEY] /auth/login - presente nel codice ma non nei cataloghi"
            parts = line.split('[MISSING KEY]')[1].split(' - ')[0].strip()
            missing_keys.append(parts)
    
    return missing_keys

def categorize_keys(missing_keys):
    """Categorizza le chiavi per namespace"""
    categorized = {}
    
    # Namespace validi per i cataloghi i18n
    valid_namespaces = {
        'ui', 'common', 'pages', 'billing', 'integrations', 
        'admin', 'compliance', 'auth', 'settings', 'errors', 'kb', 'app'
    }
    
    for key in missing_keys:
        # Filtra chiavi non valide
        if not key or key in ['E.164', 'content-type', 'a', 'Moved', 'Annullato', 'q', 'id', 'Paused', 'Resumed', 'Aggiornato', 'token', 'hubspot', 'zoho', 'odoo']:
            print(f"  ⚠️ Ignorando chiave non valida: {key}")
            continue
            
        if key.startswith('/'):
            # Chiavi route-based come /auth/login
            if key.startswith('/auth/'):
                namespace = 'auth'
                clean_key = key.replace('/auth/', '').replace('/', '.')
            elif key.startswith('/kb'):
                namespace = 'kb'
                clean_key = 'index'
            else:
                namespace = 'pages'
                clean_key = key[1:].replace('/', '.')
        elif '.' in key:
            # Chiavi con namespace come common.range
            parts = key.split('.', 1)
            namespace = parts[0]
            clean_key = parts[1]
        else:
            # Default a common
            namespace = 'common'
            clean_key = key
        
        # Verifica che il namespace sia valido
        if namespace in valid_namespaces:
            if namespace not in categorized:
                categorized[namespace] = []
            categorized[namespace].append(clean_key)
        else:
            print(f"  ⚠️ Ignorando namespace non valido '{namespace}' per chiave: {key}")
    
    return categorized

def load_or_create_catalog(namespace):
    """Carica o crea un catalogo esistente"""
    catalog_path = Path(f'frontend/public/locales/en-US/{namespace}.json')
    
    if catalog_path.exists():
        with open(catalog_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        return {}

def add_placeholder_key(catalog, key_path, default_value=None):
    """Aggiunge una chiave con valore placeholder al catalogo"""
    # Naviga/crea la struttura nidificata
    keys = key_path.split('.')
    current = catalog
    
    for key in keys[:-1]:
        if key not in current:
            current[key] = {}
        current = current[key]
    
    final_key = keys[-1]
    if final_key not in current:
        if default_value:
            current[final_key] = default_value
        else:
            # Genera un valore placeholder intelligente
            readable_key = final_key.replace('_', ' ').title()
            current[final_key] = f"[{readable_key}]"

def save_catalog(namespace, catalog):
    """Salva il catalogo con formattazione consistente"""
    catalog_path = Path(f'frontend/public/locales/en-US/{namespace}.json')
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(catalog_path, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2, sort_keys=True)

def main():
    print("🔍 Rilevo chiavi mancanti dai cataloghi i18n...")
    print("=" * 60)
    
    # Esegui scanner
    scanner_output = run_scanner()
    missing_keys = parse_missing_keys(scanner_output)
    
    if not missing_keys:
        print("✅ Nessuna chiave mancante trovata!")
        return
    
    print(f"📋 Trovate {len(missing_keys)} chiavi mancanti:")
    for key in missing_keys:
        print(f"  - {key}")
    
    # Categorizza per namespace
    categorized = categorize_keys(missing_keys)
    print(f"\n📚 Distribuzione per namespace:")
    for ns, keys in categorized.items():
        print(f"  - {ns}: {len(keys)} chiavi")
    
    # Valori predefiniti intelligenti per chiavi comuni
    default_values = {
        'auth': {
            'login': 'Login',
            'totp.verify': 'Verify TOTP Code'
        },
        'common': {
            'range': 'Range',
            'of_total': 'of {total}'
        },
        'integrations': {
            'connected.description': 'Integration connected successfully',
            'disconnected.description': 'Integration disconnected',
            'test.success.description': 'Connection test successful',
            'test.error.description': 'Connection test failed'
        },
        'kb': {
            'index': 'Knowledge Base'
        }
    }
    
    # Aggiungi chiavi ai cataloghi
    print(f"\n🔧 Aggiungendo chiavi ai cataloghi en-US...")
    
    for namespace, keys in categorized.items():
        catalog = load_or_create_catalog(namespace)
        added_count = 0
        
        for key in keys:
            # Cerca valore predefinito
            default_value = None
            if namespace in default_values and key in default_values[namespace]:
                default_value = default_values[namespace][key]
            
            add_placeholder_key(catalog, key, default_value)
            added_count += 1
        
        save_catalog(namespace, catalog)
        print(f"  ✅ {namespace}.json: +{added_count} chiavi")
    
    print(f"\n🚀 Lanciando sincronizzazione DeepL...")
    try:
        sync_result = subprocess.run([sys.executable, 'scripts/i18n_sync.py'], 
                                   capture_output=True, text=True)
        if sync_result.returncode == 0:
            print("  ✅ Sincronizzazione completata")
        else:
            print(f"  ⚠️ Sincronizzazione con warning:\n{sync_result.stdout}")
    except Exception as e:
        print(f"  ❌ Errore sincronizzazione: {e}")
    
    print(f"\n🔍 Validazione finale...")
    try:
        final_result = subprocess.run([sys.executable, 'scripts/i18n_scan_code.py'], 
                                    capture_output=True, text=True)
        final_missing = parse_missing_keys(final_result.stdout)
        
        if not final_missing:
            print("🎉 Validazione PULITA! Tutte le chiavi sono ora presenti.")
        else:
            print(f"⚠️ Rimangono {len(final_missing)} chiavi mancanti:")
            for key in final_missing:
                print(f"  - {key}")
    except Exception as e:
        print(f"❌ Errore validazione finale: {e}")

if __name__ == '__main__':
    main()
