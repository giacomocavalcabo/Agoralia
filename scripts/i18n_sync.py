#!/usr/bin/env python3
import os, re, json, requests, hashlib, time
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "i18n.config.json").read_text())
SRC = CFG["sourceLocale"]
TARGETS = CFG["targetLocales"]
NAMESPACES = CFG["namespaces"]
GLOSSARY = list(dict.fromkeys(CFG.get("glossary", [])))  # unique, order
PRESERVE = [re.compile(p) for p in CFG.get("preservePatterns", [])]

DEEPL_KEY = os.getenv("DEEPL_API_KEY")
DEEPL_URL = "https://api-free.deepl.com/v2/translate"  # usa api.deepl.com se piano Pro

# Configurazione sicura per limiti DeepL (env override config file)
MONTHLY_CAP = int(os.getenv("DEEPL_MONTHLY_CAP", str(CFG.get("deepl", {}).get("monthly_cap", 500000))))
SOFT_WARN = int(os.getenv("DEEPL_SOFT_WARN", str(CFG.get("deepl", {}).get("soft_warn", 400000))))
BATCH_SIZE = int(os.getenv("DEEPL_BATCH_SIZE", str(CFG.get("deepl", {}).get("batch_size", 50))))
MAX_BATCH_CHARS = int(os.getenv("DEEPL_MAX_BATCH_CHARS", str(CFG.get("deepl", {}).get("max_batch_chars", 20000))))
MAX_RETRIES = int(os.getenv("DEEPL_MAX_RETRIES", str(CFG.get("deepl", {}).get("max_retries", 3))))

HASH_FILE = ROOT / "frontend" / ".i18n" / "hashes.json"
USAGE_FILE = ROOT / "frontend" / ".i18n" / "usage.json"

def ensure_dirs():
    (ROOT / "scripts").mkdir(exist_ok=True)
    (ROOT / "frontend" / ".i18n").mkdir(parents=True, exist_ok=True)

def ensure_target_files():
    """Assicura che tutti i file sorgente esistano anche nelle lingue target"""
    src_dir = ROOT / "frontend" / "public" / "locales" / SRC
    
    for src_file in src_dir.glob("*.json"):
        namespace = src_file.stem
        
        for locale in TARGETS:
            target_file = ROOT / "frontend" / "public" / "locales" / locale / f"{namespace}.json"
            
            if not target_file.exists():
                print(f"📁 Creando file mancante: {locale}/{namespace}.json")
                # Copia le chiavi da en-US (senza valori) per permettere traduzione
                src_data = read_json(src_file)
                target_data = {}
                
                # Crea struttura con chiavi vuote per permettere traduzione
                for key in src_data.keys():
                    if isinstance(src_data[key], dict):
                        target_data[key] = {}
                        for subkey in src_data[key].keys():
                            target_data[key][subkey] = ""
                    else:
                        target_data[key] = ""
                
                write_json(target_file, target_data)

def get_monthly_usage() -> int:
    """Recupera l'uso mensile già consumato"""
    if not USAGE_FILE.exists():
        return 0
    
    try:
        data = json.loads(USAGE_FILE.read_text(encoding="utf-8"))
        current_month = datetime.now().strftime("%Y-%m")
        return data.get(current_month, 0)
    except:
        return 0

def save_monthly_usage(used_chars: int):
    """Salva l'uso mensile consumato"""
    try:
        if USAGE_FILE.exists():
            data = json.loads(USAGE_FILE.read_text(encoding="utf-8"))
        else:
            data = {}
        
        current_month = datetime.now().strftime("%Y-%m")
        data[current_month] = data.get(current_month, 0) + used_chars
        
        write_json(USAGE_FILE, data)
    except Exception as e:
        print(f"⚠️  Errore salvataggio usage: {e}")

def read_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}

def write_json(p: Path, data: dict):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")

def flatten(d, prefix=""):
    for k, v in d.items():
        kk = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            yield from flatten(v, kk)
        else:
            yield kk, v

def unflatten(pairs):
    root = {}
    for key, value in pairs:
        cur = root
        parts = key.split(".")
        for part in parts[:-1]:
            if part not in cur:
                cur[part] = {}
            elif not isinstance(cur[part], dict):
                # Se la chiave esiste ma è una stringa, la convertiamo in dict
                cur[part] = {}
            cur = cur[part]
        cur[parts[-1]] = value
    return root

