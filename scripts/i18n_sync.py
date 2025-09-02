#!/usr/bin/env python3
"""
Script di SYNC per sincronizzare tutti i cataloghi i18n
- Aggiunge chiavi mancanti dai cataloghi inglesi
- Mantiene traduzioni esistenti
- Rimuove chiavi extra non presenti in inglese
- Allinea struttura e placeholder
- Crea file mancanti per nuove lingue
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, Set

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "i18n.config.json").read_text())
SRC = CFG["sourceLocale"]
TARGETS = CFG["targetLocales"]
LOCALES_DIR = ROOT / "frontend" / "public" / "locales"

def flatten_dict(d: Dict[str, Any], parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
    """Appiattisce un dizionario nidificato"""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def unflatten_dict(d: Dict[str, Any], sep: str = '.') -> Dict[str, Any]:
    """Ricostruisce un dizionario nidificato da uno appiattito"""
    result = {}
    for key, value in d.items():
        parts = key.split(sep)
        current = result
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value
    return result

def load_json_file(file_path: Path) -> Dict[str, Any]:
    """Carica un file JSON"""
    if file_path.exists():
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_json_file(file_path: Path, data: Dict[str, Any]):
    """Salva un file JSON formattato"""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write('\n')

def extract_placeholders(text: str) -> Set[str]:
    """Estrae placeholder da una stringa"""
    if not isinstance(text, str):
        return set()
    
    patterns = [
        r"\{\{\s*[\w.-]+\s*\}\}",                               # {{name}}
        r"\{\s*[\w.-]+(?:\s*,\s*[\w\s,{}]+)?\}",               # {name} o ICU
        r"%\{[\w.-]+\}",                                        # %{name}
        r"%\([\w.-]+\)s",                                       # %(name)s
        r":\b[\w.-]+\b",                                        # :name
        r"\$\{[\w.-]+\}",                                       # ${name}
        r"</?[\w-]+(?:\s+[^>]*)?>|<\d+>|</\d+>"               # tags
    ]
    
    combined_re = re.compile("(" + "|".join(patterns) + ")")
    return set(m.group(0) for m in combined_re.finditer(text))

def scan_code_for_missing_keys() -> Set[str]:
    """Scansiona il codice per trovare chiavi mancanti"""
    try:
        result = subprocess.run([sys.executable, 'scripts/i18n_check.py'], 
                              capture_output=True, text=True, cwd=ROOT)
        
        missing_keys = set()
        lines = result.stdout.split('\n')
        
        in_missing_section = False
        for line in lines:
            if "chiavi mancanti nei cataloghi:" in line:
                in_missing_section = True
                continue
            elif in_missing_section:
                if line.strip().startswith("- "):
                    key = line.strip()[2:]  # Rimuovi "- "
                    missing_keys.add(key)
                elif not line.strip() or not line.startswith("   "):
                    in_missing_section = False
        
        return missing_keys
    except Exception as e:
        print(f"⚠️  Impossibile scansionare codice: {e}")
        return set()

def add_missing_keys_to_source(missing_keys: Set[str]):
    """Aggiunge chiavi mancanti ai cataloghi sorgente"""
    if not missing_keys:
        return
    
    print(f"📝 Aggiungendo {len(missing_keys)} chiavi mancanti ai cataloghi {SRC}...")
    
    # Categorizza chiavi per namespace
    categorized = {}
    valid_namespaces = {
        'ui', 'common', 'pages', 'billing', 'integrations', 
        'admin', 'compliance', 'auth', 'settings', 'errors', 'kb', 'app'
    }
    
    for key in missing_keys:
        # Filtra chiavi non valide
        if not key or key in ['E.164', 'content-type', 'a', 'Moved', 'Annullato', 'q', 'id', 'Paused', 'Resumed', 'Aggiornato', 'token', 'hubspot', 'zoho', 'odoo']:
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
    
    # Valori predefiniti intelligenti
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
    for namespace, keys in categorized.items():
        src_file = LOCALES_DIR / SRC / f"{namespace}.json"
        catalog = load_json_file(src_file)
        added_count = 0
        
        for key in keys:
            # Naviga/crea la struttura nidificata
            key_parts = key.split('.')
            current = catalog
            
            for part in key_parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]
            
            final_key = key_parts[-1]
            if final_key not in current:
                # Cerca valore predefinito
                default_value = None
                if namespace in default_values and key in default_values[namespace]:
                    default_value = default_values[namespace][key]
                
                if default_value:
                    current[final_key] = default_value
                else:
                    # Genera un valore placeholder intelligente
                    readable_key = final_key.replace('_', ' ').title()
                    current[final_key] = f"[{readable_key}]"
                
                added_count += 1
        
        if added_count > 0:
            save_json_file(src_file, catalog)
            print(f"   ✅ {namespace}.json: +{added_count} chiavi")

def sync_namespace(namespace: str):
    """Sincronizza un namespace specifico"""
    print(f"\n🔄 Sincronizzando namespace: {namespace}")
    
    # Carica il file sorgente (inglese)
    src_file = LOCALES_DIR / SRC / f"{namespace}.json"
    if not src_file.exists():
        print(f"❌ File sorgente non trovato: {src_file}")
        return
    
    src_data = load_json_file(src_file)
    src_flat = flatten_dict(src_data)
    src_keys = set(src_flat.keys())
    
    print(f"📊 Chiavi in {SRC}: {len(src_keys)}")
    
    # Sincronizza ogni lingua target
    for locale in TARGETS:
        print(f"\n  🌍 Sincronizzando {locale}...")
        
        # Carica il file target
        tgt_file = LOCALES_DIR / locale / f"{namespace}.json"
        tgt_data = load_json_file(tgt_file)
        tgt_flat = flatten_dict(tgt_data)
        tgt_keys = set(tgt_flat.keys())
        
        print(f"    📊 Chiavi esistenti: {len(tgt_keys)}")
        
        # Trova differenze
        missing_keys = src_keys - tgt_keys
        extra_keys = tgt_keys - src_keys
        
        print(f"    ➕ Chiavi da aggiungere: {len(missing_keys)}")
        print(f"    ➖ Chiavi da rimuovere: {len(extra_keys)}")
        
        changes_made = False
        
        # Rimuovi chiavi extra
        for key in extra_keys:
            del tgt_flat[key]
            print(f"      🗑️  Rimossa: {key}")
            changes_made = True
        
        # Aggiungi chiavi mancanti (con testo inglese come placeholder)
        for key in missing_keys:
            tgt_flat[key] = src_flat[key]
            print(f"      ➕ Aggiunta: {key}")
            changes_made = True
        
        # Salva solo se ci sono stati cambiamenti
        if changes_made:
            # Ricostruisci la struttura nidificata
            new_tgt_data = unflatten_dict(tgt_flat)
            save_json_file(tgt_file, new_tgt_data)
            print(f"    ✅ Salvato: {tgt_file}")
        else:
            print(f"    ✅ Nessun cambiamento necessario")

        # Log dettagliato per chiavi non sincronizzate
        if missing_keys:
            print(f"    ⚠️  Non è stato possibile sincronizzare le seguenti chiavi per {locale}: {', '.join(missing_keys)}")

def fix_placeholder_alignment():
    """Corregge l'allineamento dei placeholder"""
    print(f"\n🔧 Allineando placeholder...")
    
    try:
        result = subprocess.run([
            sys.executable, 'scripts/i18n_fix_placeholders.py',
            '--root', str(LOCALES_DIR),
            '--source', SRC
        ], capture_output=True, text=True, cwd=ROOT)
        
        if result.returncode == 0:
            print("   ✅ Placeholder allineati")
        else:
            print(f"   ⚠️  Warning placeholder: {result.stdout}")
    except Exception as e:
        print(f"   ❌ Errore allineamento placeholder: {e}")

