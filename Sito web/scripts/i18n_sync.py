#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sistema i18n con DeepL per Sito Web
Basato sul sistema enterprise-grade di ColdAI
"""
import json, os, sys, hashlib, requests, time
from pathlib import Path
import re
from datetime import datetime

# Configurazione
ROOT = Path(__file__).parent.parent
CONFIG_FILE = ROOT / "i18n.config.json"

def read_json(path):
    if not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Errore lettura {path}: {e}")
        return {}

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")

def load_config():
    if not CONFIG_FILE.exists():
        print(f"❌ Config file non trovato: {CONFIG_FILE}")
        sys.exit(1)
    return read_json(CONFIG_FILE)

# Carica configurazione
config = load_config()
SRC = config["sourceLocale"]
TARGETS = config["targetLocales"]
GLOSSARY = config["glossary"]
PRESERVE_PATTERNS = config["preservePatterns"]
LOCALES_DIR = ROOT / config["paths"]["locales"]
CACHE_DIR = ROOT / config["paths"]["cache"]
HASH_FILE = CACHE_DIR / "hashes.json"
USAGE_FILE = CACHE_DIR / "usage.json"

DEEPL_URL = "https://api-free.deepl.com/v2/translate"
DEEPL_KEY = "d50aa3f9-5118-47eb-bd0f-7006551cbd97:fx"  # Usa la stessa chiave
DEEPL_LANGS = {
    "it": "IT", "fr": "FR", "es": "ES", "de": "DE", "ar": "AR", "hi": "HI"
}

# Pattern per placeholder
PH_REGEX = re.compile("|".join(f"({p})" for p in PRESERVE_PATTERNS))

def extract_placeholders(text):
    """Estrae placeholder dal testo"""
    if not isinstance(text, str):
        return []
    return [m.group(0) for m in PH_REGEX.finditer(text)]

def mask_text(text, placeholders, glossary):
    """Maschera placeholder e glossary per DeepL"""
    if not isinstance(text, str):
        return text, {}, {}
    
    masked = text
    ph_map, gl_map = {}, {}
    
    # Maschera placeholder
    for i, ph in enumerate(placeholders):
        placeholder_id = f"__PH_{i}__"
        ph_map[placeholder_id] = ph
        masked = masked.replace(ph, placeholder_id)
    
    # Maschera termini glossary
    for i, term in enumerate(glossary):
        if term.lower() in masked.lower():
            glossary_id = f"__GL_{i}__"
            gl_map[glossary_id] = term
            masked = re.sub(re.escape(term), glossary_id, masked, flags=re.IGNORECASE)
    
    return masked, ph_map, gl_map

def unmask_text(text, ph_map, gl_map):
    """Rimuove maschere dal testo tradotto"""
    if not isinstance(text, str):
        return text
    
    result = text
    # Ripristina glossary
    for gl_id, term in gl_map.items():
        result = result.replace(gl_id, term)
    
    # Ripristina placeholder
    for ph_id, ph in ph_map.items():
        result = result.replace(ph_id, ph)
    
    return result

def track_usage(chars_used):
    """Traccia l'uso mensile dei caratteri DeepL"""
    usage = read_json(USAGE_FILE)
    month = datetime.now().strftime("%Y-%m")
    
    if month not in usage:
        usage[month] = 0
    
    usage[month] += chars_used
    write_json(USAGE_FILE, usage)
    
    return usage[month]

def check_usage_limit():
    """Controlla limiti DeepL"""
    usage = read_json(USAGE_FILE)
    month = datetime.now().strftime("%Y-%m")
    current_usage = usage.get(month, 0)
    
    cap = config["deepl"]["monthly_cap"]
    soft_warn = config["deepl"]["soft_warn"]
    
    if current_usage >= cap:
        print(f"❌ Limite mensile DeepL raggiunto: {current_usage}/{cap}")
        sys.exit(1)
    
    if current_usage >= soft_warn:
        print(f"⚠️ Vicino al limite DeepL: {current_usage}/{cap}")
    
    return cap - current_usage

