#!/usr/bin/env python3
"""
Scanner del codice sorgente per estrarre placeholder passati a t() e <Trans>
Confronta i placeholder del codice con quelli presenti nei cataloghi i18n
"""
import os
import re
import json
from pathlib import Path
from typing import Dict, Set, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "i18n.config.json").read_text())
SRC = CFG["sourceLocale"]

# Pattern per estrarre chiamate di traduzione
T_FUNCTION_PATTERNS = [
    # t('key', { name: value, count: total })
    r"t\(\s*['\"`]([^'\"`]+)['\"`]\s*,\s*\{([^}]+)\}\s*\)",
    # t("key", { name: value, count: total })
    r"t\(\s*[\"`]([^\"`]+)[\"`]\s*,\s*\{([^}]+)\}\s*\)",
    # t(`key`, { name: value, count: total })
    r"t\(\s*`([^`]+)`\s*,\s*\{([^}]+)\}\s*\)",
]

# Pattern per chiamate t() SENZA parametri
T_FUNCTION_NO_PARAMS_PATTERNS = [
    # t('key')
    r"t\(\s*['\"`]([^'\"`]+)['\"`]\s*\)",
    # t("key")
    r"t\(\s*[\"`]([^\"`]+)[\"`]\s*\)",
    # t(`key`)
    r"t\(\s*`([^`]+)`\s*\)",
]

# Pattern per filtrare chiavi valide (esclude template literals, percorsi, caratteri speciali)
VALID_KEY_PATTERN = re.compile(r'^[a-zA-Z][a-zA-Z0-9._-]*$')

TRANS_COMPONENT_PATTERNS = [
    # <Trans i18nKey="key" values={{ name, count }}>
    r"<Trans[^>]*i18nKey=['\"`]([^'\"`]+)['\"`][^>]*values=\{\{([^}]+)\}\}[^>]*>",
    # <Trans i18nKey="key" values={{ name, count }}>
    r"<Trans[^>]*values=\{\{([^}]+)\}\}[^>]*i18nKey=['\"`]([^'\"`]+)['\"`][^>]*>",
]

# Pattern per estrarre variabili dagli oggetti
VARIABLE_PATTERNS = [
    r"\b([\w.-]+)\s*:",           # name:
    r"\b([\w.-]+)\s*=",           # name=
    r"\b([\w.-]+)\s*\+",          # name+
    r"\b([\w.-]+)\s*-",           # name-
    r"\b([\w.-]+)\s*\*",          # name*
    r"\b([\w.-]+)\s*/",           # name/
    r"\b([\w.-]+)\s*\)",          # name)
    r"\b([\w.-]+)\s*;",           # name;
    r"\b([\w.-]+)\s*,",           # name,
    r"\b([\w.-]+)\s*}",           # name}
    r"\b([\w.-]+)\s*$",           # name (end of line)
]

def extract_variables_from_object(obj_text: str) -> Set[str]:
    """Estrae nomi di variabili da oggetti JavaScript/TypeScript"""
    variables = set()
    
    # Pattern più specifici per estrarre solo le variabili passate a t()
    # name: value -> name
    # 'name': value -> name  
    # "name": value -> name
    specific_patterns = [
        r"['\"]?(\w+)['\"]?\s*:",  # name: o 'name': o "name":
        r"(\w+)\s*=",              # name=
    ]
    
    for pattern in specific_patterns:
        matches = re.findall(pattern, obj_text)
        variables.update(matches)
    
    return variables

def scan_file(file_path: Path) -> List[Tuple[str, Set[str]]]:
    """Scansiona un singolo file per chiamate di traduzione"""
    if not file_path.exists():
        return []
    
    try:
        content = file_path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        try:
            content = file_path.read_text(encoding='latin-1')
        except:
            print(f"⚠️  Impossibile leggere {file_path}")
            return []
    
    results = []
    
    # Cerca chiamate t() function CON parametri
    for pattern in T_FUNCTION_PATTERNS:
        for match in re.finditer(pattern, content):
            key = match.group(1)
            # Filtra solo chiavi valide
            if VALID_KEY_PATTERN.match(key):
                obj_text = match.group(2)
                variables = extract_variables_from_object(obj_text)
                if variables:
                    results.append((key, variables))
    
    # Cerca chiamate t() function SENZA parametri
    for pattern in T_FUNCTION_NO_PARAMS_PATTERNS:
        for match in re.finditer(pattern, content):
            key = match.group(1)
            # Filtra solo chiavi valide
            if VALID_KEY_PATTERN.match(key):
                # Nessun parametro, quindi nessuna variabile
                results.append((key, set()))
    
    # Cerca componenti <Trans>
    for pattern in TRANS_COMPONENT_PATTERNS:
        for match in re.finditer(pattern, content):
            if len(match.groups()) == 2:
                key = match.group(1)
                # Filtra solo chiavi valide
                if VALID_KEY_PATTERN.match(key):
                    obj_text = match.group(2)
                    variables = extract_variables_from_object(obj_text)
                    if variables:
                        results.append((key, variables))
    
    return results

