#!/usr/bin/env python3
"""
Script di CHECK completo per validare la situazione i18n
- Scansiona il codice per estrarre chiavi usate
- Verifica allineamento tra codice e cataloghi
- Controlla placeholder e struttura
- Report dettagliato di problemi e stato
"""

import json
import os
import re
from pathlib import Path
from typing import Dict, Set, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "i18n.config.json").read_text())
SRC = CFG["sourceLocale"]
TARGETS = CFG["targetLocales"]

# Pattern per estrarre chiamate di traduzione dal codice
T_FUNCTION_PATTERNS = [
    r"t\(\s*['\"`]([^'\"`]+)['\"`]\s*,\s*\{([^}]+)\}\s*\)",  # t('key', { params })
    r"t\(\s*['\"`]([^'\"`]+)['\"`]\s*\)",                     # t('key')
]

TRANS_COMPONENT_PATTERNS = [
    r"<Trans[^>]*i18nKey=['\"`]([^'\"`]+)['\"`][^>]*values=\{\{([^}]+)\}\}[^>]*>",
]

# Pattern per placeholder
PLACEHOLDER_PATTERNS = [
    r"\{\{\s*[\w.-]+\s*\}\}",                               # {{name}}
    r"\{\s*[\w.-]+(?:\s*,\s*[\w\s,{}]+)?\}",               # {name} o ICU
    r"%\{[\w.-]+\}",                                        # %{name}
    r"%\([\w.-]+\)s",                                       # %(name)s
    r":\b[\w.-]+\b",                                        # :name
    r"\$\{[\w.-]+\}",                                       # ${name}
    r"</?[\w-]+(?:\s+[^>]*)?>|<\d+>|</\d+>"               # tags
]

VALID_KEY_PATTERN = re.compile(r'^[a-zA-Z][a-zA-Z0-9._/-]*$')
PLACEHOLDER_RE = re.compile("(" + "|".join(PLACEHOLDER_PATTERNS) + ")")

# Chiavi da ignorare (non sono chiavi di traduzione)
IGNORE_KEYS = {
    'en-GB', 'en-US', 'it-IT', 'fr-FR', 'es-ES', 'de-DE', 'ar-EG', 'hi-IN',  # Locale codes
    'E.164', 'content-type', 'a', 'q', 'id', 'token',  # Non-translatable values
    'hubspot', 'zoho', 'odoo',  # Service names
    'Paused', 'Resumed', 'Aggiornato',  # Status values
}

def extract_placeholders(text: str) -> Set[str]:
    """Estrae placeholder da una stringa"""
    if not isinstance(text, str):
        return set()
    return set(m.group(0) for m in PLACEHOLDER_RE.finditer(text))

def extract_variables_from_object(obj_text: str) -> Set[str]:
    """Estrae nomi di variabili da oggetti JavaScript/TypeScript"""
    variables = set()
    patterns = [
        r"['\"]?(\w+)['\"]?\s*:",  # name: o 'name': o "name":
        r"(\w+)\s*=",              # name=
    ]
    
    # Parametri da ignorare (non sono placeholder)
    ignore_params = {'ns', 'namespace', 'lng', 'lngs', 'fallbackLng', 'debug', 'interpolation'}
    
    for pattern in patterns:
        matches = re.findall(pattern, obj_text)
        # Filtra i parametri da ignorare
        filtered_matches = [m for m in matches if m not in ignore_params]
        variables.update(filtered_matches)
    
    return variables

def scan_codebase() -> Dict[str, Set[str]]:
    """Scansiona il codebase per chiavi di traduzione"""
    src_dir = ROOT / "frontend" / "src"
    if not src_dir.exists():
        print(f"❌ Directory sorgente {src_dir} non trovata")
        return {}
    
    extensions = {'.ts', '.tsx', '.js', '.jsx'}
    files = []
    for ext in extensions:
        files.extend(src_dir.rglob(f"*{ext}"))
    
    print(f"🔍 Scansiono {len(files)} file sorgente...")
    
    code_keys = {}
    
    for file_path in files:
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
                if VALID_KEY_PATTERN.match(key) and key not in IGNORE_KEYS:
                    if len(match.groups()) > 1:  # Ha parametri
                        obj_text = match.group(2)
                        variables = extract_variables_from_object(obj_text)
                        code_keys[key] = variables
                    else:  # Nessun parametro
                        code_keys[key] = set()
        
        # Cerca componenti <Trans>
        for pattern in TRANS_COMPONENT_PATTERNS:
            for match in re.finditer(pattern, content):
                key = match.group(1)
                if VALID_KEY_PATTERN.match(key) and key not in IGNORE_KEYS:
                    obj_text = match.group(2)
                    variables = extract_variables_from_object(obj_text)
                    code_keys[key] = variables
    
    return code_keys