def src_hash(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def extract_placeholders(s: str):
    """Estrae placeholder e tag con pattern completi i18next/ICU/HTML"""
    if not s:
        return []
    
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
    tokens = [m.group(0) for m in combined_re.finditer(str(s))]
    
    # Preserva ordine di apparizione ma rimuovi duplicati
    seen, out = set(), []
    for t in tokens:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out

def mask_text(text: str, placeholders: list[str], glossary: list[str]):
    masked = text
    ph_tokens = {}
    for i, ph in enumerate(placeholders):
        token = f"__PH_{i}__"
        ph_tokens[token] = ph
        masked = masked.replace(ph, token)
    gl_tokens = {}
    for j, term in enumerate(glossary):
        # solo match esatto case-sensitive (evita pezzi di parole)
        token = f"__GL_{j}__"
        gl_tokens[token] = term
        masked = re.sub(rf"\b{re.escape(term)}\b", token, masked)
    return masked, ph_tokens, gl_tokens

def unmask_text(text: str, ph_tokens: dict, gl_tokens: dict):
    un = text
    for token, ph in ph_tokens.items():
        un = un.replace(token, ph)
    for token, term in gl_tokens.items():
        un = un.replace(token, term)
    return un

def deepl_lang(locale: str) -> str:
    # DeepL si aspetta codici tipo EN, IT, FR, ES, DE, PT-BR ecc.
    base = locale.split("-")[0].lower()
    mapping = {
        "en": "EN", "it": "IT", "fr": "FR", "es": "ES", "de": "DE",
        "pt": "PT-PT", "pt-br": "PT-BR", "nl": "NL", "pl": "PL",
        "ru": "RU", "ja": "JA", "zh": "ZH", "uk": "UK", "cs": "CS",
        "sv": "SV", "fi": "FI", "da": "DA", "no": "NB", "tr": "TR",
        "ar": "AR", "he": "HE", "fa": "FA", "el": "EL", "hu": "HU",
        "ro": "RO", "sk": "SK", "sl": "SL", "bg": "BG"
    }
    if base == "pt" and locale.lower().endswith("-br"):
        return "PT-BR"
    return mapping.get(base, base.upper())

def deepl_translate_batch(items, target_locale, already_used=0):
    """Traduzione DeepL con chunking intelligente e retry"""
    if not DEEPL_KEY:
        raise SystemExit("❌ DEEPL_API_KEY mancante. Impostalo come secret/ENV.")

    target = deepl_lang(target_locale)
    out = {}
    
    # Controllo limite mensile
    if already_used >= MONTHLY_CAP:
        print(f"⚠️  LIMITE MENSILE RAGGIUNTO: {already_used:,}/{MONTHLY_CAP:,} caratteri")
        return out
    
    remaining_chars = MONTHLY_CAP - already_used
    print(f"📊 Caratteri disponibili: {remaining_chars:,}")
    
    # Chunking intelligente
    current_batch = []
    current_batch_chars = 0
    total_chars_used = 0
    
    for key, masked, ph_map, gl_map in items:
        text_chars = len(masked)
        
        # Controlla se questo testo ci sta nel limite
        if already_used + total_chars_used + text_chars > MONTHLY_CAP:
            print(f"⚠️  LIMITE RAGGIUNTO: {already_used + total_chars_used:,}/{MONTHLY_CAP:,} caratteri")
            break
        
        # Aggiungi al batch corrente
        current_batch.append((key, masked, ph_map, gl_map))
        current_batch_chars += text_chars
        
        # Invia batch se pieno o troppo grande
        if (len(current_batch) >= BATCH_SIZE or 
            current_batch_chars >= MAX_BATCH_CHARS or
            already_used + total_chars_used + current_batch_chars > MONTHLY_CAP):
            
            # Traduci batch corrente
            batch_result = translate_single_batch(current_batch, target)
            if batch_result:
                out.update(batch_result)
                total_chars_used += current_batch_chars
                
                # Warning soft threshold
                if already_used + total_chars_used > SOFT_WARN:
                    print(f"⚠️  QUOTA ALTA: {already_used + total_chars_used:,}/{MONTHLY_CAP:,} caratteri")
            
            # Reset batch
            current_batch = []
            current_batch_chars = 0
    
    # Traduci batch finale se presente
    if current_batch:
        batch_result = translate_single_batch(current_batch, target)
        if batch_result:
            out.update(batch_result)
            total_chars_used += current_batch_chars
    
    return out, total_chars_used

def translate_single_batch(batch, target_lang, max_retries=None):
    if max_retries is None:
        max_retries = MAX_RETRIES
    """Traduzione singolo batch con retry e backoff"""
    params = {
        "auth_key": DEEPL_KEY,
        "target_lang": target_lang,
        "preserve_formatting": 1
    }
    
    for (_, masked, _, _) in batch:
        params.setdefault("text", []).append(masked)
    
    batch_chars = sum(len(masked) for (_, masked, _, _) in batch)
    print(f"🔄 Batch: {len(batch)} testi ({batch_chars:,} caratteri)")
    
    for attempt in range(max_retries):
        try:
            r = requests.post(DEEPL_URL, data=params, timeout=60)
            
            if r.status_code == 456:
                raise SystemExit("❌ DeepL: quota esaurita.")
            elif r.status_code == 429:
                retry_after = int(r.headers.get("Retry-After", 60))
                if attempt < max_retries - 1:
                    print(f"⏳ Rate limit, riprovo tra {retry_after}s...")
                    time.sleep(retry_after)
                    continue
                else:
                    raise SystemExit("❌ DeepL: rate limit persistente.")
            
            r.raise_for_status()
            translations = r.json().get("translations", [])
            
            if len(translations) != len(batch):
                raise RuntimeError("Dimensione batch non corrisponde alla risposta DeepL")
            
            # Processa traduzioni
            out = {}
            for (key, masked, ph_map, gl_map), tr in zip(batch, translations):
                translated = tr["text"]
                unmasked = unmask_text(translated, ph_map, gl_map)
                out[key] = unmasked
            
            print(f"   ✅ Tradotti {len(batch)} testi")
            return out
            
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"⚠️  Errore rete, riprovo tra {wait_time}s... ({e})")
                time.sleep(wait_time)
            else:
                print(f"❌ Errore persistente dopo {max_retries} tentativi: {e}")
                return {}
    
    return {}