def scan_codebase() -> Dict[str, Set[str]]:
    """Scansiona tutto il codebase per chiamate di traduzione"""
    src_dir = ROOT / "frontend" / "src"
    if not src_dir.exists():
        print(f"❌ Directory sorgente {src_dir} non trovata")
        return {}
    
    # Estensioni da scansionare
    extensions = {'.ts', '.tsx', '.js', '.jsx'}
    
    # Raccogli tutti i file
    files = []
    for ext in extensions:
        files.extend(src_dir.rglob(f"*{ext}"))
    
    print(f"🔍 Scansiono {len(files)} file sorgente...")
    
    # Risultati aggregati
    code_placeholders = {}
    
    for file_path in files:
        results = scan_file(file_path)
        for key, variables in results:
            if key not in code_placeholders:
                code_placeholders[key] = set()
            code_placeholders[key].update(variables)
    
    # DEBUG: Stampa le chiavi trovate nel codice
    print(f"\n🔍 Chiavi trovate nel codice:")
    for key, vars in code_placeholders.items():
        print(f"  📝 Code: {key} -> {vars}")
    
    return code_placeholders

def extract_catalog_placeholders() -> Dict[str, Set[str]]:
    """Estrae placeholder dai cataloghi i18n esistenti"""
    locales_dir = ROOT / "frontend" / "public" / "locales"
    src_dir = locales_dir / SRC
    
    if not src_dir.exists():
        print(f"❌ Directory sorgente {src_dir} non trovata")
        return {}
    
    catalog_placeholders = {}
    
    # Pattern per placeholder (stesso di i18n_validate.py)
    patterns = [
        r"\{\{\s*[\w.-]+\s*\}\}",     # {{name}}
        r"\{\s*[\w.-]+(?:\s*,\s*[\w\s,{}]+)?\}",  # {name} o ICU {count, plural, ...}
        r"%\{[\w.-]+\}",              # %{name}
        r"%\([\w.-]+\)s",             # %(name)s
        r":\b[\w.-]+\b",              # :name
        r"\$\{[\w.-]+\}",             # ${name}
        r"</?[\w-]+(?:\s+[^>]*)?>|<\d+>|</\d+>"  # <0>, </0>, <bold>, <a ...>
    ]
    
    combined_re = re.compile("(" + "|".join(patterns) + ")")
    
    def flatten_dict(d, prefix=""):
        for k, v in d.items():
            kk = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                yield from flatten_dict(v, kk)
            else:
                yield kk, v
    
    # Scansiona tutti i namespace
    for json_file in src_dir.glob("*.json"):
        namespace = json_file.stem
        try:
            data = json.loads(json_file.read_text(encoding='utf-8'))
            for key, value in flatten_dict(data):
                if isinstance(value, str):
                    placeholders = set(m.group(0) for m in combined_re.finditer(value))
                    if placeholders:
                        # Aggiunge prefisso namespace per confronto con codice
                        full_key = f"{namespace}.{key}" if namespace != "common" else key
                        catalog_placeholders[full_key] = placeholders
                        
                        # Aggiunge anche la versione senza namespace per compatibilità
                        if namespace != "common":
                            catalog_placeholders[key] = placeholders
                        
                        # Gestione speciale per common.* -> namespace-less
                        if namespace == "common":
                            catalog_placeholders[f"common.{key}"] = placeholders
                        
                        # Gestione speciale per pages.integrations.* -> integrations.*
                        if namespace == "pages" and key.startswith("integrations."):
                            integrations_key = key.replace("integrations.", "")
                            catalog_placeholders[f"integrations.{integrations_key}"] = placeholders
                        
                        # Gestione speciale per chiavi route-based
                        if namespace == "pages":
                            # /auth/login -> auth.login
                            if key.startswith("auth."):
                                catalog_placeholders[f"auth.{key.replace('auth.', '')}"] = placeholders
                            # /kb -> kb.index  
                            elif key == "kb":
                                catalog_placeholders["kb.index"] = placeholders
                        
                        # Gestione speciale per chiavi route-based nel codice
                        if namespace == "auth":
                            # auth.login -> /auth/login (per compatibilità)
                            catalog_placeholders[f"/auth/{key}"] = placeholders
                            # auth.totp.verify -> /auth/totp/verify (per compatibilità)
                            if key == "totp.verify":
                                catalog_placeholders["/auth/totp/verify"] = placeholders
                        elif namespace == "kb":
                            # kb.index -> /kb (per compatibilità)
                            catalog_placeholders["/kb"] = placeholders
                        
                        # Gestione speciale per chiavi che iniziano con /
                        if key.startswith("/"):
                            catalog_placeholders[key] = placeholders
                        
                        # Gestione speciale per chiavi route-based nel catalogo
                        if key.startswith("/"):
                            # /login -> /auth/login
                            if namespace == "auth":
                                catalog_placeholders[f"/auth{key}"] = placeholders
                            # / -> /kb  
                            elif namespace == "kb":
                                catalog_placeholders["/kb"] = placeholders
                        
                        # DEBUG: Stampa le chiavi trovate
                        print(f"  📝 Catalog: {full_key} -> {placeholders}")
        except Exception as e:
            print(f"⚠️  Errore leggendo {json_file}: {e}")
    
    return catalog_placeholders

