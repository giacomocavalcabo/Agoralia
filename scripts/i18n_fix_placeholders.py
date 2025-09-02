#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Allinea i placeholder di tutte le lingue a quelli di en-US.
- Non tocca le stringhe già coerenti
- Mantiene il testo target, cambia solo i nomi placeholder
- Corregge 'missing' ed 'extra' placeholder
- Gestisce ordine diverso e casi banali ICU / tag JSX (<0>...</0>)

Esegui:
  python scripts/i18n_fix_placeholders.py --root frontend/locales --ns common pages auth billing app admin ui errors compliance integrations settings kb
"""
import argparse, json, re, glob, os, sys
from copy import deepcopy

PH_PATTERNS = [
    r"\{\{\s*[\w.-]+\s*\}\}",         # {{name}}
    r"\{\s*[\w.-]+(?:\s*,\s*[\w\s,{}]+)?\}",  # {name} o ICU semplice
    r"%\{[\w.-]+\}",                  # %{name}
    r"%\([\w.-]+\)s",                 # %(name)s
    r":\b[\w.-]+\b",                  # :name
    r"\$\{[\w.-]+\}",                 # ${name}
]
TAG_PATTERN = r"</?[\w-]+(?:\s+[^>]*)?>|<\d+>|</\d+>"
PH_RE = re.compile("(" + "|".join(PH_PATTERNS + [TAG_PATTERN]) + ")")

def extract_placeholders(text: str):
    if not isinstance(text, str):
        return []
    return [m.group(0) for m in PH_RE.finditer(text)]

def names_from_braces(ph_list):
    """ Converte {name} -> name | {{name}} -> name | ignora tag <0> """
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
        # altrimenti ignora (ICU complessa / tag)
    return out

def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def dump_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)

def walk_keys(obj, prefix=""):
    """Itera tutte le chiavi foglia (stringhe) in un dict JSON flat/nested."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_keys(v, f"{prefix}.{k}" if prefix else k)
    else:
        yield prefix, obj

def replace_placeholders(text, mapping):
    """Rinomina i placeholder nel testo seguendo mapping { old->new } senza toccare tag."""
    if not isinstance(text, str) or not mapping:
        return text
    out = text
    # rimpiazzo sicuro: solo forme {name} / {{name}} / %(name)s / %{name} / ${name} / :name
    for old, new in sorted(mapping.items(), key=lambda x: -len(x[0])):  # più lunghi prima
        # {old} / {{old}}
        out = re.sub(rf"\{{\{{\s*{re.escape(old)}\s*\}}\}}", "{{" + new + "}}", out)
        out = re.sub(rf"\{{\s*{re.escape(old)}\s*\}}", "{" + new + "}", out)
        # %{old} -> %{new}
        out = re.sub(rf"%\{{\s*{re.escape(old)}\s*\}}", "%{" + new + "}", out)
        # %(old)s -> %(new)s
        out = re.sub(rf"%\(\s*{re.escape(old)}\s*\)s", "%(" + new + ")s", out)
        # ${old} -> ${new}
        out = re.sub(rf"\$\{{\s*{re.escape(old)}\s*\}}", "${" + new + "}", out)
        # :old -> :new (attenzione a delimitatori parola)
        out = re.sub(rf"(?<![\w.-]):{re.escape(old)}(?![\w.-])", ":" + new, out)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="frontend/public/locales", help="Cartella radice delle locali")
    ap.add_argument("--source", default="en-US", help="Locale sorgente (source of truth)")
    ap.add_argument("--ns", nargs="+", required=False, help="Namespace senza estensione (default: tutti i .json in source)")
    args = ap.parse_args()

    src_dir = os.path.join(args.root, args.source)
    if not os.path.isdir(src_dir):
        print(f"[ERR] Source dir non trovata: {src_dir}")
        sys.exit(1)

    # Scopri i namespace
    if args.ns:
        namespaces = args.ns
    else:
        namespaces = [os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(src_dir, "*.json"))]

    # Target locales
    locales = [d for d in os.listdir(args.root) if os.path.isdir(os.path.join(args.root, d)) and d != args.source]

    total_fixes = 0
    report = []

    for ns in namespaces:
        src_path = os.path.join(src_dir, f"{ns}.json")
        if not os.path.exists(src_path):
            print(f"[WARN] NS mancante in source: {src_path}")
            continue
        src = load_json(src_path)

        # Pre-calc placeholder canonici per en-US
        src_ph_map = {}
        for key, val in walk_keys(src):
            if isinstance(val, str):
                src_ph_map[key] = names_from_braces(extract_placeholders(val))
            else:
                src_ph_map[key] = []

        for loc in locales:
            trg_path = os.path.join(args.root, loc, f"{ns}.json")
            if not os.path.exists(trg_path):
                # nessun file: passa (sarà creato dal tuo sync DeepL)
                continue
            trg = load_json(trg_path)
            orig = deepcopy(trg)
            fixes = 0

            for key, _ in walk_keys(src):
                # risali nel json target
                parts = key.split(".")
                tnode = trg
                for p in parts[:-1]:
                    if not isinstance(tnode, dict) or p not in tnode:
                        tnode = None
                        break
                    tnode = tnode[p]
                leaf = parts[-1]
                if tnode is None or leaf not in (tnode if isinstance(tnode, dict) else {}):
                    continue  # chiave mancante: verrà gestita dal sync DeepL
                tval = tnode[leaf]
                if not isinstance(tval, str):
                    continue

                src_names = set(src_ph_map.get(key, []))
                trg_names = set(names_from_braces(extract_placeholders(tval)))

                if src_names == trg_names:
                    continue  # già ok

                # Mappatura euristica: se il count dei placeholder coincide ma i nomi differiscono
                if len(src_names) == len(trg_names) and len(src_names) > 0:
                    mapping = {}
                    # prova align by sorted order dei nomi (stabile e deterministico)
                    for old, new in zip(sorted(trg_names), sorted(src_names)):
                        if old != new:
                            mapping[old] = new
                    if mapping:
                        tnode[leaf] = replace_placeholders(tval, mapping)
                        fixes += 1
                        report.append(f"[{loc}] {ns}.{key}: rename {mapping} | '{tval}'")
                        continue

                # Se target ha placeholder extra → rimuovi gli extra
                extra = trg_names - src_names
                if extra:
                    # più conservativo: rimuovi proprio gli extra dalla stringa mantenendo testo
                    for e in extra:
                        # rimuovi solo il token, non il contesto
                        tnode[leaf] = replace_placeholders(tnode[leaf], {e: ""})
                    fixes += 1
                    report.append(f"[{loc}] {ns}.{key}: removed extra {sorted(extra)}")

                # Se target ha placeholder mancanti → aggiungili in coda (forma più sicura)
                missing = src_names - trg_names
                if missing:
                    addon = " " + " ".join("{" + m + "}" for m in sorted(missing))
                    tnode[leaf] = (tnode[leaf] or "") + addon
                    fixes += 1
                    report.append(f"[{loc}] {ns}.{key}: added missing {sorted(missing)}")

            if fixes and trg != orig:
                dump_json(trg_path, trg)
                total_fixes += fixes
                print(f"[FIX] {loc}/{ns}.json → {fixes} correzioni")

    print(f"\n==> Totale correzioni: {total_fixes}")
    if report:
        log = "frontend/.i18n/placeholder_fix_report.txt"
        os.makedirs(os.path.dirname(log), exist_ok=True)
        with open(log, "w", encoding="utf-8") as f:
            f.write("\n".join(report))
        print(f"Report: {log}")

if __name__ == "__main__":
    main()