def main():
    """Funzione principale"""
    print("🚀 SINCRONIZZAZIONE COMPLETA i18n")
    print(f"📁 Directory: {LOCALES_DIR}")
    print(f"🌍 Lingue target: {', '.join(TARGETS)}")
    print("=" * 70)
    
    # 1. Scansiona codice per chiavi mancanti
    print("🔍 Scansionando codice per chiavi mancanti...")
    missing_keys = scan_code_for_missing_keys()
    if missing_keys:
        add_missing_keys_to_source(missing_keys)
    else:
        print("✅ Nessuna chiave mancante trovata nel codice")
    
    # 2. Trova tutti i namespace disponibili
    src_dir = LOCALES_DIR / SRC
    if not src_dir.exists():
        print(f"❌ Directory sorgente non trovata: {src_dir}")
        return
    
    namespaces = [f.stem for f in src_dir.glob("*.json")]
    print(f"\n📚 Namespace trovati: {', '.join(namespaces)}")
    
    # 3. Sincronizza ogni namespace
    for namespace in sorted(namespaces):
        sync_namespace(namespace)
    
    # 4. Allinea placeholder
    fix_placeholder_alignment()
    
    # 5. Report finale
    print(f"\n🎉 Sincronizzazione completata!")
    print(f"📊 Namespace processati: {len(namespaces)}")
    print(f"🌍 Lingue sincronizzate: {len(TARGETS)}")
    
    # 6. Validazione finale
    print(f"\n🔍 Validazione finale...")
    try:
        final_result = subprocess.run([sys.executable, 'scripts/i18n_check.py'], 
                                    capture_output=True, text=True, cwd=ROOT)
        if "SITUAZIONE PERFETTA" in final_result.stdout:
            print("🎉 Validazione PULITA! Tutti i cataloghi sono sincronizzati.")
        else:
            print("⚠️  Potrebbero essere necessarie traduzioni. Esegui 'python scripts/i18n_translate.py'")
    except Exception as e:
        print(f"❌ Errore validazione finale: {e}")

if __name__ == "__main__":
    main()