#!/usr/bin/env python3
"""
Script per aggiungere le chiavi mancanti ai cataloghi
"""

import json
import re
from pathlib import Path

# Pattern per estrarre chiamate di traduzione dal codice
T_FUNCTION_PATTERNS = [
    r"t\(\s*['\"`]([^'\"`]+)['\"`]\s*,\s*\{([^}]+)\}\s*\)",  # t('key', { params })
    r"t\(\s*['\"`]([^'\"`]+)['\"`]\s*\)",                     # t('key')
]

# Pattern per validare le chiavi
VALID_KEY_PATTERN = re.compile(r'^[a-zA-Z][a-zA-Z0-9._-]*$')

print('=== AGGIUNGENDO CHIAVI MANCANTI ===')

# 1. Scansiona il codice e raccoglie tutte le chiavi
code_keys = set()
for ext in ['*.js', '*.jsx', '*.ts', '*.tsx']:
    for file_path in Path('frontend/src').rglob(ext):
        if not file_path.exists():
            continue
        
        try:
            content = file_path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        
        # Cerca chiamate t() function
        for pattern in T_FUNCTION_PATTERNS:
            for match in re.finditer(pattern, content):
                key = match.group(1)
                # Valida la chiave
                if VALID_KEY_PATTERN.match(key) and len(key) > 1 and not key.startswith('/'):
                    code_keys.add(key)

print(f'Chiavi rilevate nel codice: {len(code_keys)}')

# 2. Carica i cataloghi esistenti
locales_dir = Path('frontend/public/locales')
en_us_dir = locales_dir / 'en-US'

catalogs = {}
for json_file in en_us_dir.glob('*.json'):
    namespace = json_file.stem
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            catalogs[namespace] = data
    except Exception as e:
        print(f'Errore caricamento {json_file}: {e}')

print(f'Cataloghi caricati: {list(catalogs.keys())}')

# 3. Flattening dei cataloghi per la ricerca
def flatten_dict(d, prefix=""):
    for k, v in d.items():
        kk = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            yield from flatten_dict(v, kk)
        else:
            yield kk, v

flat_catalogs = {}
for namespace, catalog in catalogs.items():
    flat_data = dict(flatten_dict(catalog))
    for key, value in flat_data.items():
        # Aggiungi sempre la chiave con prefisso namespace
        full_key = f"{namespace}.{key}"
        flat_catalogs[full_key] = value
        # Aggiungi anche la chiave senza prefisso namespace per compatibilità
        flat_catalogs[key] = value

print(f'Chiavi totali nei cataloghi: {len(flat_catalogs)}')

# 4. Trova chiavi mancanti
missing_keys = []
for key in code_keys:
    if key not in flat_catalogs:
        missing_keys.append(key)

print(f'Chiavi mancanti: {len(missing_keys)}')

# 5. Aggiungi le chiavi mancanti ai cataloghi appropriati
def add_key_to_catalog(key, namespace):
    """Aggiunge una chiave al catalogo appropriato"""
    catalog_file = en_us_dir / f"{namespace}.json"
    
    if not catalog_file.exists():
        print(f"⚠️ File {catalog_file} non esiste")
        return False
    
    try:
        with open(catalog_file, 'r', encoding='utf-8') as f:
            catalog = json.load(f)
        
        # Suddividi la chiave in parti
        if key.startswith(f"{namespace}."):
            # Rimuovi il prefisso namespace
            key_parts = key[len(namespace)+1:].split('.')
        else:
            key_parts = key.split('.')
        
        # Naviga/crea la struttura nested
        current = catalog
        for part in key_parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        
        # Aggiungi la chiave finale
        final_key = key_parts[-1]
        if final_key not in current:
            current[final_key] = f"[{key}]"  # Placeholder
            
            # Salva il file
            with open(catalog_file, 'w', encoding='utf-8') as f:
                json.dump(catalog, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Aggiunta chiave {key} a {namespace}.json")
            return True
    
    except Exception as e:
        print(f"❌ Errore aggiungendo {key} a {namespace}: {e}")
        return False
    
    return False

# 6. Mappa le chiavi ai namespace appropriati
namespace_mapping = {
    'account.': 'settings',
    'import.': 'pages',
    'leads.': 'pages',
    'calendar.': 'pages',
    'analytics.': 'pages',
    'telephony.': 'settings',
    'kb.': 'kb',
    'common.': 'common',
    'auth.': 'auth',
    'billing.': 'billing',
    'integrations.': 'integrations',
    'settings.': 'settings',
    'ui.': 'ui',
    'admin.': 'admin',
    'compliance.': 'compliance',
    'errors.': 'errors',
    'app.': 'app',
}

added_count = 0
for key in missing_keys[:20]:  # Aggiungi solo le prime 20 per test
    # Determina il namespace appropriato
    namespace = 'pages'  # default
    for prefix, ns in namespace_mapping.items():
        if key.startswith(prefix):
            namespace = ns
            break
    
    if add_key_to_catalog(key, namespace):
        added_count += 1

print(f"\n🎉 Aggiunte {added_count} chiavi mancanti ai cataloghi!")
print("Esegui 'python scripts/i18n_check.py' per verificare i risultati.")