def translate_batch(texts, target_lang, max_retries=3):
    """Traduce un batch di testi con DeepL"""
    if not texts:
        return []
    
    for attempt in range(max_retries):
        try:
            params = {
                "auth_key": DEEPL_KEY,
                "target_lang": DEEPL_LANGS.get(target_lang, target_lang.upper()),
                "preserve_formatting": 1,
                "text": texts
            }
            
            response = requests.post(DEEPL_URL, data=params)
            response.raise_for_status()
            
            result = response.json()
            translations = [t["text"] for t in result["translations"]]
            
            # Traccia utilizzo
            chars_used = sum(len(t) for t in texts)
            current_usage = track_usage(chars_used)
            
            print(f"📊 DeepL: {chars_used} caratteri utilizzati (totale mese: {current_usage})")
            
            return translations
            
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 5
                print(f"⚠️ Errore DeepL, riprovo tra {wait_time}s: {e}")
                time.sleep(wait_time)
            else:
                print(f"❌ Errore DeepL definitivo: {e}")
                raise

def flatten_dict(d, prefix=""):
    """Appiattisce dict nidificato"""
    result = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            result.update(flatten_dict(v, key))
        else:
            result[key] = v
    return result

def unflatten_dict(d):
    """Ricostruisce dict nidificato"""
    result = {}
    for key, value in d.items():
        parts = key.split('.')
        current = result
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value
    return result

def hash_text(text):
    """Genera hash SHA256 del testo"""
    return hashlib.sha256(str(text).encode()).hexdigest()

def needs_translation(key, text, target_lang, hashes):
    """Controlla se una chiave necessita traduzione"""
    current_hash = hash_text(text)
    stored_hash = hashes.get(SRC, {}).get(key)
    
    if stored_hash != current_hash:
        return True
    
    target_file = LOCALES_DIR / f"{target_lang}.json"
    if not target_file.exists():
        return True
    
    target_data = read_json(target_file)
    target_flat = flatten_dict(target_data)
    
    return key not in target_flat or not target_flat[key]

def main():
    print("🚀 Sincronizzazione i18n Sito Web con DeepL")
    print("=" * 60)
    
    # Verifica limiti
    check_usage_limit()
    
    # Prepara directory
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    hashes = read_json(HASH_FILE)
    
    # Carica file sorgente
    src_file = LOCALES_DIR / f"{SRC}.json"
    if not src_file.exists():
        print(f"❌ File sorgente non trovato: {src_file}")
        sys.exit(1)
    
    src_data = read_json(src_file)
    src_flat = flatten_dict(src_data)
    
    # Per ogni lingua target
    for target in TARGETS:
        print(f"\n🔄 Processando {target}...")
        
        target_file = LOCALES_DIR / f"{target}.json"
        target_data = read_json(target_file)
        target_flat = flatten_dict(target_data)
        
        to_translate = []
        
        # Trova chiavi da tradurre
        for key, text in src_flat.items():
            if isinstance(text, str) and needs_translation(key, text, target, hashes):
                placeholders = extract_placeholders(text)
                masked, ph_map, gl_map = mask_text(text, placeholders, GLOSSARY)
                to_translate.append((key, masked, ph_map, gl_map))
        
        if not to_translate:
            print(f"✅ {target}: Nessuna traduzione necessaria")
            continue
        
        print(f"📝 {target}: {len(to_translate)} chiavi da tradurre")
        
        # Traduci in batch
        batch_size = config["deepl"]["batch_size"]
        for i in range(0, len(to_translate), batch_size):
            batch = to_translate[i:i + batch_size]
            texts = [item[1] for item in batch]
            
            try:
                translations = translate_batch(texts, target)
                
                # Aggiorna target_flat
                for j, translation in enumerate(translations):
                    key, _, ph_map, gl_map = batch[j]
                    unmasked = unmask_text(translation, ph_map, gl_map)
                    target_flat[key] = unmasked
                    
                    # Aggiorna hash
                    if SRC not in hashes:
                        hashes[SRC] = {}
                    hashes[SRC][key] = hash_text(src_flat[key])
                
            except Exception as e:
                print(f"❌ Errore traduzione batch {i//batch_size + 1}: {e}")
                continue
        
        # Salva file aggiornato
        updated_data = unflatten_dict(target_flat)
        write_json(target_file, updated_data)
        print(f"✅ {target}: Salvato con successo")
    
    # Salva hash
    write_json(HASH_FILE, hashes)
    print(f"\n🎉 Sincronizzazione completata!")

if __name__ == "__main__":
    main()