def load_catalogs() -> Dict[str, Dict[str, Dict[str, str]]]:
    """Carica tutti i cataloghi i18n"""
    locales_dir = ROOT / "frontend" / "public" / "locales"
    catalogs = {}
    
    def flatten_dict(d, prefix=""):
        for k, v in d.items():
            kk = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                yield from flatten_dict(v, kk)
            else:
                yield kk, v
    
    for locale_dir in locales_dir.iterdir():
        if not locale_dir.is_dir():
            continue
        
        locale = locale_dir.name
        catalogs[locale] = {}
        
        for json_file in locale_dir.glob("*.json"):
            namespace = json_file.stem
            try:
                data = json.loads(json_file.read_text(encoding='utf-8'))
                flat_data = dict(flatten_dict(data))
                
                # Aggiungi chiavi con namespace
                for key, value in flat_data.items():
                    # Aggiungi sempre la chiave con prefisso namespace (es. pages.import.prefix.apply_to_all)
                    full_key = f"{namespace}.{key}"
                    catalogs[locale][full_key] = value
                    
                    # Aggiungi anche la chiave senza prefisso namespace per compatibilità
                    catalogs[locale][key] = value
                    
                    # Gestione speciale per namespace common
                    if namespace == "common":
                        # Per common, aggiungi anche con prefisso common. (es. common.clear_filters)
                        if not key.startswith("common."):
                            catalogs[locale][f"common.{key}"] = value
                
            except Exception as e:
                print(f"⚠️  Errore leggendo {json_file}: {e}")
    
    return catalogs

def check_missing_keys(code_keys: Dict[str, Set[str]], catalogs: Dict[str, Dict[str, str]]) -> List[str]:
    """Trova chiavi mancanti nei cataloghi"""
    missing = []
    src_catalog = catalogs.get(SRC, {})
    
    for key in code_keys.keys():
        if key not in src_catalog:
            # Prova a mappare la chiave con prefisso namespace
            if "." in key:
                namespace, simple_key = key.split(".", 1)
                # Cerca la chiave nel namespace corretto
                mapped_key = f"{namespace}.{simple_key}"
                if mapped_key not in src_catalog:
                    missing.append(key)
            else:
                missing.append(key)
    
    return missing

def check_placeholder_alignment(code_keys: Dict[str, Set[str]], catalogs: Dict[str, Dict[str, str]]) -> List[str]:
    """Verifica allineamento placeholder tra codice e cataloghi"""
    mismatches = []
    src_catalog = catalogs.get(SRC, {})
    
    for key, code_vars in code_keys.items():
        if key not in src_catalog:
            continue
        
        catalog_placeholders = extract_placeholders(src_catalog[key])
        
        # Normalizza placeholder per confronto
        def normalize_placeholder(ph: str) -> str:
            return re.sub(r'[{}]', '', ph).strip()
        
        code_normalized = {normalize_placeholder(v) for v in code_vars}
        catalog_normalized = {normalize_placeholder(ph) for ph in catalog_placeholders}
        
        missing_in_catalog = code_normalized - catalog_normalized
        extra_in_catalog = catalog_normalized - code_normalized
        
        if missing_in_catalog or extra_in_catalog:
            mismatches.append(f"{key}: code={code_vars}, catalog={catalog_placeholders}")
    
    return mismatches

def check_catalog_completeness(catalogs: Dict[str, Dict[str, str]]) -> Dict[str, List[str]]:
    """Verifica completezza dei cataloghi target"""
    src_catalog = catalogs.get(SRC, {})
    missing_by_locale = {}
    
    for locale in TARGETS:
        if locale not in catalogs:
            missing_by_locale[locale] = list(src_catalog.keys())
            continue
        
        target_catalog = catalogs[locale]
        missing = []
        
        for key in src_catalog.keys():
            if key not in target_catalog or not target_catalog[key].strip():
                missing.append(key)
        
        if missing:
            missing_by_locale[locale] = missing
    
    return missing_by_locale

