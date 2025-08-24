#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix automatico placeholder per Sito Web
Allinea i placeholder di tutte le lingue a quelli di en.json
"""
import json, re, os, sys
from copy import deepcopy
from pathlib import Path

# Configurazione
ROOT = Path(__file__).parent.parent
CONFIG_FILE = ROOT / "i18n.config.json"

def load_config():
    if not CONFIG_FILE.exists():
        print(f"❌ Config file non trovato: {CONFIG_FILE}")
        sys.exit(1)
    try:
        with open(CONFIG_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Errore config: {e}")
        sys.exit(1)

config = load_config()
SRC = config["sourceLocale"]
TARGETS = config["targetLocales"]
PRESERVE_PATTERNS = config["preservePatterns"]
LOCALES_DIR = ROOT / config["paths"]["locales"]
CACHE_DIR = ROOT / config["paths"]["cache"]

# Pattern per placeholder
PH_PATTERNS = PRESERVE_PATTERNS
TAG_PATTERN = r"</?[\\w-]+(?:\\s+[^>]*)?>|<\\d+>|</\\d+>"
PH_RE = re.compile("(" + "|".join(PH_PATTERNS + [TAG_PATTERN]) + ")")

def extract_placeholders(text: str):
    if not isinstance(text, str):
        return []
    return [m.group(0) for m in PH_RE.finditer(text)]

def names_from_braces(ph_list):
    """Converte {name} -> name | {{name}} -> name | ignora tag <0>"""
    out = []
    for p in ph_list:
        if p.startswith("<") and p.endswith(">"):  # tag JSX-like
            continue
        # rimuovi {{ }} o { }
        m = re.match(r"^\{\{?\s*([\w.-]+)\s*\}?\}$", p)
        if m:
            out.append(m.group(1))
        elif p.startswith("%{") and p.endswith("}"):
            out.append(p[2:-1])
        elif p.startswith("%(") and p.endswith(")s"):
            out.append(p[2:-2])
        elif p.startswith("${") and p.endswith("}"):
            out.append(p[2:-1])
        elif p.startswith(":"):
            out.append(p[1:])
    return out

def load_json(path):
    if not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Errore lettura {path}: {e}")
        return {}

def dump_json(path, data):
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\\n")
    tmp.replace(path)

def walk_keys(obj, prefix=""):
    """Itera tutte le chiavi foglia (stringhe) in un dict JSON flat/nested."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_keys(v, f"{prefix}.{k}" if prefix else k)
    else:
        yield prefix, obj

def replace_placeholders(text, mapping):
    """Rinomina i placeholder nel testo seguendo mapping { old->new }"""
    if not isinstance(text, str) or not mapping:
        return text
    out = text
    
    for old, new in sorted(mapping.items(), key=lambda x: -len(x[0])):
        # {old} / {{old}}
        out = re.sub(rf"\{{\{{\s*{re.escape(old)}\s*\}}\}}", "{{" + new + "}}", out)
        out = re.sub(rf"\{{\s*{re.escape(old)}\s*\}}", "{" + new + "}", out)
        # %{old} -> %{new}
        out = re.sub(rf"%\{{\s*{re.escape(old)}\s*\}}", "%{" + new + "}", out)
        # %(old)s -> %(new)s
        out = re.sub(rf"%\(\s*{re.escape(old)}\s*\)s", "%(" + new + ")s", out)
        # ${old} -> ${new}
        out = re.sub(rf"\$\{{\s*{re.escape(old)}\s*\}}", "${" + new + "}", out)
        # :old -> :new
        out = re.sub(rf"(?<![\w.-]):{re.escape(old)}(?![\w.-])", ":" + new, out)
    
    return out

def main():
    print("🔧 Fix automatico placeholder Sito Web")
    print("=" * 50)
    
    # Prepara directory
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    # Carica file sorgente
    src_file = LOCALES_DIR / f"{SRC}.json"
    if not src_file.exists():
        print(f"❌ File sorgente non trovato: {src_file}")
        sys.exit(1)
    
    src_data = load_json(src_file)
    
    # Pre-calc placeholder canonici per source
    src_ph_map = {}
    for key, val in walk_keys(src_data):
        if isinstance(val, str):
            src_ph_map[key] = names_from_braces(extract_placeholders(val))
        else:
            src_ph_map[key] = []
    
    total_fixes = 0
    report = []
    
    for target in TARGETS:
        target_file = LOCALES_DIR / f"{target}.json"
        if not target_file.exists():
            print(f"⚠️ File target non trovato: {target_file}")
            continue
        
        target_data = load_json(target_file)
        orig_data = deepcopy(target_data)
        fixes = 0
        
        for key, _ in walk_keys(src_data):
            # Naviga nel JSON target
            parts = key.split(".")
            tnode = target_data
            for p in parts[:-1]:
                if not isinstance(tnode, dict) or p not in tnode:
                    tnode = None
                    break
                tnode = tnode[p]
            
            leaf = parts[-1]
            if tnode is None or leaf not in (tnode if isinstance(tnode, dict) else {}):
                continue  # chiave mancante
            
            tval = tnode[leaf]
            if not isinstance(tval, str):
                continue
            
            src_names = set(src_ph_map.get(key, []))
            trg_names = set(names_from_braces(extract_placeholders(tval)))
            
            if src_names == trg_names:
                continue  # già ok
            
            # Mappatura euristica
            if len(src_names) == len(trg_names) and len(src_names) > 0:
                mapping = {}
                for old, new in zip(sorted(trg_names), sorted(src_names)):
                    if old != new:
                        mapping[old] = new
                if mapping:
                    tnode[leaf] = replace_placeholders(tval, mapping)
                    fixes += 1
                    report.append(f"[{target}] {key}: rename {mapping}")
                    continue
            
            # Rimuovi placeholder extra
            extra = trg_names - src_names
            if extra:
                for e in extra:
                    tnode[leaf] = replace_placeholders(tnode[leaf], {e: ""})
                fixes += 1
                report.append(f"[{target}] {key}: removed extra {sorted(extra)}")
            
            # Aggiungi placeholder mancanti
            missing = src_names - trg_names
            if missing:
                addon = " " + " ".join("{" + m + "}" for m in sorted(missing))
                tnode[leaf] = (tnode[leaf] or "") + addon
                fixes += 1
                report.append(f"[{target}] {key}: added missing {sorted(missing)}")
        
        if fixes and target_data != orig_data:
            dump_json(target_file, target_data)
            total_fixes += fixes
            print(f"[FIX] {target}.json → {fixes} correzioni")
    
    print(f"\n==> Totale correzioni: {total_fixes}")
    
    if report:
        log_file = CACHE_DIR / "placeholder_fix_report.txt"
        with open(log_file, "w", encoding="utf-8") as f:
            f.write("\n".join(report))
        print(f"Report: {log_file}")

if __name__ == "__main__":
    main()
