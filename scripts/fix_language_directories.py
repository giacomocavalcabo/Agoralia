#!/usr/bin/env python3
"""
Script per correggere le directory delle lingue secondo la lista ufficiale DeepL
"""

import os
import shutil
from pathlib import Path

# Lingue supportate da DeepL (lista ufficiale)
SUPPORTED_LANGUAGES = [
    'ar-EG', 'bg-BG', 'cs-CZ', 'da-DK', 'de-DE', 'el-GR', 'es-ES', 'et-EE', 
    'fi-FI', 'fr-FR', 'he-IL', 'hu-HU', 'id-ID', 'it-IT', 'ja-JP', 'ko-KR', 
    'lt-LT', 'lv-LV', 'nb-NO', 'nl-NL', 'pl-PL', 'pt-BR', 'pt-PT', 'ro-RO', 
    'ru-RU', 'sk-SK', 'sl-SI', 'sv-SE', 'th-TH', 'tr-TR', 'uk-UA', 'vi-VN', 
    'zh-HANS', 'zh-HANT'
]

# Lingue da rimuovere (non supportate)
LANGUAGES_TO_REMOVE = [
    'hi-IN',  # Hindi non supportato
    'hr-HR',  # Croato non supportato
    'ms-MY',  # Malese non supportato
    'no-NO',  # Sostituito da nb-NO
    'zh-CN',  # Sostituito da zh-HANS
]

# Lingue da rinominare
RENAME_MAP = {
    'no-NO': 'nb-NO',  # Norvegese Bokmål
    'zh-CN': 'zh-HANS',  # Cinese semplificato
}

# Namespace da copiare
NAMESPACES = [
    'admin.json', 'app.json', 'auth.json', 'billing.json', 'common.json',
    'compliance.json', 'errors.json', 'integrations.json', 'kb.json',
    'pages.json', 'settings.json', 'ui.json'
]

def fix_language_directories():
    """Corregge le directory delle lingue secondo la lista ufficiale DeepL"""
    
    locales_dir = Path('frontend/public/locales')
    en_us_dir = locales_dir / 'en-US'
    
    if not en_us_dir.exists():
        print("❌ Directory en-US non trovata!")
        return False
    
    print("🗑️  Rimuovendo lingue non supportate...")
    for lang in LANGUAGES_TO_REMOVE:
        lang_dir = locales_dir / lang
        if lang_dir.exists():
            shutil.rmtree(lang_dir)
            print(f"   ❌ Rimosso {lang}")
    
    print("\n🔄 Rinominando lingue...")
    for old_name, new_name in RENAME_MAP.items():
        old_dir = locales_dir / old_name
        new_dir = locales_dir / new_name
        
        if old_dir.exists() and not new_dir.exists():
            old_dir.rename(new_dir)
            print(f"   🔄 {old_name} → {new_name}")
        elif old_dir.exists() and new_dir.exists():
            # Se entrambe esistono, rimuovi la vecchia
            shutil.rmtree(old_dir)
            print(f"   ❌ Rimosso {old_name} (esiste già {new_name})")
    
    print("\n📁 Creando directory mancanti...")
    created_languages = []
    
    for lang in SUPPORTED_LANGUAGES:
        lang_dir = locales_dir / lang
        
        if lang_dir.exists():
            print(f"   ✅ {lang} già esistente")
            continue
            
        print(f"   📁 Creando {lang}...")
        lang_dir.mkdir(exist_ok=True)
        
        # Copia tutti i file JSON da en-US
        for ns in NAMESPACES:
            src_file = en_us_dir / ns
            dst_file = lang_dir / ns
            
            if src_file.exists():
                shutil.copy2(src_file, dst_file)
                print(f"      📄 Copiato {ns}")
            else:
                print(f"      ⚠️  File {ns} non trovato in en-US")
        
        created_languages.append(lang)
    
    print(f"\n✅ COMPLETATO!")
    print(f"   - Lingue supportate: {len(SUPPORTED_LANGUAGES)}")
    print(f"   - Directory create: {len(created_languages)}")
    print(f"   - Lingue rimosse: {len(LANGUAGES_TO_REMOVE)}")
    
    return True

if __name__ == "__main__":
    print("🔧 CORREZIONE DIRECTORY LINGUE")
    print("=" * 40)
    fix_language_directories()
