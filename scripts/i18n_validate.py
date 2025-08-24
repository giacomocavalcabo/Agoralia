#!/usr/bin/env python3
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "i18n.config.json").read_text())
SRC = CFG["sourceLocale"]
PRESERVE = re.compile(r"\{\w+\}")

def flatten(d, prefix=""):
    for k, v in d.items():
        kk = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            yield from flatten(v, kk)
        else:
            yield kk, v

def read_json(p): return json.loads(p.read_text(encoding="utf-8"))

def placeholders(s):
    """Estrae placeholder con pattern completi i18next/ICU/HTML"""
    if not s:
        return set()
    
    # Pattern unificato per tutti i tipi di placeholder e tag
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
    return set(m.group(0) for m in combined_re.finditer(str(s)))

def main():
    src_dir = ROOT / "frontend" / "locales" / SRC
    locales_dir = ROOT / "frontend" / "locales"
    
    if not src_dir.exists():
        print(f"❌ Directory sorgente {src_dir} non trovata")
        return 1
        
    namespaces = [p.stem for p in src_dir.glob("*.json")]

    errors = 0
    for loc in [p.name for p in locales_dir.iterdir() if p.is_dir()]:
        if loc == SRC: continue
        for ns in namespaces:
            src_path = src_dir / f"{ns}.json"
            if not src_path.exists():
                continue
                
            src = dict(flatten(read_json(src_path)))
            tgt_path = locales_dir / loc / f"{ns}.json"
            if not tgt_path.exists():
                print(f"[MISSING FILE] {loc}/{ns}.json")
                errors += 1
                continue
            tgt = dict(flatten(read_json(tgt_path)))

            # chiavi mancanti
            for k in sorted(set(src) - set(tgt)):
                print(f"[MISSING KEY] {loc}:{ns}.{k}")
                errors += 1

            # placeholder mismatch
            for k in set(src).intersection(tgt):
                if placeholders(src[k]) != placeholders(tgt[k]):
                    print(f"[PLACEHOLDERS] {loc}:{ns}.{k} {placeholders(src[k])} != {placeholders(tgt[k])}")
                    errors += 1

    if errors:
        print(f"\n❌ Validazione i18n fallita con {errors} problema(i).")
        return 1
    print("✅ Validazione i18n superata.")
    return 0

if __name__ == "__main__":
    exit(main())