def main():
    ensure_dirs()
    ensure_target_files()  # Crea file mancanti nelle lingue target
    hashes = read_json(HASH_FILE)
    
    # Recupera uso mensile già consumato
    already_used = get_monthly_usage()
    print(f"🚀 Inizio sincronizzazione i18n con DeepL")
    print(f"📊 Limite mensile: {MONTHLY_CAP:,} caratteri")
    print(f"📊 Già utilizzati: {already_used:,} caratteri")
    print(f"📊 Disponibili: {MONTHLY_CAP - already_used:,} caratteri")
    print("=" * 70)
    
    any_changes = []
    total_chars_used = 0
    
    for ns in NAMESPACES:
        src_path = ROOT / "frontend" / "public" / "locales" / SRC / f"{ns}.json"
        if not src_path.exists():
            print(f"⚠️  Namespace {ns} non trovato in {SRC}, saltando...")
            continue
            
        src = read_json(src_path)
        src_flat = dict(flatten(src))

        # aggiorna hash sorgente
        for k, v in src_flat.items():
            hashes.setdefault(SRC, {}).setdefault(ns, {})[k] = src_hash(str(v))

        for locale in TARGETS:
            tgt_path = ROOT / "frontend" / "public" / "locales" / locale / f"{ns}.json"
            tgt = read_json(tgt_path)
            tgt_flat = dict(flatten(tgt))

            # identifica chiavi mancanti o "stale" (inglese cambiato)
            to_translate = []
            
            # Se il file target è vuoto o ha chiavi vuote, forza traduzione di tutto
            force_translate = len(tgt_flat) == 0 or any(
                isinstance(v, str) and v.strip() == "" for v in tgt_flat.values()
            )
            
            if force_translate:
                print(f"🔄 Forzando traduzione completa per {locale}:{ns} (file vuoto o chiavi vuote)")
            
            for k, en_value in src_flat.items():
                h_now = src_hash(str(en_value))
                h_old = hashes.get(SRC, {}).get(ns, {}).get(k)
                needs_update = h_old is None or h_now != h_old
                missing = k not in tgt_flat or not isinstance(tgt_flat[k], str) or tgt_flat[k].strip() == ""
                
                if force_translate or missing or needs_update:
                    placeholders = extract_placeholders(str(en_value))
                    masked, ph_map, gl_map = mask_text(str(en_value), placeholders, GLOSSARY)
                    to_translate.append((k, masked, ph_map, gl_map))

            if not to_translate:
                continue

            print(f"\n🔄 Traduco {len(to_translate)} chiavi per {locale}:{ns}...")
            translations, batch_chars = deepl_translate_batch(to_translate, locale, already_used + total_chars_used)
            total_chars_used += batch_chars

            # merge su target
            merged = tgt_flat.copy()
            for k, _masked, ph_map, gl_map in to_translate:
                merged[k] = translations.get(k, src_flat[k])  # fallback a EN se necessario

            # scrivi ordinato
            write_json(tgt_path, unflatten(sorted(merged.items())))
            any_changes.append(str(tgt_path.relative_to(ROOT)))

    # salva hash aggiornati
    write_json(HASH_FILE, hashes)
    
    # salva usage aggiornato
    if total_chars_used > 0:
        save_monthly_usage(total_chars_used)

    print("\n" + "=" * 70)
    if any_changes:
        print("📝 File aggiornati:")
        for f in any_changes:
            print(" -", f)
        print(f"\n✅ Sincronizzazione i18n completata.")
    else:
        print("✅ Nessuna modifica necessaria.")
    
    # Report finale caratteri
    final_total = already_used + total_chars_used
    print(f"\n📊 Caratteri DeepL utilizzati in questa sessione: {total_chars_used:,}")
    print(f"📊 Caratteri DeepL totali questo mese: {final_total:,}/{MONTHLY_CAP:,}")
    if total_chars_used > 0:
        remaining = MONTHLY_CAP - final_total
        print(f"💡 Caratteri rimanenti: {remaining:,}")
        print(f"💡 Quota utilizzata: {(final_total/MONTHLY_CAP)*100:.1f}%")

if __name__ == "__main__":
    main()
