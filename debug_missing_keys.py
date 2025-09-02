#!/usr/bin/env python3
import re
import json
from pathlib import Path

# Pattern per estrarre chiamate di traduzione dal codice
T_FUNCTION_PATTERNS = [
    r"t\(\s*['\"`]([^'\"`]+)['\"`]\s*,\s*\{([^}]+)\}\s*\)",  # t('key', { params })
    r"t\(\s*['\"`]([^'\"`]+)['\"`]\s*\)",                     # t('key')
]

# Pattern per validare le chiavi
VALID_KEY_PATTERN = re.compile(r'^[a-zA-Z][a-zA-Z0-9._-]*$')

print('=== ANALISI CHIAVI MANCANTI ===')

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

# 3. Verifica quali chiavi del codice sono presenti nei cataloghi
missing_keys = []
for key in code_keys:
    found = False
    
    # Cerca la chiave nei cataloghi
    for namespace, catalog in catalogs.items():
        if key in catalog:
            found = True
            break
        
        # Cerca chiavi nested (es. common.clear_filters -> clear_filters in common.json)
        if '.' in key:
            parts = key.split('.')
            if len(parts) == 2:
                ns, subkey = parts
                if ns == namespace and subkey in catalog:
                    found = True
                    break
    
    if not found:
        missing_keys.append(key)

print(f'\nChiavi mancanti: {len(missing_keys)}')

# 4. Verifica se le chiavi mancanti sono effettivamente usate nel codice
print('\n=== VERIFICA USO NEL CODICE ===')
for key in missing_keys[:10]:  # Verifica solo le prime 10
    print(f'\nChiave: {key}')
    found_in_code = False
    
    for ext in ['*.js', '*.jsx', '*.ts', '*.tsx']:
        for file_path in Path('frontend/src').rglob(ext):
            try:
                content = file_path.read_text(encoding='utf-8')
                if key in content:
                    print(f'  Trovata in: {file_path.relative_to(Path("frontend/src"))}')
                    found_in_code = True
            except UnicodeDecodeError:
                continue
    
    if not found_in_code:
        print(f'  ⚠️  Non trovata nel codice')

# 5. Verifica se le chiavi mancanti sono presenti nei cataloghi target
print('\n=== VERIFICA CATALOGHI TARGET ===')
target_locales = ['it-IT', 'fr-FR', 'es-ES', 'de-DE', 'ar-EG', 'hi-IN']

for locale in target_locales:
    locale_dir = locales_dir / locale
    if not locale_dir.exists():
        continue
    
    print(f'\n{locale}:')
    locale_catalogs = {}
    for json_file in locale_dir.glob('*.json'):
        namespace = json_file.stem
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                locale_catalogs[namespace] = data
        except Exception as e:
            print(f'  Errore caricamento {json_file}: {e}')
    
    # Verifica chiavi mancanti per questo locale
    missing_for_locale = []
    for key in missing_keys[:5]:  # Verifica solo le prime 5
        found = False
        for namespace, catalog in locale_catalogs.items():
            if key in catalog:
                found = True
                break
            if '.' in key:
                parts = key.split('.')
                if len(parts) == 2:
                    ns, subkey = parts
                    if ns == namespace and subkey in catalog:
                        found = True
                        break
        
        if not found:
            missing_for_locale.append(key)
    
    print(f'  Chiavi mancanti: {len(missing_for_locale)}')
    for key in missing_for_locale:
        print(f'    - {key}')