def main():
    print("🔍 CHECK COMPLETO SITUAZIONE i18n")
    print("=" * 60)
    
    # 1. Scansiona codice
    print("📱 Scansionando codice sorgente...")
    code_keys = scan_codebase()
    print(f"   Trovate {len(code_keys)} chiavi nel codice")
    
    # 2. Carica cataloghi
    print("\n📚 Caricando cataloghi...")
    catalogs = load_catalogs()
    print(f"   Caricati {len(catalogs)} locale")
    
    # 3. Check chiavi mancanti
    print("\n🔍 Verificando chiavi mancanti...")
    missing_keys = check_missing_keys(code_keys, catalogs)
    if missing_keys:
        print(f"❌ {len(missing_keys)} chiavi mancanti nei cataloghi:")
        for key in sorted(missing_keys):
            # Trova dove viene usata questa chiave nel codice
            usage_locations = []
            for ext in ['*.js', '*.jsx', '*.ts', '*.tsx']:
                for file_path in Path("frontend/src").rglob(ext):
                    try:
                        content = file_path.read_text(encoding='utf-8')
                        # Usa gli stessi pattern di estrazione per la verifica
                        found_in_file = False
                        for pattern in T_FUNCTION_PATTERNS:
                            for match in re.finditer(pattern, content):
                                extracted_key = match.group(1)
                                if VALID_KEY_PATTERN.match(extracted_key) and len(extracted_key) > 1 and not extracted_key.startswith('/'):
                                    if extracted_key == key:
                                        found_in_file = True
                                        break
                            if found_in_file:
                                break
                        
                        if found_in_file:
                            usage_locations.append(str(file_path.relative_to(Path("frontend/src"))))
                    except UnicodeDecodeError:
                        continue
            
            print(f"   - {key}")
            if usage_locations:
                for loc in usage_locations[:3]:  # Mostra max 3 locazioni
                    print(f"     📍 {loc}")
                if len(usage_locations) > 3:
                    print(f"     📍 ... e altre {len(usage_locations) - 3} locazioni")
            else:
                print(f"     ⚠️  Non trovata nel codice (possibile falsa rilevazione)")
    else:
        print("✅ Tutte le chiavi del codice sono presenti nei cataloghi")
    
    # 4. Check placeholder alignment
    print("\n🔍 Verificando allineamento placeholder...")
    placeholder_mismatches = check_placeholder_alignment(code_keys, catalogs)
    if placeholder_mismatches:
        print(f"❌ {len(placeholder_mismatches)} disallineamenti placeholder:")
        for mismatch in placeholder_mismatches:
            print(f"   - {mismatch}")
    else:
        print("✅ Tutti i placeholder sono allineati")
    
    # 5. Check completezza cataloghi target
    print("\n🔍 Verificando completezza cataloghi target...")
    missing_by_locale = check_catalog_completeness(catalogs)
    if missing_by_locale:
        for locale, missing in missing_by_locale.items():
            print(f"❌ {locale}: {len(missing)} chiavi mancanti")
            if len(missing) <= 10:
                for key in missing:
                    print(f"     - {key}")
            else:
                for key in missing[:5]:
                    print(f"     - {key}")
                print(f"     ... e altre {len(missing) - 5}")
    else:
        print("✅ Tutti i cataloghi target sono completi")
    
    # 6. Report finale
    print("\n" + "=" * 60)
    print("📊 REPORT FINALE:")
    print(f"   - Chiavi nel codice: {len(code_keys)}")
    print(f"   - Locale disponibili: {len(catalogs)}")
    print(f"   - Chiavi mancanti: {len(missing_keys)}")
    print(f"   - Disallineamenti placeholder: {len(placeholder_mismatches)}")
    
    total_missing_translations = sum(len(missing) for missing in missing_by_locale.values())
    print(f"   - Traduzioni mancanti: {total_missing_translations}")
    
    if missing_keys == 0 and len(placeholder_mismatches) == 0 and total_missing_translations == 0:
        print("\n🎉 SITUAZIONE PERFETTA! Tutto è allineato.")
        return 0
    else:
        print("\n⚠️  AZIONI RICHIESTE:")
        if missing_keys:
            print("   1. Esegui 'python scripts/i18n_sync.py' per aggiungere chiavi mancanti")
        if total_missing_translations > 0:
            print("   2. Esegui 'python scripts/i18n_translate.py' per tradurre")
        if placeholder_mismatches:
            print("   3. Correggi manualmente i disallineamenti placeholder")
        return 1

if __name__ == "__main__":
    exit(main())