def validate_placeholders(code_placeholders: Dict[str, Set[str]], 
                         catalog_placeholders: Dict[str, Set[str]]) -> int:
    """Valida che i placeholder del codice corrispondano a quelli nei cataloghi"""
    errors = 0
    
    print("\n🔍 Validazione placeholder codice ↔ cataloghi:")
    print("=" * 60)
    
    # Controlla ogni chiave trovata nel codice
    for key, code_vars in code_placeholders.items():
        if key not in catalog_placeholders:
            print(f"❌ [MISSING KEY] {key} - presente nel codice ma non nei cataloghi")
            errors += 1
            continue
        
        catalog_vars = catalog_placeholders[key]
        
        # Normalizza i placeholder per il confronto
        def normalize_placeholder(ph: str) -> str:
            # Rimuovi graffe e spazi per confronto
            return re.sub(r'[{}]', '', ph).strip()
        
        code_normalized = {normalize_placeholder(v) for v in code_vars}
        catalog_normalized = {normalize_placeholder(v) for v in catalog_vars}
        
        # Trova differenze
        missing_in_catalog = code_normalized - catalog_normalized
        extra_in_catalog = catalog_normalized - code_normalized
        
        if missing_in_catalog:
            print(f"❌ [MISSING PLACEHOLDER] {key} - codice passa {missing_in_catalog} ma catalogo non ha placeholder corrispondenti")
            errors += 1
        
        if extra_in_catalog:
            print(f"⚠️  [EXTRA PLACEHOLDER] {key} - catalogo ha {extra_in_catalog} ma codice non li passa")
            # Non è un errore critico, solo warning
        
        if not missing_in_catalog and not extra_in_catalog:
            print(f"✅ {key} - placeholder allineati: {code_vars}")
    
    return errors

def main():
    print("🔍 Scanner codice sorgente per validazione i18n end-to-end")
    print("=" * 70)
    
    # 1. Scansiona il codice
    code_placeholders = scan_codebase()
    print(f"\n📊 Trovate {len(code_placeholders)} chiavi di traduzione nel codice")
    
    # 2. Estrai placeholder dai cataloghi
    catalog_placeholders = extract_catalog_placeholders()
    print(f"📚 Trovati {len(catalog_placeholders)} placeholder nei cataloghi")
    
    # 3. Valida allineamento
    errors = validate_placeholders(code_placeholders, catalog_placeholders)
    
    # 4. Report finale
    print("\n" + "=" * 60)
    if errors == 0:
        print("✅ Validazione end-to-end superata! Codice e cataloghi allineati.")
        return 0
    else:
        print(f"❌ Validazione fallita con {errors} errore(i).")
        print("\n💡 Suggerimenti:")
        print("  - Aggiungi le chiavi mancanti ai cataloghi")
        print("  - Verifica che i placeholder nei cataloghi corrispondano a quelli passati dal codice")
        print("  - Usa sempre placeholder consistenti: {name}, {count}, ecc.")
        return 1

if __name__ == "__main__":
    exit(main())
