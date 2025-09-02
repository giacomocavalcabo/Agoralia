#!/usr/bin/env python3
import re
from pathlib import Path

# Pattern per estrarre chiamate di traduzione dal codice
T_FUNCTION_PATTERNS = [
    r"t\(\s*['\"`]([^'\"`]+)['\"`]\s*,\s*\{([^}]+)\}\s*\)",  # t('key', { params })
    r"t\(\s*['\"`]([^'\"`]+)['\"`]\s*\)",                     # t('key')
]

# Scansiona un file di esempio per vedere cosa rileva
test_file = Path('frontend/src/pages/SettingsCompany.jsx')
if test_file.exists():
    content = test_file.read_text(encoding='utf-8')
    print('=== CONTENUTO FILE ===')
    print(content[:500])
    print('\n=== CHIAVI RILEVATE ===')
    for pattern in T_FUNCTION_PATTERNS:
        for match in re.finditer(pattern, content):
            key = match.group(1)
            print(f'Chiave rilevata: {key}')
            if len(match.groups()) > 1:
                print(f'  Parametri: {match.group(2)}')
else:
    print(f'File {test_file} non trovato')
