#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scanner del codice sorgente per Sito Web
Trova tutte le chiamate useTranslations() e t() in Next.js
"""
import re, json, glob
from pathlib import Path
from typing import List, Set, Tuple

# Configurazione
ROOT = Path(__file__).parent.parent
CONFIG_FILE = ROOT / "i18n.config.json"

def load_config():
    if not CONFIG_FILE.exists():
        print(f"❌ Config file non trovato: {CONFIG_FILE}")
        return {}
    try:
        with open(CONFIG_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Errore config: {e}")
        return {}

config = load_config()
WEB_DIR = ROOT / "web"
SRC_DIR = WEB_DIR / "src"

# Pattern per next-intl
T_FUNCTION_PATTERNS = [
    r"t\(\s*['\"`]([^'\"`]+)['\"`](?:\s*,\s*\{([^}]+)\})?\s*\)",
    r"useTranslations\(['\"`]([^'\"`]+)['\"`]\)",
]

def extract_variables_from_object(obj_text: str) -> Set[str]:
    """Estrae variabili da oggetto JavaScript"""
    if not obj_text:
        return set()
    
    # Pattern per variabili
    patterns = [
        r'\b(\w+)\s*:', # key: value
        r'\b(\w+)\s*,', # shorthand property
    ]
    
    variables = set()
    for pattern in patterns:
        matches = re.findall(pattern, obj_text)
        variables.update(matches)
    
    # Filtra parole riservate JS
    reserved = {'true', 'false', 'null', 'undefined', 'const', 'let', 'var', 'function'}
    return {v for v in variables if v not in reserved and len(v) > 1}

def scan_file(file_path: Path) -> List[Tuple[str, Set[str]]]:
    """Scansiona un file per chiamate t()"""
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"⚠️ Errore lettura {file_path}: {e}")
        return []
    
    results = []
    
    # Pattern per t('key') e t('key', {params})
    for match in re.finditer(r"t\(\s*['\"`]([^'\"`]+)['\"`](?:\s*,\s*\{([^}]+)\})?\s*\)", content):
        key = match.group(1)
        params = match.group(2) or ""
        variables = extract_variables_from_object(params)
        results.append((key, variables))
    
    # Pattern per useTranslations('namespace')
    for match in re.finditer(r"useTranslations\(['\"`]([^'\"`]+)['\"`]\)", content):
        namespace = match.group(1)
        # Cerca utilizzi di t() dopo useTranslations
        t_pattern = rf"const\s+t\s*=\s*useTranslations\(['\"`]{re.escape(namespace)}['\"`]\)"
        if re.search(t_pattern, content):
            # Trova chiamate t() successive
            for t_match in re.finditer(r"t\(\s*['\"`]([^'\"`]+)['\"`](?:\s*,\s*\{([^}]+)\})?\s*\)", content):
                key = f"{namespace}.{t_match.group(1)}"
                params = t_match.group(2) or ""
                variables = extract_variables_from_object(params)
                results.append((key, variables))
    
    return results

def main():
    print("🔍 Scanner codice sorgente per validazione i18n end-to-end")
    print("=" * 70)
    
    # Trova file sorgente
    patterns = [
        str(SRC_DIR / "**" / "*.tsx"),
        str(SRC_DIR / "**" / "*.ts"),
        str(SRC_DIR / "**" / "*.jsx"),
        str(SRC_DIR / "**" / "*.js"),
    ]
    
    files = []
    for pattern in patterns:
        files.extend(Path(f) for f in glob.glob(pattern, recursive=True))
    
    files = [f for f in files if f.is_file()]
    print(f"🔍 Scansiono {len(files)} file sorgente...")
    
    # Scansiona file
    all_keys = {}
    for file_path in files:
        results = scan_file(file_path)
        for key, variables in results:
            if key not in all_keys:
                all_keys[key] = set()
            all_keys[key].update(variables)
    
    print(f"\n🔍 Chiavi trovate nel codice:")
    for key, variables in sorted(all_keys.items()):
        var_str = ", ".join(sorted(variables)) if variables else "nessun parametro"
        print(f"  📝 Code: {key} -> {var_str}")
    
    print(f"\n📊 Trovate {len(all_keys)} chiavi di traduzione nel codice")
    
    # Carica cataloghi per confronto
    if config:
        locales_dir = ROOT / config["paths"]["locales"]
        src_file = locales_dir / f"{config['sourceLocale']}.json"
        
        if src_file.exists():
            with open(src_file, encoding="utf-8") as f:
                catalog = json.load(f)
            
            def flatten_dict(d, prefix=""):
                result = {}
                for k, v in d.items():
                    key = f"{prefix}.{k}" if prefix else k
                    if isinstance(v, dict):
                        result.update(flatten_dict(v, key))
                    else:
                        result[key] = v
                return result
            
            catalog_flat = flatten_dict(catalog)
            
            print(f"\n🔍 Validazione chiavi codice ↔ cataloghi:")
            print("=" * 60)
            
            # Chiavi nel codice ma non nel catalogo
            missing_in_catalog = set(all_keys.keys()) - set(catalog_flat.keys())
            for key in sorted(missing_in_catalog):
                print(f"❌ [MISSING KEY] {key} - presente nel codice ma non nel catalogo")
            
            # Chiavi nel catalogo ma non nel codice
            unused_in_catalog = set(catalog_flat.keys()) - set(all_keys.keys())
            for key in sorted(unused_in_catalog):
                if isinstance(catalog_flat[key], str):  # Solo stringhe
                    print(f"⚠️ [UNUSED KEY] {key} - presente nel catalogo ma non usata nel codice")
            
            if not missing_in_catalog and not unused_in_catalog:
                print("✅ Tutte le chiavi sono allineate tra codice e cataloghi")

if __name__ == "__main__":
    main()
